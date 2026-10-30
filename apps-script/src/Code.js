/**
 * OpenMRS Atlas: Apps Script bound to the Atlas sheet. See apps-script/README.md.
 *
 * - onAtlasEdit (installable onEdit trigger): gives new marker rows an id, stamps
 *   updated_at, logs each edit to the changes tab, and asks for a publish.
 * - Publishes are debounced: at most one call to the service per minute.
 * - The "Atlas" menu offers Publish now, Force publish and Install triggers.
 *
 * Script Properties: SERVICE_URL (the Cloud Run service) and PUBLISH_SECRET.
 * Edits made through the Sheets API (the service, the migration) do not fire onEdit.
 */

var DATA_TABS = ["markers", "types", "distributions", "versions"];
var PUBLISH_DELAY_MS = 60 * 1000;
var PENDING_KEY = "PUBLISH_PENDING";

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Atlas")
    .addItem("Publish now", "publishNow")
    .addItem("Force publish (skip safety check)", "forcePublish")
    .addSeparator()
    .addItem("Install triggers", "installTriggers")
    .addToUi();
}

/** Run once per sheet (Atlas > Install triggers). Safe to run again. */
function installTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "onAtlasEdit") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("onAtlasEdit").forSpreadsheet(SpreadsheetApp.getActive()).onEdit().create();
  SpreadsheetApp.getActive().toast("Atlas edit trigger installed.");
}

function onAtlasEdit(e) {
  var sheet = e.range.getSheet();
  var tab = sheet.getName();
  if (DATA_TABS.indexOf(tab) === -1) return;

  if (tab === "markers" && e.range.getLastRow() > 1) {
    var header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var firstRow = Math.max(e.range.getRow(), 2);
    var numRows = e.range.getLastRow() - firstRow + 1;
    var rows = sheet.getRange(firstRow, 1, numRows, header.length).getValues();
    var plan = planMarkerEdit(
      header,
      rows,
      e.range.getColumn(),
      e.range.getNumColumns(),
      new Date().toISOString(),
      function () {
        return Utilities.getUuid();
      },
    );
    if (plan.idColumn) {
      sheet.getRange(firstRow, plan.idColumn, numRows, 1).setValues(plan.ids);
    }
    if (plan.updatedColumn) {
      sheet.getRange(firstRow, plan.updatedColumn, numRows, 1).setValues(plan.updated);
    }
    var user = (e.user && e.user.getEmail()) || "unknown";
    var changes = SpreadsheetApp.getActive().getSheetByName("changes");
    plan.changes.forEach(function (c) {
      changes.appendRow([plan.timestamp, user, c.markerId, c.action, JSON.stringify(c.fields)]);
    });
  }
  requestPublish();
}

/**
 * Pure: what an edit to rows of the markers tab should change. Columns are 1-based.
 * Returns the new id and updated_at columns for the edited rows, and one changes entry per row.
 */
function planMarkerEdit(header, rows, editStartColumn, editNumColumns, now, newId) {
  var idIndex = header.indexOf("id");
  var updatedIndex = header.indexOf("updated_at");
  var fields = header.slice(editStartColumn - 1, editStartColumn - 1 + editNumColumns);
  var plan = {
    timestamp: now,
    idColumn: idIndex >= 0 ? idIndex + 1 : 0,
    updatedColumn: updatedIndex >= 0 ? updatedIndex + 1 : 0,
    ids: [],
    updated: [],
    changes: [],
  };
  rows.forEach(function (row) {
    var blank = row.every(function (cell) {
      return cell === "" || cell === null;
    });
    var id = idIndex >= 0 ? String(row[idIndex] || "") : "";
    var action = "edit";
    if (!blank && !id) {
      id = newId();
      action = "add";
    }
    plan.ids.push([id]);
    plan.updated.push([blank ? row[updatedIndex] || "" : now]);
    if (!blank) plan.changes.push({ markerId: id, action: action, fields: fields });
  });
  return plan;
}

/** Schedules one publish a minute from now, unless one is already pending. */
function requestPublish() {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var props = PropertiesService.getScriptProperties();
    if (props.getProperty(PENDING_KEY)) return;
    props.setProperty(PENDING_KEY, new Date().toISOString());
    ScriptApp.newTrigger("runPendingPublish").timeBased().after(PUBLISH_DELAY_MS).create();
  } finally {
    lock.releaseLock();
  }
}

function runPendingPublish() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "runPendingPublish") ScriptApp.deleteTrigger(t);
  });
  PropertiesService.getScriptProperties().deleteProperty(PENDING_KEY);
  callPublish(false);
}

function publishNow() {
  var result = callPublish(false);
  SpreadsheetApp.getActive().toast(result, "Atlas publish");
}

function forcePublish() {
  var ui = SpreadsheetApp.getUi();
  var answer = ui.alert(
    "Force publish?",
    "This skips the check that stops a publish from removing more than 20% of the markers. " +
      "Use it only when the drop is intended.",
    ui.ButtonSet.OK_CANCEL,
  );
  if (answer !== ui.Button.OK) return;
  SpreadsheetApp.getActive().toast(callPublish(true), "Atlas publish");
}

function callPublish(force) {
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty("SERVICE_URL");
  var secret = props.getProperty("PUBLISH_SECRET");
  if (!url || !secret) return "SERVICE_URL and PUBLISH_SECRET must be set in Script Properties.";
  var response = UrlFetchApp.fetch(
    url.replace(/\/$/, "") + "/publish" + (force ? "?force=true" : ""),
    {
      method: "post",
      headers: { Authorization: "Bearer " + secret },
      muteHttpExceptions: true,
    },
  );
  var code = response.getResponseCode();
  if (code === 200) {
    var body = JSON.parse(response.getContentText());
    return "Published " + body.markers + " markers (" + body.problems + " rows in problems).";
  }
  if (code === 409) return "Publish refused: see the problems tab.";
  return "Publish failed (HTTP " + code + ").";
}

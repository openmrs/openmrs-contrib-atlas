<?php

include "config.php";
require_once "Klogger.php";

$log = new KLogger("ping.log", KLogger::DEBUG);

function client_error($msg) {
  header('Status: 400 Bad Request');
  echo $msg;
  flush();
  return false;
}

function server_error($msg) {
  header('Status: 500 Internal Server Error');
  echo $msg;
  flush();
  return false;
}

function validate($json) {
  if ($json == NULL) return client_error('Missing data');
  if (!is_array($json)) return client_error('Unable to parse data');
  if (!array_key_exists('id', $json)) return client_error('Missing id');
  if (!array_key_exists('geolocation', $json)) return client_error('Missing geolocation');
  if (!array_key_exists('name', $json)) return client_error('Missing name');
  return true;
}

$dbh = new PDO($db_dsn, $db_username, $db_password);

$method = $_SERVER['REQUEST_METHOD'];

if ($method == 'DELETE') {
  $deleteId = sqlite_escape_string($_GET['id']);
  $deleteAuth = $_GET['secret'];
  if ($deleteAuth == $ping_delete_secret) {
    $dbh->query(<<<EOL
INSERT INTO archive (
  archive_date, id, latitude, longitude, name, url, type, image, patients,
  encounters, observations, contact, email, notes, data, date_created
  ) SELECT current_timestamp, id, latitude, longitude, name, url, type, image, patients,
  encounters, observations, contact, email, notes, data, date_created
FROM atlas
WHERE id = '$deleteId';
EOL
);
    $dbh->query("DELETE FROM atlas WHERE id = '$deleteId'");
    $log->logInfo("Deleted ".$deleteId." from ".$_SERVER['REMOTE_ADDR']);
    header('', true, 200);
  } else {
    header('Status: 401 Unauthorized');
    $log->logInfo("Unauthorized attempt to delete ".$deleteId." from ".$_SERVER['REMOTE_ADDR']);
  }
  header('Content-Length: 0');
  header('Connection: close'); // allows connection to be released instantly
  flush();
  exit;
}

if ($method != 'POST') {
  header('Status: 405 Method Not Allowed');
  $log->logInfo("Unauthorized $method from ".$_SERVER['REMOTE_ADDR']);
  exit;
}

$json = json_decode($HTTP_RAW_POST_DATA, true);
if (!validate($json)) {
  $log->logDebug("Invalid ping from ".$_SERVER['REMOTE_ADDR']);
  exit;
}

$dbh->exec(<<<EOL
CREATE TABLE IF NOT EXISTS atlas (
  id VARCHAR(38) PRIMARY KEY,
  latitude VARCHAR(50),
  longitude VARCHAR(50),
  name VARCHAR(1024),
  url VARCHAR(1024),
  type VARCHAR(1024),
  image VARCHAR(1024),
  patients int,
  encounters int,
  observations int,
  contact VARCHAR(1024),
  email VARCHAR(1024),
  notes TEXT,
  data TEXT,
  date_changed TIMESTAMP,
  date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atlasVersion varchar(50),
PRIMARY KEY (id));
EOL
);
$dbh->exec(<<<EOL
CREATE TABLE IF NOT EXISTS archive (
  archive_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  id VARCHAR(38),
  latitude VARCHAR(50),
  longitude VARCHAR(50),
  name VARCHAR(1024),
  url VARCHAR(1024),
  type VARCHAR(1024),
  image VARCHAR(1024),
  patients int,
  encounters int,
  observations int,
  contact VARCHAR(1024),
  email VARCHAR(1024),
  notes TEXT,
  data TEXT,
  date_changed TIMESTAMP,
  date_created TIMESTAMP,
  atlasVersion varchar(50));
EOL
);
$uptodate = $dbh->query("SELECT atlasVersion FROM atlas");
if (!$uptodate) {
  $dbh->exec(<<<EOL
  ALTER TABLE atlas ADD atlasVersion varchar(50);
EOL
);
}
$uptodate = $dbh->query("SELECT atlasVersion FROM archive");
if (!$uptodate) {
  $dbh->exec(<<<EOL
  ALTER TABLE archive ADD atlasVersion varchar(50);
EOL
);
}

$id = sqlite_escape_string($json['id']);
$latitude = floatval($json['geolocation']['latitude']);
$longitude = floatval($json['geolocation']['longitude']);
$name = sqlite_escape_string($json['name']);
$url = sqlite_escape_string($json['url']);
$type = sqlite_escape_string($json['type']);
$image = sqlite_escape_string($json['image']);
$patients = intval($json['patients']);
$encounters = intval($json['encounters']);
$observations = intval($json['observations']);
$contact = sqlite_escape_string($json['contact']);
$email = sqlite_escape_string($json['email']);
$notes = sqlite_escape_string($json['notes']);
$data = sqlite_escape_string(json_encode($json['data']));
$atlasVersion = sqlite_escape_string($json['atlasVersion']);

$stmt = $dbh->query("SELECT id FROM atlas WHERE id = '$id'");
if ($stmt->fetch()) {
  // implementation already exists
  // $dbh->setAttribute( PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION );
  $dbh->exec(<<<EOL
INSERT INTO archive (
  archive_date, id, latitude, longitude, name, url, type, image, patients,
  encounters, observations, contact, email, notes, data, date_created, atlasVersion
  ) SELECT current_timestamp, id, latitude, longitude, name, url, type, image, patients,
  encounters, observations, contact, email, notes, data, date_created, atlasVersion
  FROM atlas
  WHERE id = '$id';
UPDATE atlas SET
  latitude = '$latitude',
  longitude = '$longitude',
  name = '$name',
  url = '$url',
  type = '$type',
  image = '$image',
  patients = $patients,
  encounters = $encounters,
  observations = $observations,
  contact = '$contact',
  email = '$email',
  notes = '$notes',
  data = '$data',
  date_changed = CURRENT_TIMESTAMP,
  atlasVersion = '$atlasVersion'
WHERE
  id = '$id';
EOL
);
  $log->logDebug("Updated ".$id." from ".$_SERVER['REMOTE_ADDR']);
} else {
  // new implementation
  $dbh->query(<<<EOL
INSERT INTO atlas (
  id, latitude, longitude, name, url, type, image, patients,
  encounters, observations, contact, email, notes, data, date_created, atlasVersion
  ) VALUES (
  '$id', '$latitude', '$longitude', '$name', '$url', '$type', '$image', $patients,
  $encounters, $observations, '$contact', '$email', '$notes', '$data', current_timestamp, '$atlasVersion')
EOL
);
  $log->logDebug("Created ".$id." from ".$_SERVER['REMOTE_ADDR']);
}

header('', true, 200);
header('Content-Type: text/plain');
echo 'SUCCESS';

?>
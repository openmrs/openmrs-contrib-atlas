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
  $deleteId = $_GET['id'];
  $deleteParam = array('deleteId' => $deleteId);     
  $deleteAuth = $_GET['secret'];
  if ($deleteAuth == $ping_delete_secret) {
    $queryInsert = $dbh->prepare(<<<EOL
INSERT INTO archive (
  archive_date, id, latitude, longitude, name, url, type, image, patients,
  encounters, observations, contact, email, notes, data, date_created, atlas_version
  ) SELECT current_timestamp, id, latitude, longitude, name, url, type, image, patients,
  encounters, observations, contact, email, notes, data, date_created, atlas_version
FROM atlas
WHERE id = :deleteId;
EOL
);
    $queryInsert->execute($deleteParam);

    $queryDelete = $dbh->prepare("DELETE FROM atlas WHERE id = :deleteId");
    $queryDelete->execute($deleteParam);
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
  date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  date_changed TIMESTAMP,
  atlas_version varchar(50));
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
  date_created TIMESTAMP,
  date_changed TIMESTAMP,
  atlas_version varchar(50));
EOL
);
$uptodate = $dbh->query("SELECT atlas_version FROM atlas");
if (!$uptodate) {
  $dbh->exec(<<<EOL
  ALTER TABLE atlas ADD atlas_version varchar(50);
EOL
);
}
$uptodate = $dbh->query("SELECT atlas_version FROM archive");
if (!$uptodate) {
  $dbh->exec(<<<EOL
  ALTER TABLE archive ADD atlas_version varchar(50);
EOL
);
}
$id = array('id' => $json['id']);
$param = array(
'id' => $json['id'],
'latitude' => floatval($json['geolocation']['latitude']),
'longitude' => floatval($json['geolocation']['longitude']),
'name' => $json['name'],
'url' => $json['url'],
'type' => $json['type'],
'image' => $json['image'],
'patients' => intval($json['patients']),
'encounters' => intval($json['encounters']),
'observations' => intval($json['observations']),
'contact' => $json['contact'],
'email' => $json['email'],
'notes' => $json['notes'],
'data' => json_encode($json['data']),
'atlas_version' => $json['atlasVersion']);

$stmt = $dbh->prepare("SELECT id FROM atlas WHERE id = :id");
$stmt->execute($id);
if ($stmt->fetch()) {
  // implementation already exists
  // $dbh->setAttribute( PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION );
$query =  $dbh->prepare(<<<EOL
INSERT INTO archive (
  archive_date, id, latitude, longitude, name, url, type, image, patients,
  encounters, observations, contact, email, notes, data, date_created, atlas_version
  ) SELECT current_timestamp, id, latitude, longitude, name, url, type, image, patients,
  encounters, observations, contact, email, notes, data, date_created, atlas_version
  FROM atlas
  WHERE id = :id;
UPDATE atlas SET
  latitude = :latitude,
  longitude = :longitude,
  name = :name,
  url = :url,
  type = :type,
  image = :image,
  patients = :patients,
  encounters = :encounters,
  observations = :observations,
  contact = :contact,
  email = :email,
  notes = :notes,
  data = :data,
  date_changed = CURRENT_TIMESTAMP,
  atlas_version = :atlas_version
WHERE
  id = :id;
EOL
);
  $query->execute($param);
  $log->logDebug("Updated ".$param['id']." from ".$_SERVER['REMOTE_ADDR']);
} else {
  // new implementation
  $query = $dbh->prepare(<<<EOL
INSERT INTO atlas (
  id, latitude, longitude, name, url, type, image, patients,
  encounters, observations, contact, email, notes, data, date_created, atlas_version
  ) VALUES (
  :id, :latitude, :longitude, :name, :url, :type, :image, :patients,
  :encounters, :observations, :contact, :email, :notes, :data, current_timestamp, :atlas_version)
EOL
);
  $query->execute($param);
  $log->logDebug("Created ".$param['id']." from ".$_SERVER['REMOTE_ADDR']);
}

header('', true, 200);
header('Content-Type: text/plain');
echo 'SUCCESS';

?>
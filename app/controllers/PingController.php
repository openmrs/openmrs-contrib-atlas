<?php

/**
 * Ping controller.
 *
 */
class PingController extends BaseController {


	/**
	 * Delete Ping function
	 *
	 */
	public function pingDelete()
	{
		$db_dsn = getenv('DB_DNS');
		$db_username = getenv('DB_USERNAME');
		$db_password = getenv('DB_PASSWORD');
		$ping_delete_secret = getenv('PING_DELETE_SECRET');

		$dbh = new PDO($db_dsn, $db_username, $db_password);

		$deleteId = Input::get('id');
		$deleteParam = array('deleteId' => $deleteId);     

		$queryInsert = $dbh->prepare(
<<<EOL
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
		Log::info("Attempt to delete ".$deleteId);
		$queryDelete = $dbh->prepare("DELETE FROM atlas WHERE id = :deleteId");
		$queryDelete->execute($deleteParam);
		Log::info("Deleted ".$deleteId." from ".$_SERVER['REMOTE_ADDR']);
		return 'DELETED';
	}

	/**
	 * Post Ping function
	 *
	 */
	public function pingPost()
	{
		$db_dsn = getenv('DB_DNS');
		$db_username = getenv('DB_USERNAME');
		$db_password = getenv('DB_PASSWORD');
		$dbh = new PDO($db_dsn, $db_username, $db_password);

		$json = json_decode(Request::getContent(), true);

		$this->createTable();

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
		$id = $param['id'];
		if ($stmt->fetch()) {
		  // implementation already exists
		  // $dbh->setAttribute( PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION );
			$query =  $dbh->prepare(
<<<EOL
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
WHERE id = :id;
EOL
			);
			$query->execute($param);
			Log::debug("Updated ".$param['id']." from ".$_SERVER['REMOTE_ADDR']);
		} else {
			 // new implementation
			$query = $dbh->prepare(
<<<EOL
INSERT INTO atlas (
	id, latitude, longitude, name, url, type, image, patients,
	encounters, observations, contact, email, notes, data, date_created, atlas_version
	) VALUES (
:id, :latitude, :longitude, :name, :url, :type, :image, :patients,
:encounters, :observations, :contact, :email, :notes, :data, current_timestamp, :atlas_version)
EOL
			);
			$query->execute($param);
			Log::debug("Created ".$param['id']." from ".$_SERVER['REMOTE_ADDR']);
		}

		return 'SUCCES';
	}

	/**
	 * Handle Post Ping from Atlas Server
	 *
	 */
	public function pingAtlas()
	{
		$db_dsn = getenv('DB_DNS');
		$db_username = getenv('DB_USERNAME');
		$db_password = getenv('DB_PASSWORD');
		$dbh = new PDO($db_dsn, $db_username, $db_password);
		$this->createTable();
		$user = Session::get(user);

		Log::debug("DATA received: " . Request::getContent());
		$json = json_decode(Request::getContent(), true);
		
		$id['id'] = ($json['token'] != '') ? $json['token'] : Uuid::uuid4()->toString();
		$param = array(
			'id' => $id['id'],
			'latitude' => floatval($json['latitude']),
			'longitude' => floatval($json['longitude']),
			'name' => $json['name'],
			'url' => $json['url'],
			'type' => $json['type'],
			'image' => $json['image'],
			'contact' => $json['contact'],
			'email' => $json['email'],
			'notes' => $json['notes'],
			'data' => json_encode($json['data']),
			'atlas_version' => $json['atlasVersion'],
			'openmrs_id' => $json['uid']);
		if ($json['uid'] == '') unset($param['openmrs_id']);
		$stmt = $dbh->prepare("SELECT id FROM atlas WHERE id = :id");
		$stmt->execute($id);
		$id = $param['id'];
		if ($stmt->fetch()) {
		  // implementation already exists
		  // $dbh->setAttribute( PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION );
			$query =  $dbh->prepare(
<<<EOL
INSERT INTO archive (
	archive_date, id, latitude, longitude, name, url, type, image, patients,
	encounters, observations, contact, email, notes, data, date_created, atlas_version, openmrs_id
) SELECT current_timestamp, id, latitude, longitude, name, url, type, image, patients,
encounters, observations, contact, email, notes, data, date_created, atlas_version, openmrs_id
FROM atlas
WHERE id = :id;
UPDATE atlas SET
	latitude = :latitude,
	longitude = :longitude,
	name = :name,
	url = :url,
	type = :type,
	image = :image,
	contact = :contact,
	email = :email,
	notes = :notes,
	data = :data,
	date_changed = CURRENT_TIMESTAMP
WHERE id = :id;
EOL
			);
			$query->execute($param);
			Log::debug("Updated ".$param['id']." from ".$_SERVER['REMOTE_ADDR']);
		} else {
			 // new implementation
			$query = $dbh->prepare(
<<<EOL
INSERT INTO atlas (
	id, latitude, longitude, name, url, type, image, contact, email,
	 notes, data, date_created, atlas_version, openmrs_id
	) VALUES (
:id, :latitude, :longitude, :name, :url, :type, :image, :contact, :email,
 :notes, :data, current_timestamp, :atlas_version, :openmrs_id)
EOL
			);
			$query->execute($param);
			Log::debug("Created ".$param['id']." from ".$_SERVER['REMOTE_ADDR']);
		}
		$principal = 'openmrs_id:' . $user->uid;
		$auth = DB::table('auth')->where('atlas_id', '=', $id)->where('principal','=', 
				$principal)->first();
			if ($auth == NULL) {
				DB::table('auth')->insert(array('atlas_id' => $id, 'principal' => 
					$principal, 'token' => $user->uid));
				Log::debug("Created auth");
			} else {
				DB::table('auth')->where('id', $auth->id)->update(array('atlas_id' => $id, 'principal' => 
					$principal, 'token' => $user->uid, 'privileges' => ALL));
				Log::debug("Updated auth: " . $auth->id);
			}

		return $id;
	}

	public function pingAtlasDelete() {
		$id = Input::get('id');
		DB::table('auth')->where('atlas_id', '=', $id)->delete();
		DB::table('atlas')->where('id', '=', $id)->delete();
		Log::debug("Deleted marker: " . $id);
	}

	public function createTable() 
	{
		$db_dsn = getenv('DB_DNS');
		$db_username = getenv('DB_USERNAME');
		$db_password = getenv('DB_PASSWORD');
		$dbh = new PDO($db_dsn, $db_username, $db_password);

		$json = json_decode(Request::getContent(), true);

		$dbh->exec(
<<<EOL
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
		$dbh->exec(
<<<EOL
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
			$dbh->exec(
<<<EOL
ALTER TABLE atlas ADD atlas_version varchar(50);
EOL
			);
		}
		$uptodate = $dbh->query("SELECT atlas_version FROM archive");
		if (!$uptodate) {
			$dbh->exec(
<<<EOL
ALTER TABLE archive ADD atlas_version varchar(50);
EOL
			);
		}

	}
}

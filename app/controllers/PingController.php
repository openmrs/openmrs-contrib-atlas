<?php

/**
 * Ping controller.
 *
 */
class PingController extends BaseController {


	/**
	 * Delete Ping function
	 * Deprecated - Maintain compatibility with Atlas Module 1.x
	 */
	public function pingDelete()
	{    

		$id = Input::get('id');
		$user = Session::get(user);
		$date = new \DateTime;
		$site = DB::table('atlas')->where('id','=', $id)->first();

		if ($site != null) {
			DB::table('archive')->insert(array(
				'archive_date' => $date, 
				'site_uuid' => $site->id, 
				'id' => Uuid::uuid4()->toString(), 
				'type' => $site->type,
				'longitude' =>  $site->longitude, 
				'latitude' =>  $site->latitude,
				'name' =>  $site->name, 
				'url' =>  $site->url, 
				'image' =>  $site->image, 
				'contact' =>  $site->contact, 
				'changed_by' =>  'module:' . $_SERVER['REMOTE_ADDR'], 
				'patients' =>  $site->patients, 
				'encounters' =>  $site->encounters, 
				'observations' =>  $site->observations, 
				'notes' =>  $site->notes, 
				'email' => $site->email,
				'data' =>  $site->data, 
				'show_counts' => $site->show_counts,
				'atlas_version' => $site->atlas_version,
				'date_created' => $site->date_created,
				'created_by' => $site->created_by));
			DB::table('auth')->where('atlas_id', '=', $id)->delete();
			DB::table('atlas')->where('id', '=', $id)->delete();
			Log::info("Deleted ".$deleteId." from ".$_SERVER['REMOTE_ADDR']);

			return 'DELETED';
		}
	}

	/**
	 * Post Ping function
	 * Deprecated - Maintain compatibility with Atlas Module 1.x
	 */
	public function pingPost()
	{
		$this->createTable();

		Log::debug("DATA received: " . Request::getContent());

		$json = json_decode(Request::getContent(), true);
		$date = new \DateTime;
		$id['id'] = $json['id'];

		$openmrs_version = (empty($json['data'])) ? "" : $json['data']['version'];
		$param = array(
			'id' => $json['id'],
			'latitude' => floatval($json['geolocation']['latitude']),
			'longitude' => floatval($json['geolocation']['longitude']),
			'name' => $json['name'],
			'url' => $json['url'],
			'type' => $json['type'],
			'image' => $json['image'],
			'openmrs_version' => $openmrs_version,
			'patients' => intval($json['patients']),
			'encounters' => intval($json['encounters']),
			'observations' => intval($json['observations']),
			'contact' => $json['contact'],
			'email' => $json['email'],
			'notes' => $json['notes'],
			'data' => json_encode($json['data']),
			'atlas_version' => $json['atlasVersion'],
			'date_created' => $date);

		

		$site = DB::table('atlas')->where('id','=', $param['id'])->first();
		if ($site != null) {
			DB::table('archive')->insert(array(
				'archive_date' => $date, 
				'site_uuid' => $site->id, 
				'id' => Uuid::uuid4()->toString(), 
				'type' => $site->type,
				'longitude' =>  $site->longitude, 
				'latitude' =>  $site->latitude,
				'name' =>  $site->name, 
				'url' =>  $site->url, 
				'image' =>  $site->image, 
				'contact' =>  $site->contact, 
				'changed_by' => 'module:' . $_SERVER['REMOTE_ADDR'], 
				'patients' =>  $site->patients, 
				'encounters' =>  $site->encounters, 
				'observations' =>  $site->observations, 
				'notes' =>  $site->notes, 
				'email' => $site->email,
				'data' =>  $site->data, 
				'action' =>  'UPDATE', 
				'openmrs_version' => $openmrs_version, 
				'data' =>  $site->data,
				'show_counts' => $site->show_counts,
				'atlas_version' => $site->atlas_version,
				'date_created' => $site->date_created,
				'created_by' => $site->created_by));

			unset($param['date_created']);
			DB::table('atlas')->where('id', '=', $site->id)->update($param);
			Log::debug("Updated ".$param['id']." from ".$_SERVER['REMOTE_ADDR']);
		} else {
			 // new implementation
			DB::table('atlas')->insert($param);
			//insert into archive
			$param['action'] = "ADD";
			$param['site_uuid'] = Uuid::uuid4()->toString();
			$param['archive_date'] = $date;
			DB::table('archive')->insert($param);
			
			Log::debug("Created ".$param['id']." from ".$_SERVER['REMOTE_ADDR']);
		}
		return 'SUCCES';
	}

	/**
	 * Post Ping function - Handle Auto from Atlas Module 2.0
	 *
	 */
	public function autoPostModule()
	{
		$this->createTable();
		Log::debug("DATA received: " . Request::getContent());
		$json = json_decode(Request::getContent(), true);
		$date = new \DateTime;
		$module = $json['id'];
		Log::info('Module uuid: ' . $module);
		$siteM = DB::table('auth')->where('token','=', $module)->first();
		if ($siteM == NULL)
			App::abort(403, 'Unauthorized');

		$openmrs_version = (empty($json['data'])) ? "" : $json['data']['version'];
		$param = array(
			'id' => $siteM->atlas_id,
			'patients' => intval($json['patients']),
			'encounters' => intval($json['encounters']),
			'observations' => intval($json['observations']),
			'openmrs_version' => $openmrs_version, 
			'data' => json_encode($json['data']),
			'atlas_version' => $json['atlasVersion'],
			'date_created' => $date);

		$site = DB::table('atlas')->where('id','=', $param['id'])->first();
		if ($site != null) {
			DB::table('archive')->insert(array(
				'archive_date' => $date, 
				'site_uuid' => $site->id, 
				'id' => Uuid::uuid4()->toString(), 
				'action' =>  'UPDATE',  
				'type' => $site->type,
				'longitude' =>  $site->longitude, 
				'latitude' =>  $site->latitude,
				'name' =>  $site->name, 
				'openmrs_version' => $openmrs_version, 
				'url' =>  $site->url, 
				'image' =>  $site->image, 
				'contact' =>  $site->contact, 
				'changed_by' => 'module:' . $module, 
				'patients' =>  $site->patients, 
				'encounters' =>  $site->encounters, 
				'observations' =>  $site->observations, 
				'notes' =>  $site->notes, 
				'email' => $site->email,
				'show_counts' => $site->show_counts,
				'data' =>  $site->data, 
				'atlas_version' => $site->atlas_version,
				'date_created' => $site->date_created,
				'created_by' => $site->created_by));

			unset($param['date_created']);
			DB::table('atlas')->where('id', '=', $site->id)->update($param);
			Log::debug("Updated ".$param['id']." from ".$_SERVER['REMOTE_ADDR']);
		} else {
			Log::debug("Site not found: ".$param['id']." from ".$_SERVER['REMOTE_ADDR']);
		}
		return 'SUCCES';
	}

	/**
	 * Post Ping function - Handle Ping from Atlas Module 2.0
	 * Never Used and deprecated
	 */
	public function pingPostModule()
	{
		$this->createTable();
		Log::debug("DATA received: " . Request::getContent());
		$json = json_decode(Request::getContent(), true);
		$date = new \DateTime;
		$module = $json['id'];
		Log::info('Module uuid: ' . $module);
		$siteM = DB::table('auth')->where('token','=', $module)->first();
		if ($siteM == NULL)
			App::abort(403, 'Unauthorized');

		$param = array(
			'id' => $siteM->atlas_id,
			'patients' => intval($json['patients']),
			'encounters' => intval($json['encounters']),
			'observations' => intval($json['observations']),
			'atlas_version' => $json['atlasVersion'],
			'date_created' => $date);

		$site = DB::table('atlas')->where('id','=', $param['id'])->first();
		if ($site != null) {
			DB::table('archive')->insert(array(
				'archive_date' => $date, 
				'site_uuid' => $site->id, 
				'id' => Uuid::uuid4()->toString(), 
				'action' =>  'UPDATE',  
				'type' => $site->type,
				'longitude' =>  $site->longitude, 
				'latitude' =>  $site->latitude,
				'name' =>  $site->name, 
				'url' =>  $site->url, 
				'image' =>  $site->image, 
				'contact' =>  $site->contact, 
				'changed_by' => 'module:' . $_SERVER['REMOTE_ADDR'], 
				'patients' =>  $site->patients, 
				'encounters' =>  $site->encounters, 
				'observations' =>  $site->observations, 
				'openmrs_version' => $openmrs_version,
				'notes' =>  $site->notes, 
				'email' => $site->email,
				'data' =>  $site->data,
				'show_counts' => $site->show_counts, 
				'atlas_version' => $site->atlas_version,
				'date_created' => $site->date_created));

			unset($param['date_created']);
			DB::table('atlas')->where('id', '=', $site->id)->update($param);
			Log::debug("Updated ".$param['id']." from ".$_SERVER['REMOTE_ADDR']);
		} else {
			Log::debug("Site not found: ".$param['id']." from ".$_SERVER['REMOTE_ADDR']);
		}
		return 'SUCCES';
	}

	/**
	 * Handle Post Ping from Atlas Server
	 *
	 */


	/**
	 * @param $user
	 * @param $param
	 * @param $privileges
	 */
	private function managePrivileges($user, $param)
	{
		$privileges = DB::table('auth')->where('token', '=', $user->uid)->where('atlas_id', '=', $param['id'])
			->where('privileges', '=', 'ALL')->first();

		if ($user->role == 'ADMIN' && $privileges == NULL) {
			$privileges = new Privileges(array('token' => $user->uid,
				'principal' => 'admin:' . $user->uid,
				'privileges' => 'ADMIN'));
		}
		Log::debug("Privileges: " . $privileges->principal . "/" . $privileges->privileges);
		return $privileges;
	}

	public function pingAtlas()
	{
		$requestContent = Request::getContent();
		Log::debug("DATA received: " . $requestContent);

		$this->createTable();
		$user = Session::get(user);
		$date = new \DateTime;


		$param = $this->getParamArray($requestContent, $user, $date);

		$privileges = $this->managePrivileges($user, $param);

		$site = DB::table('atlas')->where('id','=', $param['id'])->first();

		$isExistingSite = $site != null;

		if ($isExistingSite) {
			$siteArray = new ArrayObject($site);
			$this->archiveExistingSite($siteArray->getArrayCopy(), $date, $privileges->principal, "UPDATE");

			unset($param['created_by']);
			unset($param['date_created']);

			DB::table('atlas')->where('id', '=', $site->id)->update($param);

			Log::debug("Updated ".$param['id']." from ".$_SERVER['REMOTE_ADDR']);

		}

		if(!$isExistingSite){
			DB::table('atlas')->insert($param);

			$this->archiveExistingSite($param, $date, $privileges->principal, "ADD");
			Log::debug("Created ".$param['id']." from ".$_SERVER['REMOTE_ADDR']);

			$principal = 'openmrs_id:' . $user->uid;
			DB::table('auth')->insert(array('atlas_id' => $param['id'], 'principal' =>
				$principal, 'token' => $user->uid, 'privileges' => 'ALL'));
			Log::debug("Created auth");

		}

		if(!$isExistingSite && Session::has('module')){
			$this->createAuthForModule($param);
		}

		return $param['id'];
	}

	public function pingAtlasDelete() {
		$id = Input::get('id');
		$user = Session::get(user);
		$date = new \DateTime;
		$site = DB::table('atlas')->where('id','=', $id)->first();
		$privileges = DB::table('auth')->where('token','=', $user->uid)->where('atlas_id','=', $param['id'])
		->where('privileges', '=', 'ALL')->first();

		if ($user->role == 'ADMIN' && $privileges == NULL) {
			$privileges = new Privileges(array('token' => $user->uid, 
	  				'principal' => 'admin:' . $user->uid,
	  				'privileges' => 'ADMIN'));
		}
		Log::debug("Privileges: " . $privileges->principal . "/" . $privileges->privileges);

		if ($site != null) {
			DB::table('archive')->insert(array(
				'site_uuid' => $site->id, 
				'id' => Uuid::uuid4()->toString(), 
				'type' => $site->type,
				'longitude' =>  $site->longitude, 
				'latitude' =>  $site->latitude,
				'name' =>  $site->name, 
				'url' =>  $site->url, 
				'image' =>  $site->image, 
				'contact' =>  $site->contact, 
				'changed_by' =>  $privileges->principal, 
				'patients' =>  $site->patients, 
				'encounters' =>  $site->encounters, 
				'observations' =>  $site->observations, 
				'notes' =>  $site->notes, 
				'email' => $site->email,
				'data' =>  $site->data, 
				'action' => 'DELETE', 
				'openmrs_version' => $site->openmrs_version, 
				'atlas_version' => $site->atlas_version,
				'date_created' => $site->date_created,
				'show_counts' => $site->show_counts,
				'created_by' => $site->created_by));
			DB::table('auth')->where('atlas_id', '=', $id)->delete();
			DB::table('atlas')->where('id', '=', $id)->delete();
			Log::info("Deleted ".$deleteId." from ".$_SERVER['REMOTE_ADDR']);
		}
	}

	public function createTable()
	{
		if ( !Schema::hasTable('atlas') || !Schema::hasTable('admin') 
			|| !Schema::hasTable('auth') || !Schema::hasTable('archive'))
			
			Artisan::call('migrate', ['--path'=> "app/database/migrations"]);
			Log::info('Database Updated');
	}


	private function archiveExistingSite($site, $date, $changedBy, $action)
	{
		$row = $site;
		$row["action"] = $action;
		$row["archive_date"] = $date;
		$row["changed_by"] = $changedBy;
		$row["site_uuid"] = $site['id'];
		$row["id"] = Uuid::uuid4()->toString();

		//$site is row to update from atlas table, which contains extra column "date_changed"
		unset($row["date_changed"]);

		DB::table('archive')->insert($row);

	}

	private function getParamArray($content, $user, $date){
		$json = json_decode($content, true);
		return array(
			'id' => ($json['uuid'] != '') ? $json['uuid'] : Uuid::uuid4()->toString(),
			'latitude' => floatval($json['latitude']),
			'longitude' => floatval($json['longitude']),
			'name' => $json['name'],
			'url' => $json['url'],
			'patients' => intval($json['patients']),
			'encounters' => intval($json['encounters']),
			'observations' => intval($json['observations']),
			'type' => $json['type'],
			'image' => $json['image'],
			'contact' => $json['contact'],
			'email' => $json['email'],
			'notes' => $json['notes'],
			'date_created' => $date,
			'openmrs_version' => $json['version'],
			'show_counts' => intval($json['show_counts']),
			'created_by' => $user->principal,
			'distribution' => intval($json['distribution']));
	}

	/**
	 * @param $param
	 */
	private function createAuthForModule($param)
	{
		$module = Session::get('module');

		Log::info('Module create a marker');
		Log::info('Module UUID: ' . $module);

		$doesAuthExist = DB::table('auth')->where('token', '=', $module)->count() > 0;

		if ($doesAuthExist) {
			log::info('Auth for this module exists for the site');
		}

		DB::table('auth')->insert(array('atlas_id' => $param['id'], 'principal' =>
			'module:' . $module, 'token' => $module, 'privileges' => 'STATS'));
		Log::debug("Created auth for module");
	}
}

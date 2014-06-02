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

		$id = Input::get('id');
		$user = Session::get(user);
		$date = new \DateTime;
		$site = DB::table('atlas')->where('id','=', $id)->first();

		if ($site != null) {
			DB::table('archive')->insert(array(
				'archive_date' => $date, 
				'id' => $site->id, 
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
				'atlas_version' => $site->atlas_version,
				'date_created' => $site->date_created));
			DB::table('auth')->where('atlas_id', '=', $id)->delete();
			DB::table('atlas')->where('id', '=', $id)->delete();
			Log::info("Deleted ".$deleteId." from ".$_SERVER['REMOTE_ADDR']);

			return 'DELETED';
		}
	}

	/**
	 * Post Ping function
	 *
	 */
	public function pingPost()
	{
		$this->createTable();
		Log::debug("DATA received: " . Request::getContent());
		$json = json_decode(Request::getContent(), true);
		$date = new \DateTime;
		$id['id'] = $json['id'];

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
			'atlas_version' => $json['atlasVersion'],
			'date_created' => $date);

		$site = DB::table('atlas')->where('id','=', $param['id'])->first();
		if ($site != null) {
			DB::table('archive')->insert(array(
				'archive_date' => $date, 
				'id' => $site->id, 
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
				'atlas_version' => $site->atlas_version,
				'date_created' => $site->date_created));

			unset($param['date_created']);
			DB::table('atlas')->where('id', '=', $site->id)->update($param);
			Log::debug("Updated ".$param['id']." from ".$_SERVER['REMOTE_ADDR']);
		} else {
			 // new implementation
			DB::table('atlas')->insert($param);
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

		$this->createTable();
		$user = Session::get(user);
		$date = new \DateTime;

		Log::debug("DATA received: " . Request::getContent());
		$json = json_decode(Request::getContent(), true);
		$id['id'] = ($json['uuid'] != '') ? $json['uuid'] : Uuid::uuid4()->toString();

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
			'date_created' => $date,
			'openmrs_id' => $user->uid);

		$privileges = DB::table('auth')->where('token','=', $user->uid)->where('atlas_id','=', $param['id'])
		->where('privileges', '=', 'ALL')->first();
		Log::debug("Privileges: " . $privileges->principal . "/" . $privileges->privileges);

		$site = DB::table('atlas')->where('id','=', $param['id'])->first();
		if ($site != null) {
			DB::table('archive')->insert(array(
				'archive_date' => $date, 
				'id' => $site->id, 
				'type' => $site->type,
				'longitude' =>  $site->longitude, 
				'latitude' =>  $site->latitude,
				'name' =>  $site->name, 
				'url' =>  $site->url, 
				'image' =>  $site->image, 
				'contact' =>  $site->contact, 
				'changed_by' => $privileges->principal, 
				'patients' =>  $site->patients, 
				'encounters' =>  $site->encounters, 
				'observations' =>  $site->observations, 
				'notes' =>  $site->notes, 
				'email' => $site->email,
				'data' =>  $site->data, 
				'atlas_version' => $site->atlas_version,
				'date_created' => $site->date_created));

			unset($param['openmrs_id']);
			unset($param['date_created']);
			DB::table('atlas')->where('id', '=', $site->id)->update($param);
			Log::debug("Updated ".$param['id']." from ".$_SERVER['REMOTE_ADDR']);
		} else {
			 // new implementation
			DB::table('atlas')->insert($param);
			Log::debug("Created ".$param['id']." from ".$_SERVER['REMOTE_ADDR']);
		}

		$principal = 'openmrs_id:' . $user->uid; 
		$auth = DB::table('auth')->where('atlas_id', '=', $param['id'])->where('principal','=', 
				$principal)->first();
			if ($auth == NULL) {
				DB::table('auth')->insert(array('atlas_id' => $param['id'], 'principal' => 
					$principal, 'token' => $user->uid, 'privileges' => 'ALL'));
				Log::debug("Created auth");
			}
		return $param['id'];
	}

	public function pingAtlasDelete() {
		$id = Input::get('id');
		$user = Session::get(user);
		$date = new \DateTime;
		$site = DB::table('atlas')->where('id','=', $id)->first();
		$privileges = DB::table('auth')->where('token','=', $user->uid)->where('atlas_id','=', $id)
		->where('privileges', '=', 'ALL')->first();
		Log::debug("Privileges: " . $privileges->principal . "/" . $privileges->privileges);

		if ($site != null) {
			DB::table('archive')->insert(array(
				'archive_date' => $date, 
				'id' => $site->id, 
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
				'atlas_version' => $site->atlas_version,
				'date_created' => $site->date_created));
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
}

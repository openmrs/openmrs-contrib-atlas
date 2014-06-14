
<?php

/**
 * Data controller.
 *
 */
class DataController extends BaseController {

	/**
	 * GET all markers as a JSON Object
	 *
	 */
	public function getData()
	{
		$db_dsn = getenv('DB_DNS');
		$db_username = getenv('DB_USERNAME');
		$db_password = getenv('DB_PASSWORD');
		$callback = Input::get('callback');
		$sites = DB::table('atlas')
                     ->select(DB::raw('id as uuid,  latitude,
                     	longitude, name, url, type, image, patients, encounters, observations,
                     	contact,email,notes,data,atlas_version,
                     	CASE WHEN date_changed IS NULL THEN "" ELSE date_changed END as date_changed,
                     	date_created'))->get();

		if (!$this->validateResult($sites))
		  exit;
		if (Session::has('module')) {
			$module = Session::get('module');
			Log::info('Module get data: ' . $module);
			$privilegesM = DB::table('auth')->where('token','=', $module)->first();
		}
		if (Session::has(user)) {
			$user = Session::get(user);
			Log::info('User get data: ' . $user->uid);
			$privileges = DB::table('auth')->where('token','=', $user->uid)->lists('atlas_id');
		} else {
			$privileges = array('visitor');
		}
		$id = 0;
		foreach ($sites as $site) {
			$id++;
			$site = (array)$site;
			$site['id'] = $id;
			if ( $privilegesM->atlas_id == $site['uuid']) {
				Log::info('Module auth site: ' . $id);
				$site['module'] = 1;
			}
			if (!in_array($site['uuid'], $privileges) && $user->role != 'ADMIN')
				unset($site['uuid']);
		    $major = 0;
		    $minor = 0;
		    $atlasVersion = json_decode($site['atlas_version']);
		    if ($atlasVersion != null)
		        list($major, $minor) = explode(".", $atlasVersion);
		    if ($major >= 1 && $minor > 1) {
		        unset($site['data']);
		        //TODO
		        $newResult[] = $site;
		        
		    } else {
		        $dataJson = json_decode($site['data'], true);
		        $version = $dataJson['version'];
		        $site['version'] = $version;
		        unset($site['data']);
		        $newResult[] = $site;
		    }
		}

		$contents = json_encode($newResult);
		if ($callback)
			$contents = $callback . "(" . $contents ." );";
		$response = Response::make($contents, 200);
		$response->header('Content-Type', 'application/json');
		return $response;
	}

	private function validateStmt($stmt)
	{
		if (!$stmt) App::abort(500, 'Unable to query database. Please try again later.');
		return true;
	}

	private function validateResult($result) 
	{
		 if (!$result) App::abort(500, 'Unable to retrieve data. Please try again later.');
		 return true;
	}

}

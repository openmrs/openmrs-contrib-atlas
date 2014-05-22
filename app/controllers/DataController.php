
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
		$sql = <<<EOL
SELECT
	id as token,
	@cnt := @cnt + 1 as id,
	latitude,
	longitude,
	name,
	url,
	type,
	image,
	patients,
	encounters,
	observations,
	contact,
	email,
	notes,
	data,
	atlas_version,
	CASE WHEN date_changed IS NULL THEN '' ELSE date_changed END as date_changed,
	date_created
FROM
	atlas
EOL
		;

		$dbh = new PDO($db_dsn, $db_username, $db_password);
		$dbh->query("SET @cnt := 0");
		$stmt = $dbh->query($sql);
		if (!$this->validateStmt($stmt))
		  exit;
		$result = $stmt->fetchAll(PDO::FETCH_ASSOC);
		if (!$this->validateResult($result))
		  exit;
		
		if (Session::has(user)) {
			$user = Session::get(user);
			Log::info('User get data: ' . $user->uid);
			$privileges = DB::table('auth')->where('token','=', $user->uid)->lists('atlas_id');
		} else {
			$privileges = array('visitor');
		}

		foreach ($result as $site) {
			if (!in_array($site['token'], $privileges))
				unset($site['token']);
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

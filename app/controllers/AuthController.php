<?php

class AuthController extends BaseController {

    /**
     *  Decode multipass token and log user
     */

    public function decodeMultipass()
    {
    	$token = Input::get('multipass');
    	$signature = Input::get('signature');
    	$iv = 'OpenSSL for Node';

    	$subdomain = getenv('SITE_KEY');
    	$api_key = getenv('API_KEY');
    	$salted = $api_key . $subdomain;
    	$digest = hash('sha1', $salted, true);
    	$key = substr($digest, 0, 16);
    	$blocksize = 16;

    	Log::info('Token: ' . $token);

    	// Signature Verification
    	$hash = base64_encode(hash_hmac("sha1", $token, $api_key, true));

    	if ($hash == $signature) {
    		Log::info('Signature OK');
	    	// Replace _ with / and - with +
	    	$token = preg_replace('/_/', '/', $token);
	    	$token = preg_replace('/\-/', '+', $token); 
	    	$token = base64_decode($token);

	    	// Decrypt Token
	  		$cipher = mcrypt_module_open(MCRYPT_RIJNDAEL_128,'','cbc','');
	  		mcrypt_generic_init($cipher, $key, $iv);

	  		$decrypted = mdecrypt_generic($cipher,$token);
	  		
	  		// Remove invisble character
	 	    $decrypted = trim($decrypted, "\x00..\x1F");
	  		$userToken  = json_decode($decrypted);
	  		Log::debug('Decoded Multipass: ' . $decrypted);

	  		//Create User
	  		$user = new \Illuminate\Auth\GenericUser(
	  			array('uid' => $userToken->uid, 
	  				'name' => $userToken->user_name,
	  				'email' => $userToken->user_email,
	  				'principal' => 'openmrs_id:' . $userToken->uid,
	  				'role' => NULL));
	  		$role = DB::table('admin')->where('token','=', $user->uid)->first();
	  		if ($role != null)
	  			$user->role = 'ADMIN';

			Log::info('User stored in session: ' . $user->uid);
			Log::info('User Rolen: ' . $user->role);
	  		// Log User
			Auth::login($user);
			Session::put('user', $user);
			if (Session::has('module')) {
				Session::remove('module');
				return Response::view('close');
			}
	    	return Redirect::to('/');
	    }
	    	Log::info('Signature and Hashed Token mismatch/n');
	    	Log::debug('Hash/n' . $hash);
	    	Log::debug('Signature/n' . $signature);
    }

    public function authModule() {
    	$json = json_decode(Request::getContent(), true);
    	$module = $json['token'];
    	$site = $json['site'];
    	Log::info('Auth module request: ');
    	Log::info('Site: ' . $site);
    	Log::info('Module: ' . $module);
    	$privileges = DB::table('auth')->where('token','=', $module)->count();
    	if ($privileges > 0)
    		App::abort(400,'This module is allready linked to a site');

		DB::table('auth')->insert(array('atlas_id' => $site, 'principal' => 
						'module:'. $module, 'token' => $module, 'privileges' => 'STATS'));
		Log::debug("Created auth");
    }

    public function deauthModule() {
    	$module =  Input::get('uuid');
    	Log::info('Deauth module request: ');
    	Log::info('Module: ' . $module);
    	$privileges = DB::table('auth')->where('token','=', $module)->count();
    	if ($privileges < 0)
    		App::abort(400,'This module is not linked to a site');
		DB::table('auth')->where('token','=', $module)->delete();
		Log::debug("Deleted auth");
    }

    public function getAuthModule() {
    	$module =  Input::get('uuid');
    	Log::info('getAuth module request: ');
    	Log::info('Module: ' . $module);
    	$privileges = DB::table('auth')->where('token','=', $module)->get();
		
		if (!Session::has('user') && count($privileges) == 0) {
			$response = Response::make("NOT_AUTHORIZED", 401);
		} else {
			$response = Response::json($privileges)->setCallback(Input::get('callback'));
		}

		$response->header('Content-Type', 'application/json');
		$response->headers->set('Access-Control-Allow-Origin', '*');
	    $response->headers->set('Access-Control-Allow-Credentials', 'true');
	    $response->headers->set('Access-Control-Allow-Headers', 'Authorization, X-Requested-With');
	    $response->headers->set('Access-Control-Allow-Methods', 'GET');
	    $response->headers->set('Allow', 'GET');
	    return $response;
    }

}
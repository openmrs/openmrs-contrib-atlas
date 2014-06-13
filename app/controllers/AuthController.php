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

}
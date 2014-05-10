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
  		Log::info('Decoded Multipass: ' . $decrypted);

  		//Create User
  		$user = new \Illuminate\Auth\GenericUser(
  			array('uid' => $userToken->uid, 
  				'name' => $userToken->user_name,
  				'email' => $userToken->user_email));

		Log::info('user: ' . $user->uid);

  		// Log User
		Auth::login($user);
		Session::put('user', $user);
    	return Redirect::to('/');
    }

}
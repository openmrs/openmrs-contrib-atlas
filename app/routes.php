<?php

/*
|--------------------------------------------------------------------------
| Application Routes
|--------------------------------------------------------------------------
|
| Here is where you can register all of the routes for an application.
| It's a breeze. Simply tell Laravel the URIs it should respond to
| and give it the Closure to execute when that URI is requested.
|
*/

Route::get('/', array('as' => 'home', function() 
{
	if (Session::has('module')) {
		Log::info('Old session from module');
		Session::remove('module');
	}
	if (Session::has(user)) {
		$user = Session::get(user);
		Log::info('Logged user: ' . $user->uid);
		$privileges = DB::table('auth')->where('token','=', $user->uid)->lists('atlas_id');
		$list = json_encode($privileges);
		Log::info('Authorized site: ' . $lists);
		return View::make('index', array('user' => $user, 'auth_site' => $list));
	}
	Log::info('Unknow user');
	return View::make('index');
}));

Route::delete('ping.php', array(
	'before' => 'secret',
	'uses' => 'PingController@pingDelete'));

//This handles create and update of marker site. Could not separate create and update for backward compatibility (especially with Atlas Module)
Route::post('ping.php/atlas', array(
	'before' => 'validateAtlasJson',
	'uses' => 'MarkerSiteController@save'));

Route::delete('ping.php/atlas', array(
	'before' => 'validateAtlasDelete',
	'uses' => 'MarkerSiteController@delete'));

Route::post('ping.php', array(
	'before' => 'validateJson',
	'uses' => 'PingController@pingPost'));

Route::get('markerSites', array(
	'uses' => 'DataController@getData'));

Route::get('distributions', array(
	'uses' => 'DataController@getDistributions'));

Route::get('auth/multipass/callback', array(
	'before' => 'multipass',
	'uses' => 'AuthController@decodeMultipass'));

Route::get('logout', array('as' => 'logout', function()
{
    $idServer = getenv('ID_HOST');
    Auth::logout();
    Log::info('User logged out');
    Session::remove('user');
    if (Session::has('module'))
		$url = urlencode(route('close'));
	else {
    	$url = urlencode(route('home'));
    }
    return Redirect::to($idServer.'/disconnect?destination='. $url);
}));

Route::get('login', array('as' => 'login', function()
{
    $idServer = getenv('ID_HOST');
    return Redirect::to($idServer.'/authenticate/atlas');
}));

Route::get('rss/{updates?}', array(
	'as' => 'rss',
	'uses' => 'AtlasController@rssGenerator'))
->where('updates', 'updates|all');

Route::get('download', array(
	'as' => 'cron',
	'uses' => 'AtlasController@downloadCapture'));

Route::match(array('GET', 'POST'), 'admin', array(
	'as' => 'admin',
	'before' => 'isAdmin',
	'uses' => 'AdminController@adminQuery'));

Route::get('close', array('as' => 'close', function() {
	if (!Session::has('module'))
		return Redirect::route('/');
	return Response::view('close');
}));

Route::get('module/login', array('as' => 'module-login', function() {
	if (Session::has('user'))
		return Redirect::route('module', array('uuid' => Input::get('uuid')));
	return Response::view('module');
}));

Route::post('module/auth', array(
	'before' => 'module-auth',
	'uses' => 'AuthController@authModule'));

Route::get('module/auth', array(
	'uses' => 'AuthController@getAuthModule'));

Route::delete('module/auth', array(
	'uses' => 'AuthController@deauthModule'));

Route::post('module/ping.php', array(
	'uses' => 'MarkerSiteController@autoPostModule'));

Route::get('module', array('as' => 'module', 'before' => 'module', function() 
{
	$moduleUUID = Input::get('uuid');
	Session::set('module', $moduleUUID);
	$moduleAuth = DB::table('auth')->where('token','=', $moduleUUID)->first();
	$moduleHasSite = ($moduleAuth != NULL) ? 1 : 0;
	if (Session::has(user)) {
		$user = Session::get(user);
		Log::info('Logged user: ' . $user->uid);
		$privileges = DB::table('auth')->where('token','=', $user->uid)->lists('atlas_id');
		$list = json_encode($privileges);
		Log::info('Authorized site: ' . $list);
		Log::info('Authorized module: ' . $moduleUUID);
		Log::info('Module attached: ' . $moduleHasSite);
		return View::make('index', array('user' => $user,
		 'auth_site' => $list, 'moduleUUID' =>  $moduleUUID, 'moduleHasSite' => $moduleHasSite));
	}
	if ($moduleAuth != NULL) {
		return View::make('index', array('moduleUUID' =>  $moduleUUID, 'moduleHasSite' => $moduleHasSite));
	}
	return Redirect::route('module-login', array('uuid' => $moduleUUID));
}));
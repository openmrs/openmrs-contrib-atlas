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

Route::post('ping.php/atlas', array(
	'before' => 'validateAtlasJson',
	'uses' => 'PingController@pingAtlas'));

Route::delete('ping.php/atlas', array(
	'before' => 'validateAtlasDelete',
	'uses' => 'PingController@pingAtlasDelete'));

Route::post('ping.php', array(
	'before' => 'validateJson',
	'uses' => 'PingController@pingPost'));

Route::get('data.php', array(
	'before' => 'validateCallback',
	'uses' => 'DataController@getData'));

Route::get('auth/multipass/callback', array(
	'before' => 'multipass',
	'uses' => 'AuthController@decodeMultipass'));

Route::get('logout', array('as' => 'logout', function()
{
    $idServer = getenv('ID_HOST');
    Auth::logout();
    Log::info('User logged out');
    Session::flush();
    $url = urlencode(route('home'));
    return Redirect::to($idServer.'/disconnect?destination='. $url);
}));

Route::get('login', array('as' => 'login', function()
{
    $idServer = getenv('ID_HOST');
    return Redirect::to($idServer.'/authenticate/atlas');
}));

Route::get('capture', array(
	'as' => 'capture',
	'before' => 'isAdmin',
	'uses' => 'AtlasController@takeCapture'));

Route::get('screenshot', array(
	'as' => 'download',
	'uses' => 'AtlasController@cronCapture'));

Route::get('download', array(
	'as' => 'cron',
	'uses' => 'AtlasController@downloadCapture'));

Route::match(array('GET', 'POST'), 'admin', array(
	'as' => 'admin',
	'before' => 'isAdmin',
	'uses' => 'AdminController@adminQuery'));
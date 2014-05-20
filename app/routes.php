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
		return View::make('index', array('user' => $user));
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
    return Redirect::to('https://'.$idServer.'/disconnect?destination='. $url);
}));

Route::get('login', array('as' => 'login', function()
{
    $idServer = getenv('ID_HOST');
    return Redirect::to('https://'.$idServer.'/authenticate/atlas');
}));
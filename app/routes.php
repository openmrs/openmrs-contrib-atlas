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

Route::post('ping.php', array(
	'before' => 'validateJson',
	'uses' => 'PingController@pingPost'));

Route::get('data.php', array(
	'before' => 'validateCallback',
	'uses' => 'DataController@getData'));

Route::filter('secret', function()
{
    if ( !Input::has('secret') || !Input::has('id') )
    {
        App::abort(400, 'Invalid Content');
    }
    if (Input::get('secret') != getenv('PING_DELETE_SECRET'))
    {
		App::abort(401, 'Unauthorized');
		Log::info("Unauthorized attempt to delete ".$deleteId." from ".Request::server('REMOTE_ADDR'))	;
	}
});

Route::filter('validateJson', function()
{
	$json = json_decode(Request::getContent(), true);
	if ($json == NULL) App::abort(400, 'Missing data');
	if (!is_array($json)) App::abort(400, 'Unable to parse data');
	if (!array_key_exists('id', $json)) App::abort(400, 'Missing id');
	if (!array_key_exists('geolocation', $json)) App::abort(400, 'Missing geolocation');
	if (!array_key_exists('name', $json)) App::abort(400, 'Missing name');
});

Route::filter('validateCallback', function()
{
	if (Input::has('callback')) {
		$callback = Input::get('callback');
		if (!preg_match('/^[a-z_][a-z0-9_]+$/i', $callback)) App::abort(400, 'Invalid callback.');
		$reserved = ",abstract,boolean,break,byte,case,catch,char,class,const,continue,default,do,double,else,extends,false,final,finally	float,for,function,goto,if,implements,import,in,instanceof,int,interface,long,native,new,null,package,private,protected	public,return,short,static,super,switch,synchronized,this,throw,throws,transient,true,try,var,void,while,with,";
		if (strpos($reserved, ",$callback,") !== false) App::abort(400, 'Callback cannot be reserved word.');
	}
});

Route::get('auth/multipass/callback', array(
	'before' => 'multipass',
	'uses' => 'AuthController@decodeMultipass'));

Route::filter('multipass', function()
{
    if ( !Input::has('multipass') || !Input::has('signature') )
    {
        App::abort(403, 'Unauthorized action.');
    }
});

Route::get('logout', array('as' => 'logout', function()
{
    $idServer = getenv('ID_HOST');
    Auth::logout();
    Log::info('User logged out');
    Session::flush();
    if (App::environment('production')) return Redirect::to('/');
    $url = urlencode(route('home'));
    return Redirect::to('http://'.$idServer.'/disconnect?destination='. $url);
}));

Route::get('login', array('as' => 'login', function()
{
    $idServer = getenv('ID_HOST');
    if (App::environment('production')) {
		//Create User
    	$user = new \Illuminate\Auth\GenericUser(
    		array('uid' => 'john.doe', 
    			'name' => 'John Doe',
    			'email' => 'john.doe@openmrs.org'));
    	Log::info('Fake user stored in session: ' . $user->uid);
    	Auth::login($user);
    	Session::put('user', $user);;
    	return Redirect::to('/');
	}
    return Redirect::to('http://'.$idServer.'/authenticate/atlas');
}));
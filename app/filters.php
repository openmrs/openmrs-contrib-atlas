<?php

/*
|--------------------------------------------------------------------------
| Application & Route Filters
|--------------------------------------------------------------------------
|
| Below you will find the "before" and "after" events for the application
| which may be used to do any work before or after a request into your
| application. Here you may also register your custom route filters.
|
*/

App::before(function($request)
{
	//
});


App::after(function($request, $response)
{
	//
});

/*
|--------------------------------------------------------------------------
| Authentication Filters
|--------------------------------------------------------------------------
|
| The following filters are used to verify that the user of the current
| session is logged into this application. The "basic" filter easily
| integrates HTTP Basic authentication for quick, simple checking.
|
*/

Route::filter('auth', function()
{
	if (Auth::guest()) return Redirect::guest('login');
});


Route::filter('auth.basic', function()
{
	return Auth::basic();
});

/*
|--------------------------------------------------------------------------
| Guest Filter
|--------------------------------------------------------------------------
|
| The "guest" filter is the counterpart of the authentication filters as
| it simply checks that the current user is not logged in. A redirect
| response will be issued if they are, which you may freely change.
|
*/

Route::filter('guest', function()
{
	if (Auth::check()) return Redirect::to('/');
});

/*
|--------------------------------------------------------------------------
| CSRF Protection Filter
|--------------------------------------------------------------------------
|
| The CSRF filter is responsible for protecting your application against
| cross-site request forgery attacks. If this special token in a user
| session does not match the one given in this request, we'll bail.
|
*/

Route::filter('csrf', function()
{
	if (Session::token() != Input::get('_token'))
	{
		throw new Illuminate\Session\TokenMismatchException;
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

Route::filter('multipass', function()
{
    if ( !Input::has('multipass') || !Input::has('signature') )
    {
        App::abort(403, 'Unauthorized action.');
    }
});

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

Route::filter('validateAtlasJson', function()
{
	$json = json_decode(Request::getContent(), true);
	if ($json == NULL) App::abort(400, 'Missing data');
	if (!is_array($json)) App::abort(400, 'Unable to parse data');
	if (!array_key_exists('uuid', $json)) App::abort(400, 'Missing uuid');
	if (!array_key_exists('longitude', $json)) App::abort(400, 'Missing longitude');
	if (!array_key_exists('latitude', $json)) App::abort(400, 'Missing latitude');
	if (!array_key_exists('name', $json)) App::abort(400, 'Missing name');
	if (!Session::has(user))
		App::abort(403, 'Unauthorized Action - Not logged');
	$id = $json['uuid'];
	$user = Session::get(user);
	$token = $user->uid;
	$exist = DB::table('atlas')->where('id','=', $id)->first();
	if ($exist != null) {
		$privileges = DB::table('auth')->where('token','=', $token)->where('atlas_id','=',$id)
		->where('privileges', '=', 'ALL')->first();
		if ($privileges == NULL && $user->role !== 'ADMIN')
			App::abort(403, 'Unauthorized Action - Privileges missing');
		Log::debug("Update authorized : " . $privileges->principal . "/" . $privileges->atlas_id);
	}
});

Route::filter('validateAtlasDelete', function()
{
	if ( !Input::has('id'))
		App::abort(400, 'Missing site dd');
	if ( !Session::has(user) )
		App::abort(403, 'Unauthorized Action - Not logged');
	$id = Input::get('id');
	$user = Session::get(user);
	$token = $user->uid;
	$privileges = DB::table('auth')->where('token','=', $token)->where('atlas_id','=',$id)
	->where('privileges', '=', 'ALL')->first();
	if ($privileges == NULL && $user->role !== 'ADMIN')
		App::abort(403, 'Unauthorized Action - Priveleges missing');
});

Route::filter('isAdmin', function()
{
	if ( !Session::has(user) )
		return Redirect::route('login');
	$user = Session::get(user);
	if ($user->role !== 'ADMIN')
		return Redirect::home();
});

Route::filter('module', function()
{
	if (!Input::has('uuid'))
		App::abort(500, 'Missing Parameter');
	if (strlen(Input::get('uuid')) < 30)
		App::abort(500, 'Invalid parameters');
});
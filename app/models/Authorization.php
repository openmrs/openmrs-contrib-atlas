<?php

class Authorization extends Eloquent {

    protected $table = 'auth';
    protected $fillable = array('atlas_id', 'token', 'privileges', 'principal');
    public $timestamps = false;

    public static function getPrincipal($markerSiteId)
    {
        $user = Session::get(user);
        $auth = Authorization::whereRaw('token = ? and atlas_id = ? and privileges = \'ALL\'', array($user->uid, $markerSiteId))->first();

        if ($user->role == 'ADMIN' && $auth == NULL) {
            $auth = new Authorization(
                                array(
                                    'token' => $user->uid,
                                    'principal' => 'admin:' . $user->uid,
                                    'privileges' => 'ADMIN'
                                )
                            );
        }
        Log::debug("Privileges: " . $auth->principal . "/" . $auth->privileges);
        return $auth->principal;
    }

    public static function createAuthForUser($markerSiteId)
    {
        $user = Session::get(user);

        Authorization::create(
            array(
                'atlas_id' => $markerSiteId,
                'token' => $user->uid,
                'principal' => 'openmrs_id:' . $user->uid,
                'privileges' => 'ALL'
            )
        );

        Log::debug("Created auth for user");
    }

    public static function createAuthForModule($markerSiteId)
    {
        $module = Session::get('module');

        Log::info('Module create a marker');
        Log::info('Module UUID: ' . $module);

        $doesAuthExist = Authorization::where('token', '=', $module)->count() > 0;

        if ($doesAuthExist) {
            log::info('Auth for this module exists for the site');
        }

        Authorization::create(
            array(
                'atlas_id' => $markerSiteId,
                'token' => $module,
                'principal' => 'module:' . $module,
                'privileges' => 'STATS'
            )
        );

        Log::debug("Created auth for module");
    }
}
<?php

class AuthorizationService
{

    public function getPrincipal($markerSiteId)
    {
        $user = Session::get(user);
        $auth = Authorization::whereRaw('token = ? and atlas_id = ? and privileges = \'ALL\'', array($user->uid, $markerSiteId))->first();

        if ($user->role == 'ADMIN' && $auth == NULL) {
            $auth = Authorization::create(
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

    public function createAuth($markerSiteId){
        $this->createAuthForUser($markerSiteId);
        if(Session::has('module')){
            $this->createAuthForModule($markerSiteId);
        }
    }

    private function createAuthForUser($markerSiteId)
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

    private function createAuthForModule($markerSiteId)
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

    public function getAuthourizedModule($token){
        Log::info("Token = ".$token);
        return Authorization::where('token','=', $token)->firstOrFail();
    }
}
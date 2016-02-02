<?php


class MarkerSiteController extends BaseController
{

    public function save(){
        $requestContent = Request::getContent();
        Log::debug("DATA received: " . $requestContent);

        $user = Session::get(user);
        $date = new \DateTime;
        $json = json_decode($requestContent, true);
        $param = $this->getParamArray($json, $user, $date);
        $nonStandardDistributionName = StringUtils::getSanitisedString($json['nonStandardDistributionName']);

        $principal = Authorization::getPrincipal($param['id']);

        $site = MarkerSite::find($param['id']);

        $isExistingSite = $site != null;

        $isExistingSite ?
            $this->updateExistingSite($site, $date, $principal, $param, $nonStandardDistributionName):
            $this->createNewSite($param, $date, $principal, $user, $nonStandardDistributionName);

        if(!$isExistingSite && Session::has('module')){
            Authorization::createAuthForModule($param['id']);
        }

        return $param['id'];
    }

    private function getParamArray($json, $user, $date){

        return array(
            'id' => ($json['uuid'] != '') ? $json['uuid'] : Uuid::uuid4()->toString(),
            'latitude' => floatval($json['latitude']),
            'longitude' => floatval($json['longitude']),
            'name' => $json['name'],
            'url' => $json['url'],
            'patients' => intval($json['patients']),
            'encounters' => intval($json['encounters']),
            'observations' => intval($json['observations']),
            'type' => $json['type'],
            'image' => $json['image'],
            'contact' => $json['contact'],
            'email' => $json['email'],
            'notes' => $json['notes'],
            'date_created' => $date,
            'openmrs_version' => $json['version'],
            'show_counts' => intval($json['show_counts']),
            'created_by' => $user->principal,
            'distribution' => $json['distribution']
        );
    }

    private function updateExistingSite($site, $date, $principal, $param, $nonStandardDistributionName)
    {
        $existingDistribution = DB::table('distributions')-> where('id', '=', $site->distribution)->first();

        $newDistributionFromBlank = $nonStandardDistributionName && !$existingDistribution;
        $newDistributionFromStandard = $nonStandardDistributionName && $existingDistribution && $existingDistribution->is_standard;

        if($newDistributionFromBlank || $newDistributionFromStandard){
            $param['distribution'] = DB::table('distributions')->insertGetId(
                ["name" => $nonStandardDistributionName]
            );
        }

        if($nonStandardDistributionName && $existingDistribution && !$existingDistribution->is_standard){
            DB::table('distributions')->where('id', '=', $existingDistribution->id)->update(['name'=>$nonStandardDistributionName]);
            $param['distribution'] = $existingDistribution->id;
        }

        $archiveDistribution = $existingDistribution ? $existingDistribution->name : null;
        MarkerSiteService::archiveSite($site->toArray(), $date, $principal, "UPDATE", $archiveDistribution);

        unset($param['created_by']);
        unset($param['date_created']);

        DB::table('atlas')->where('id', '=', $site->id)->update($param);
        Log::debug("Updated " . $param['id'] . " from " . $_SERVER['REMOTE_ADDR']);

        if (is_null($nonStandardDistributionName) && $existingDistribution && !$existingDistribution->is_standard) {
            DB::table('distributions')->where('id', '=', $existingDistribution->id)->delete();
        }
    }


    private function createNewSite($param, $date, $principal, $user, $nonStandardDistributionName)
    {
        if($nonStandardDistributionName){
            $param['distribution'] = Distribution::create(["name" => $nonStandardDistributionName])->id;
        }
        $auditDistributionName = $nonStandardDistributionName ? $nonStandardDistributionName : Distribution::find($param['distribution'])->name;

        MarkerSite::create($param);

        MarkerSiteService::archiveSite($param, $date, $principal, "ADD", $auditDistributionName);

        Log::debug("Created " . $param['id'] . " from " . $_SERVER['REMOTE_ADDR']);

        Authorization::createAuthForUser($param['id']);
    }
}
<?php

class MarkerSiteService
{
    private $authService;
    public function __construct($authService)
    {
        $this->authService = $authService;
    }

    public function save($markerSite, $nonStandardDistributionName){

        if($nonStandardDistributionName){
            $markerSite->distribution = Distribution::create(["name" => $nonStandardDistributionName])->id ;
        }

        return $markerSite->id ?
            $this->updateSite($markerSite, $nonStandardDistributionName):
            $this->createNewSite($markerSite, $nonStandardDistributionName);
    }

    private function createNewSite($markerSite)
    {
        $markerSite->id = Uuid::uuid4()->toString();

        $markerSite->save();
        Log::debug("Created " . $markerSite->id . " from " . $_SERVER['REMOTE_ADDR']);

        $this->authService->createAuth($markerSite->id);

        return $markerSite;
    }

    private function updateSite($markerSite)
    {
        $existingSite = MarkerSite::find($markerSite->id);
        $existingDistribution = Distribution::find($existingSite->distribution);

        $existingSite->update($markerSite->toArray());
        Log::debug("Updated " . $markerSite->id . " from " . $_SERVER['REMOTE_ADDR']);

        if($existingDistribution && !$existingDistribution->is_standard){
            Distribution::destroy($existingDistribution->id);
        }

        return $existingSite;
    }
}
<?php

class MarkerSiteService
{
    private $authService;

    public function __construct(AuthorizationService $authService)
    {
        $this->authService = $authService;
    }

    public function save($markerSite, $nonStandardDistributionName)
    {
        DB::beginTransaction();
        try {
            if ($nonStandardDistributionName) {
                $markerSite->distribution = Distribution::create(["name" => $nonStandardDistributionName])->id;
                Log::info("created new distribution " . $nonStandardDistributionName);
            }

            $markerSite = $markerSite->id ?
                $this->updateSite($markerSite, $nonStandardDistributionName) :
                $this->createNewSite($markerSite, $nonStandardDistributionName);
            DB::commit();

            return $markerSite;
        } catch (Exception $e) {
            DB::rollback();
        }

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

        //Remove NonStandard Distribution as no marker site would be refering it
        if($existingDistribution && $existingDistribution->isNonStandard()){
            Distribution::destroy($existingDistribution->id);
        }

        return $existingSite;
    }

    public function deleteSite(&$markerSite){

        $distribution = Distribution::find($markerSite->distribution);

        Authorization::where('atlas_id', '=', $markerSite->id)->delete();
        Log::info("Deleted authorization ".$markerSite->id." from ".$_SERVER['REMOTE_ADDR']);

        Log::info("Deleting Site".$markerSite->id." from ".$_SERVER['REMOTE_ADDR']);
        $markerSite->delete();
        Log::info("Deleted Site");

        Log::info("Distribution name=" . $distribution->name . " id=". $distribution->id. " standard=". $distribution->is_standard);

        if($distribution && $distribution->isNonStandard()){
            Log::info("Deleting distribution ".$distribution->id." from ".$_SERVER['REMOTE_ADDR']);
            $distribution->delete();
            Log::info("Deleted Distribution");
        }
    }
}
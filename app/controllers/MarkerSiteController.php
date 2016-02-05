<?php


class MarkerSiteController extends BaseController
{
    var $markerSiteService;
    var $auditService;
    var $authService;

    //Laravel auto injects dependency in controller
    public function __construct(MarkerSiteService $markerSiteService, AuditService $auditService, AuthorizationService $authService){
        $this->markerSiteService = $markerSiteService;
        $this->auditService = $auditService;
        $this->authService = $authService;
    }

    public function save(){
        $requestContent = Request::getContent();
        Log::debug("DATA received: " . $requestContent);

        $json = json_decode($requestContent, true);
        $nonStandardDistributionName = StringUtils::getSanitisedString($json['nonStandardDistributionName']);

        $markerSite = MarkerSiteBuilder::build($json);

        $markerSite = $this->markerSiteService->save($markerSite, $nonStandardDistributionName);

        $this->auditService->auditSavedSite($markerSite);

        return $markerSite->id;
    }

    /**
     * Post Ping function - Handle Auto from Atlas Module 2.0
     *
     */
    public function autoPostModule(){
        $requestContent = Request::getContent();
        Log::debug("DATA received: " . $requestContent);

        $json = json_decode($requestContent, true);

        Log::info('Module uuid: ' . $json['id']);

        $authorizedModule = $this->authService->getAuthourizedModule($json['id']);
        $json['atlas_id'] = $authorizedModule->atlas_id;

        $markerSite = MarkerSiteBuilder::buildForModule($json);
        $markerSite->save();
        Log::debug("Updated ".$markerSite->id." from ".$_SERVER['REMOTE_ADDR']);

        $this->auditService->auditModuleSite($markerSite, $json['id']);

        return 'SUCCES';
    }

    public function delete(){
        $markerSite = MarkerSite::findOrFail(Input::get('id'));
        $this->auditService->auditDeletedSite($markerSite);
        $this->markerSiteService->deleteSite($markerSite);
    }
}
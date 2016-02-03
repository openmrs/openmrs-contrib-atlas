<?php


class MarkerSiteController extends BaseController
{

    public function save(){
        $requestContent = Request::getContent();
        Log::debug("DATA received: " . $requestContent);

        $json = json_decode($requestContent, true);
        $nonStandardDistributionName = StringUtils::getSanitisedString($json['nonStandardDistributionName']);

        $markerSite = MarkerSiteBuilder::build($json);

        $authService = new AuthorizationService();
        $markerSiteService = new MarkerSiteService($authService);

        $markerSite = $markerSiteService->save($markerSite, $nonStandardDistributionName);

        $distroService = new DistributionService();
        $auditService = new AuditService($distroService, $authService);
        $auditService->auditSavedSite($markerSite);

        return $markerSite->id;
    }
}
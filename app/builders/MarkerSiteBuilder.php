<?php

class MarkerSiteBuilder
{
    public static function build($json){
        $user = Session::get(user);
        $date = new \DateTime;
        return new MarkerSite(array(
            'id' => ($json['uuid'] != '') ? $json['uuid'] : null,
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
        ));
    }

    public static function &buildForModule($json){

        $markerSite = MarkerSite::findOrFail($json['atlas_id']);
        $markerSite->patients = intval($json['patients']);
        $markerSite->encounters = intval($json['encounters']);
        $markerSite->observations = intval($json['observations']);
        $markerSite->openmrs_version = (empty($json['data'])) ? "" : $json['data']['version'];
        $markerSite->data = json_encode($json['data']);
        $markerSite->atlas_version = $json['atlasVersion'];
        $markerSite->date_created = new DateTime();

        return $markerSite;
    }
}
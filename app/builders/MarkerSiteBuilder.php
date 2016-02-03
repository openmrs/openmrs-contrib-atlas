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
}
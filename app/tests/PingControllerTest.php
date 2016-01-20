<?php
/**
 * Created by PhpStorm.
 * User: saloniv
 * Date: 20/01/16
 * Time: 11:13 AM
 */
 $GLOBALS = array(
    'id' => 1,
    'latitude' => 15,
    'longitude' => 15,
    'name' => "OpenMRS User Site",
    'url' => "",
    'patients' => "0",
    'encounters' => "0",
    'observations' => "0",
    'type' => "Clinical",
    'image' => "",
    'contact' => "OpenMRS User",
    'email' => "user@openmrs.org",
    'notes' => "",
    'date_created' => "2016-01-19 17:31:20",
    'openmrs_version' => "",
    'show_counts' => 1,
    'distribution' => null,
    "uuid" => "53a1d9de-8970-4b31-9dc0-2d7e7a3b7a8e",
    "site_id" => "53a1d9de-8970-4b31-9dc0-2d7e7a3b7a8e",
    "atlas_version" => null,
    "date_changed" => "Wed Jan 20 2016 16:05:50 GMT+0530 (IST)",
    "version" => "",
    "nonStandardDistributionName" => ""
);

class PingControllerTest extends TestCase {

    public function testUpdateDistribution()
    {
        $response = $this->call('POST', 'ping.php/atlas',[],[],[], json_encode($GLOBALS));
        $this->assertNotNull($response);
        $this->assertNotNull($response->getContent());
        $this->assertTrue($response->isOk());
        echo $response->getContent();
    }
}
<?php

class DistributionService
{
    public function getDistributionName($id){
        $distribution = Distribution::find($id);
        return $distribution? $distribution->name : null;
    }
}
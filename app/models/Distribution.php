<?php


class Distribution extends Eloquent
{
    protected $fillable = array('id', 'name', 'is_standard');
    public $is_standard;

    public function isNonStandard(){
        return !$this->is_standard;
    }
}
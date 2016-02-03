<?php

class Authorization extends Eloquent {

    protected $table = 'auth';
    protected $fillable = array('atlas_id', 'token', 'privileges', 'principal');
    public $timestamps = false;
    public $incremental = false;
}
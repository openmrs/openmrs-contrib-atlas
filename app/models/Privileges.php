<?php

class Privileges extends Eloquent {

    protected $table = 'auth';
    protected $fillable = array('token', 'privileges', 'principal');
}
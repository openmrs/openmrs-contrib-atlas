<?php

class MarkerSite extends Eloquent
{
    protected $table = 'atlas';
    protected $fillable = array(
                            'id',
                            'latitude',
                            'longitude',
                            'name',
                            'url',
                            'patients',
                            'encounters',
                            'observations',
                            'type',
                            'image',
                            'contact',
                            'email',
                            'notes',
                            'date_created',
                            'date_changed',
                            'openmrs_version',
                            'show_counts',
                            'created_by',
                            'distribution'
                        );

    public $timestamps = false;

}
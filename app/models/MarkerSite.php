<?php

class MarkerSite extends Eloquent
{
    protected $table = 'atlas';
    protected $fillable = array('id',
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
                            'openmrs_version',
                            'show_counts',
                            'created_by',
                            'distribution',
                            'data',
                            'atlas_version'
                        );

    public $timestamps = false;
    public $incrementing = false;
}
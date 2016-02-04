<?php

class Audit extends Eloquent
{
    protected $table = 'archive';
    protected $fillable = array('site_uuid',
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
                                'openmrs_version',
                                'show_counts',
                                'created_by',
                                'changed_by',
                                'archive_date',
                                'action',
                                'distribution_name',
                                'data',
                                'atlas_version');
    public $timestamps = false;
    public $incremental = false;
}
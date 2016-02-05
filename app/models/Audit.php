<?php

class Audit extends Eloquent
{
    //TODO: The table name is archive because of legacy reasons. Its playing role of capturing audit log.
    //TODO:To refactor, 'archive' needs to be changed at every place where it has been referenced.
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
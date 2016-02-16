<?php
/*
|--------------------------------------------------------------------------
| Config File Sample
|--------------------------------------------------------------------------
|
| File should be renamed to .env.production.php or .env.local.php .
|
*/
return array(

    /* Database Connection */
    // data source name
    'DB_DNS' => 'mysql:host=localhost;dbname=atlas',
    'DB_HOST' => 'localhost',
    'DB_NAME' => 'atlas',
    //mysql server charset  (character_set_server)
    'DB_CHARSET' => 'utf8',
    //mysql server collation  (collation_server)
    'DB_COLLATION' => 'utf8_general_ci',
    // database credentials
    'DB_USERNAME' => 'user',
    'DB_PASSWORD' => 'password',

    //Timezone
    'TIMEZONE' => 'UTC',
    /* Ping Configuration */
    // needed to delete an entry
    'PING_DELETE_SECRET' => 'secret',
    /* API Key for ID Auth */
    'API_KEY' => '1234567890abcdef',
    'SITE_KEY' => 'localhost',
    'ID_HOST' => 'http://localhost:3000',
    /* PhantomJS bin path */
    'PHANTOM_PATH' => '/usr/bin/phantomjs',
    /* Site URL */
    'SITE_URL' => 'http://localhost/openmrs-contrib-atlas/public/',

);
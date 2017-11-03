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
    'DB_DNS' => 'mysql:host=getenv(DB_HOST);dbname=getenv(DB_NAME)',
    'DB_HOST' => getenv('DB_HOST'),
    'DB_NAME' => getenv('DB_NAME'),
    //mysql server charset  (character_set_server)
    'DB_CHARSET' => 'utf8',
    //mysql server collation  (collation_server)
    'DB_COLLATION' => 'utf8_general_ci',
    // database credentials
    'DB_USERNAME' => getenv('DB_USERNAME'),
    'DB_PASSWORD' => getenv('DB_PASSWORD'),

    //Timezone
    'TIMEZONE' => getenv('TIME_ZONE'),
    /* Ping Configuration */
    // needed to delete an entry
    'PING_DELETE_SECRET' => getenv('PING_DELETE_SECRET'),
    /* API Key for ID Auth */
    'API_KEY' => getenv('API_KEY'),
    'SITE_KEY' => getenv('SITE_KEY'),
    'ID_HOST' => getenv('ID_HOST'),
    /* PhantomJS bin path */
    'PHANTOM_PATH' => '/usr/local/bin/phantomjs',
    /* Site URL */
    'SITE_URL' => getenv('SITE_URL'),

);

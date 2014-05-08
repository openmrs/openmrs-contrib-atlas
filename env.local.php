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
    // database credentials
    'DB_USERNAME' => 'user',
    'DB_PASSWORD' => 'password',
    
    /* Ping Configuration */
    // needed to delete an entry
    'PING_DELETE_SECRET' => 'secret'
    
);
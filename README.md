OpenMRS Atlas Server 2.0
=====================

OpenMRS Atlas Module lets implementations create and manage their bubble on the OpenMRS Atlas
For instructions on how to use the module, see the Atlas Module wiki page.

Altas Server 2.0 has been refactored with Laravel PHP Framework.

#Installation

## Server requirement
Atlas server can be deployed on Apache or Nginx server. 
### Apache configuration (Ubuntu > 13.04)
Mcrypt extension and mod-rewrite module are required

## Project configuration

#### Install dependencies with Composer
```
# Get Composer
curl -sS https://getcomposer.org/installer | php
# Install vendors and dependencies
php composer.phar install
# Add writing write for server to app/storage (www-data for Apache)
sudo chown -R www-data:www-data app/storage

Let(s started ! 

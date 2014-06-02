OpenMRS Atlas Server 2.0
=====================

OpenMRS Atlas Module lets implementations create and manage their bubble on the OpenMRS Atlas
For instructions on how to use the module, see the Atlas Module wiki page.

Altas Server 2.0 has been refactored with Laravel PHP Framework.

#Installation
## Server requirement
Atlas server can be deployed on Apache or Nginx server. 
### Apache configuration (and Ubuntu > 13.04)
**Mcrypt** extension and **mod-rewrite** module are required
**mysql driver** for php may be required
```sh
# Install mcrypt
sudo apt-get install php5-mcrypt php5-mysql
sudo ln -s /etc/php5/conf.d/mcrypt.ini /etc/php5/apache2/conf.d/20-mcrypt.ini
sudo php5enmod mcrypt

edit /etc/php5/apache2/php.ini and add extension=mcrypt.so

# Activate mod_rewrite
sudo a2enmod rewrite

# Restart Apche
sudo service apache2 restart
```
## Project configuration

### Install dependencies with Composer
```sh
# Clone the repo
# Get Composer
cd path/to/atlas
curl -sS https://getcomposer.org/installer | php

# Install vendors and dependencies
php composer.phar install
```

### Install PhantomJS
```sh

# Download phantomJS tarbal
wget https://bitbucket.org/ariya/phantomjs/downloads/phantomjs-1.9.7-linux-x86_64.tar.bz2
tar -xvf phantomjs-1.9.7-linux-x86_64.tar.bz2
sudo cp phantomjs-1.9.7-linux-x86_64/bin/phantomjs /usr/bin/
sudo chmod a+x /usr/bin/phantomjs

# Install fonts
sudo apt-get install fontconfig freetype
sudo apt-get install xfonts-100dpi xfonts-75dpi xfonts-scalable xfonts-cyrillic
sudo apt-get install ttf-mscorefonts-installer

```

### Configure you envrionnement

- Add writting rights to app/storage (www-data for Apache)

`sudo chown -R www-data:www-data app/storage`

 - Rename `env.local.php` to `.env.prod.php` and edit it with your own configuration (database, site_url, phantomJS bin, openmrs id secret).

 - Set correct hostame in `bootstrap/start.php` 
```php
$env = $app->detectEnvironment(array(
   'local' => array('dev_host'),
   'prod' => array('production_hostame'),
));
```
### Register CronJob

´´´sh
crontab -e

#Add this line:
*/10 * * * * /usr/bin/php /var/www/openmrs-contrib-atlas/artisan screen-capture
´´´

Let's started ! 

## Directory Description
- `public/` : images, css, and js files 
- `app/views/` : ping.php, index.php, data.php 
- `app/controllers/` : controllers (not yet used)
- `app/routes.php` : routing config


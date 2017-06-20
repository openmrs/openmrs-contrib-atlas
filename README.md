OpenMRS Atlas Server 2.2
========================

OpenMRS Atlas Module lets implementations create and manage their bubble on the OpenMRS Atlas.
For instructions on how to use the module, see the Atlas Module wiki page.

Altas Server 2.0 has been refactored with Laravel PHP Framework.

#Installation
## Server requirement
- Apache2
- Mysql
- PHP >= 5.4, php5-mcypt, php5-mysql
- url rewriting and mod_rewrite enabled on Apache
- PhantomJS >= 1.9.7 (require : libicu48, fontconfig, mscorefont)
- Composer

### Apache configuration (and Ubuntu > 13.04)
**Mcrypt** extension and **mod-rewrite** module are required
**mysql driver** for php may be required
```sh
# Install mcrypt and mysql php ext (if needed)
sudo apt-get install php5-mcrypt php5-mysql
sudo ln -s /etc/php5/conf.d/mcrypt.ini /etc/php5/apache2/conf.d/20-mcrypt.ini
sudo php5enmod mcrypt
edit /etc/php5/apache2/php.ini and add extension=mcrypt.so

# Activate mod_rewrite (if needed)
sudo a2enmod rewrite

# Configure Virtual Host
# DocumentRoot to public/ folder
# and AllowOverride All directive

DocumentRoot /opt/atlas/public

<Directory /opt/atlas/public/>
   Options Indexes FollowSymLinks MultiViews
   AllowOverride All
   Order allow,deny
   allow from all
</Directory>

# Restart Apache
sudo service apache2 restart
```
## Project configuration

### Install dependencies with Composer
```sh
# Clone the repo
git clone https://github.com/openmrs/openmrs-contrib-atlas.git /opt/atlas
cd /opt/atlas

# Install vendors and dependencies
composer install

# If Composer is not in PATH
curl -sS https://getcomposer.org/installer | php
php composer.phar install
```
### Configure you environment

- Add writting rights to app/storage (www-data for Apache)

```sh
sudo chown -R www-data:www-data app/storage
sudo chmod -R ug+rw app/storage
```

 - Rename `env.local.php` to `.env.prod.php` and edit it with your own configuration (database, site_url, phantomJS bin, openmrs id secret).

 - Set correct prod hostame in `bootstrap/start.php`  - :warning: It should be the same value as `hostname` UNIX command.

```php
$env = $app->detectEnvironment(array(
   'local' => array('dev_host'),
   'prod' => array('prod_hostame'),
));
```
 - Set correct server Timezone in .env.prod.php (ie. America/New_York)
```php
 'TIMEZONE' => 'America/New_York',
```
 - Set correct mysql server charset and collation in .env.prod.php (ie. latin1 & latin1_swedish_ci)
```sh
# To show the correct value:
mysql> SHOW VARIABLES LIKE 'character\_set\_%';
```

### Install PhantomJS
```sh
# Download latest phantomJS tarbal
wget https://bitbucket.org/ariya/phantomjs/downloads/phantomjs-1.9.7-linux-x86_64.tar.bz2
tar -xvf phantomjs-1.9.7-linux-x86_64.tar.bz2
sudo cp phantomjs-1.9.7-linux-x86_64/bin/phantomjs /usr/bin/
sudo chmod a+x /usr/bin/phantomjs

# Install libicu48 and fonts
sudo apt-get install libicu48
sudo apt-get install fontconfig freetype
sudo apt-get install xfonts-100dpi xfonts-75dpi xfonts-scalable xfonts-cyrillic
sudo apt-get install ttf-mscorefonts-installer

# add PhantomJS path in .env.prod.php
```

### Register screen capture cron job
```sh
crontab -u www-data -e

#And add this line to end of file:
0 * * * * /usr/bin/php /var/www/openmrs-contrib-atlas/artisan screen-capture
```
### Init Database
- Seed atlas database with sql dump
- Sync with latest schema using Laravel CLI - :warning: rw required to storage/
```
cd /opt/atlas
# User that executes artisan command should has writing rights to storage/ folder
su www-data
php artisan migrate
```
### Create first screen captures
`php artisan screen-capture --force`

# To add a new distribution option to distribution dropdown list
1. create a new migration using "migrate:make" command.
2. Add the name of new distribution and set is_standard to true.
    for reference see this file "app/database/migrations/2016_02_17_170405_insert_distributions.php"


Let's started !

## Directory Description
- `public/` : images, css, and js files
- `app/views/` : blade template and views
- `app/controllers/` : controllers
- `app/storage/` : logs, sessions, ...
- `app/routes.php` : routing config
- `app/filters.php` : routing filters


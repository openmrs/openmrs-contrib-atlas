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

### Configure you envrionnement

- Add writting rights to app/storage (www-data for Apache)


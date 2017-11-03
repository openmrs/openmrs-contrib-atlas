FROM ubuntu:16.04
ENV APP_ROOT=/var/www/html/atlas
ENV PHANTOM_JS=phantomjs-2.1.1-linux-x86_64

RUN apt-get update \
  && apt-get install -y apache2 composer curl php7.0 php7.0-mbstring  php7.0-curl \
     php7.0-json php7.0-soap php7.0-xml  php7.0-xsl php7.0-zip libapache2-mod-php php7.0-mcrypt php7.0-mysql \
     libfreetype6 libfreetype6-dev libfontconfig1 libfontconfig1-dev \
  && mkdir ${APP_ROOT}

ADD ../ /var/www/html/atlas
ADD https://bitbucket.org/ariya/phantomjs/downloads/${PHANTOM_JS}.tar.bz2 ${PHANTOM_JS}.tar.bz2

RUN && tar -xvjf ${PHANTOM_JS}.tar.bz2 \
  && mv ${PHANTOM_JS} /usr/local/share/phantomjs \
  && ln -sf /usr/local/share/phantomjs/bin/phantomjs /usr/local/bin/ \
  && chown -R www-data:www-data ${APP_ROOT}/app/storage \
  && chmod -R ug+rw ${APP_ROOT}/app/storage \
  && sed -i s/atlas-server/localhost/g ${APP_ROOT}/bootstrap/start.php

COPY ./config/000-default.conf /etc/apache2/sites-available/000-default.conf
COPY ./config/.env.local.php ${APP_ROOT}
COPY ./config/init-script.sh /usr/bin/

RUN phpenmod mysqli mcrypt \
  && a2enmod rewrite \
  && chmod +x /usr/bin/init-script.sh \
  && echo "ServerName localhost" | tee /etc/apache2/conf-available/fqdn.conf \
  && a2enconf fqdn \
  && rm ${PHANTOM_JS}.tar.bz2 \
  && rm /tmp/atlas.tar.gz \
  && rm /var/www/html/index.html \
  && rm -r ${APP_ROOT}/.git* || echo ".git Doesnot exist" \
  && rm -r ${APP_ROOT}/docker || echo "No Docker Here :D"

WORKDIR ${APP_ROOT}
EXPOSE 80
CMD ["/usr/bin/init-script.sh"]

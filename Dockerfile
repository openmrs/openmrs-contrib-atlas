FROM node:carbon

RUN apt-get update \
    && apt-get install -y apt-utils \
    && { \
        echo debconf debconf/frontend select Noninteractive; \
        echo mysql-community-server mysql-community-server/data-dir \
            select ''; \
        echo mysql-community-server mysql-community-server/root-pass \
            password '123'; \
        echo mysql-community-server mysql-community-server/re-root-pass \
            password '123'; \
        echo mysql-community-server mysql-community-server/remove-test-db \
            select true; \
    } | debconf-set-selections \
    && apt-get install -y mysql-server

# Ensure we won't bind to localhost only
RUN grep -v bind-address /etc/mysql/my.cnf > temp.txt \
  && mv temp.txt /etc/mysql/my.cnf

# It doesn't seem needed since I'll use -p, but it can't hurt
EXPOSE 3306

CMD /etc/init.d/mysql start && tail -F /var/log/mysql.log

# Create app directory
WORKDIR /home/ayush/WebstormProjects/Atlas/openmrs-contrib-atlas/

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

RUN npm install --only=production
# If you are building your code for production
# RUN npm install --only=production

# Bundle app source
COPY . .

EXPOSE 3001
CMD service mysql start &&  bash script.sh && mysql -u root atlas < ./f15353ca4bdbb0677b049d4ab1555cdf/atlas.sql && npm run start

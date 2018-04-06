# openmrs-contrib-atlas-node

[![OpenMRS Talk](https://omrs-shields.psbrandt.io/custom/openmrs/talk/F26522?logo=openmrs)](https://talk.openmrs.org/c/projects/atlas) [![OpenMRS IRC](https://img.shields.io/badge/openmrs-irc-EEA616.svg?logo=data%3Aimage%2Fsvg%2Bxml%3Bbase64%2CPHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2MTIiIGhlaWdodD0iNjEyIiB2aWV3Qm94PSIwIDAgNjEyIDYxMiI%2BPHBhdGggZD0iTTE1MyAyMjkuNWMtMjEuMTMzIDAtMzguMjUgMTcuMTE3LTM4LjI1IDM4LjI1UzEzMS44NjcgMzA2IDE1MyAzMDZjMjEuMTE0IDAgMzguMjUtMTcuMTE3IDM4LjI1LTM4LjI1UzE3NC4xMzMgMjI5LjUgMTUzIDIyOS41em0xNTMgMGMtMjEuMTMzIDAtMzguMjUgMTcuMTE3LTM4LjI1IDM4LjI1UzI4NC44NjcgMzA2IDMwNiAzMDZjMjEuMTE0IDAgMzguMjUtMTcuMTE3IDM4LjI1LTM4LjI1UzMyNy4xMzMgMjI5LjUgMzA2IDIyOS41em0xNTMgMGMtMjEuMTMzIDAtMzguMjUgMTcuMTE3LTM4LjI1IDM4LjI1UzQzNy44NjcgMzA2IDQ1OSAzMDZzMzguMjUtMTcuMTE3IDM4LjI1LTM4LjI1UzQ4MC4xMzMgMjI5LjUgNDU5IDIyOS41ek0zMDYgMEMxMzcuMDEyIDAgMCAxMTkuODc1IDAgMjY3Ljc1YzAgODQuNTE0IDQ0Ljg0OCAxNTkuNzUgMTE0Ljc1IDIwOC44MjZWNjEybDEzNC4wNDctODEuMzRjMTguNTUyIDMuMDYyIDM3LjYzOCA0Ljg0IDU3LjIwMyA0Ljg0IDE2OS4wMDggMCAzMDYtMTE5Ljg3NSAzMDYtMjY3Ljc1UzQ3NS4wMDggMCAzMDYgMHptMCA0OTcuMjVjLTIyLjMzOCAwLTQzLjkxLTIuNi02NC42NDMtNy4wMmwtOTAuMDQgNTQuMTI0IDEuMjA0LTg4LjdDODMuNSA0MTQuMTMzIDM4LjI1IDM0NS41MTMgMzguMjUgMjY3Ljc1YzAtMTI2Ljc0IDExOS44NzUtMjI5LjUgMjY3Ljc1LTIyOS41czI2Ny43NSAxMDIuNzYgMjY3Ljc1IDIyOS41UzQ1My44NzUgNDk3LjI1IDMwNiA0OTcuMjV6IiBmaWxsPSIjZmZmIi8%2BPC9zdmc%2B)](http://irc.openmrs.org) [![OpenMRS Telegram](https://img.shields.io/badge/openmrs-telegram-009384.svg?logo=data%3Aimage%2Fsvg%2Bxml%3Bbase64%2CPHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNDAgMjQwIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImEiIHgxPSIuNjY3IiB5MT0iLjE2NyIgeDI9Ii40MTciIHkyPSIuNzUiPjxzdG9wIHN0b3AtY29sb3I9IiMzN2FlZTIiIG9mZnNldD0iMCIvPjxzdG9wIHN0b3AtY29sb3I9IiMxZTk2YzgiIG9mZnNldD0iMSIvPjwvbGluZWFyR3JhZGllbnQ%2BPGxpbmVhckdyYWRpZW50IGlkPSJiIiB4MT0iLjY2IiB5MT0iLjQzNyIgeDI9Ii44NTEiIHkyPSIuODAyIj48c3RvcCBzdG9wLWNvbG9yPSIjZWZmN2ZjIiBvZmZzZXQ9IjAiLz48c3RvcCBzdG9wLWNvbG9yPSIjZmZmIiBvZmZzZXQ9IjEiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48Y2lyY2xlIGN4PSIxMjAiIGN5PSIxMjAiIHI9IjEyMCIgZmlsbD0idXJsKCNhKSIvPjxwYXRoIGZpbGw9IiNjOGRhZWEiIGQ9Ik05OCAxNzVjLTMuODg4IDAtMy4yMjctMS40NjgtNC41NjgtNS4xN0w4MiAxMzIuMjA3IDE3MCA4MCIvPjxwYXRoIGZpbGw9IiNhOWM5ZGQiIGQ9Ik05OCAxNzVjMyAwIDQuMzI1LTEuMzcyIDYtM2wxNi0xNS41NTgtMTkuOTU4LTEyLjAzNSIvPjxwYXRoIGZpbGw9InVybCgjYikiIGQ9Ik0xMDAuMDQgMTQ0LjQxbDQ4LjM2IDM1LjczYzUuNTIgMy4wNDQgOS41IDEuNDY3IDEwLjg3Ni01LjEyNGwxOS42ODUtOTIuNzYzYzIuMDE2LTguMDgtMy4wOC0xMS43NDYtOC4zNTgtOS4zNWwtMTE1LjU5IDQ0LjU3MmMtNy44OSAzLjE2NS03Ljg0NCA3LjU2Ny0xLjQ0IDkuNTI4bDI5LjY2NCA5LjI2IDY4LjY3My00My4zMjZjMy4yNC0xLjk2NiA2LjIxNy0uOTEgMy43NzUgMS4yNTgiLz48L3N2Zz4%3D)](https://telegram.me/openmrs) [![devDependencies Status](https://david-dm.org/alanshaw/david-www/dev-status.svg)](https://david-dm.org/alanshaw/david-www?type=dev) [![Dependencies Status](https://david-dm.org/ShekharReddy4/openmrs-contrib-atlas-node.svg)](https://github.com/ShekharReddy4/openmrs-contrib-atlas-node/blob/master/package.json)

<img style="float: centre;" src="https://shekharreddykmit.files.wordpress.com/2016/08/atlas1.png" alt = "OpenMRS"/>

# OpenMRS Atlas 3.0
- [Description](#description)
- [Setting Up](#setting-up)
- [Code Structure](#code-structure)
- [Contribute](#contribute)
- [External Links](#external-links)

# Description

OpenMRS-contrib-atlas-node is the server code written in nodejs for [OpenMRS ATLAS](http://atlas.openmrs.org). This project includes migrating the server side code from PHP Laravel framework to Nodejs, Making the Backend RESTful and authenticating the app against OpenMRS ID

# Setting Up

## Prerequisite

- Install nodejs
- Install nodemon globally(if you need it)

    ```git
    npm install -g nodemon
    ```

## SetUp repo

- Clone the repo

   ```git
   $ git clone https://github.com/openmrs/openmrs-contrib-atlas.git
   $ cd openmrs-contrib-atlas-node
   $ git checkout 3.x
   ```

- Install the dependencies

   ```git
   npm install
   ```

## Running

### Running Locally

  - Install MySQL
  - Create a database

      ```mysql
      mysql> CREATE DATABASE atlasdb;
      ```

  - Switch to the 'atlasdb' database

      ```mysql
      mysql> USE atlasdb;
      ```
  - Run the sql script file (Note: there are multiple ways to run sql script file )

      * WINDOWS OS

          ```mysql
          mysql> SOURCE : db/bootstrap.sql
          ```

      * UBUNTU OS

          * Navigate to the directory where in sql file exists, in terminal

            ```
              $ mysql -u uname -p dbname < db/bootstrap.sql;
            ```
  - create environment variables in your bash
      ```sh
        export DB_HOST='localhost'
        export DB_USERNAME='root'
        export DB_PASSWORD='root'
        export DB_NAME='atlasdb'
        ```
  - Navigate to the project root directory and run the nodemon

      ```git
      $ nodemon
      ```

  - Fire up your browser to check http://localhost:3000

### Running using docker
  - Install docker and docker-compose
```
$ docker-compose build
$ docker-compose up
```
  - Fire up your browser to check http://localhost:3000

To stop:
```
ctrl+c
# docker-compose down -v
```

### Code Structure

<table>
 <tr>
  <td>public/</td>
  <td>This directory contains js,css,images and lib files</td>
 </tr>
 <tr>
  <td>routes/</td>
  <td>Contains all the routes</td>
 </tr>
 <tr>
  <td>views/</td>
  <td>Contains all the front end code </td>
 </tr>
 <tr>
  <td>bin/www.js</td>
  <td>Contains the script for creating and running the http server</td>
 </tr>
 <tr>
  <td>app.js</td>
  <td> Creates an express app and holds all the middleware e.g auth middleware </td>
 </tr>
  <td>package.json</td>
  <td>Manifest file used to manage project dependencies.</td>
 </tr>
</table>

### Contribute

1. Fork the repo.

2. Clone the fork to your machine.

3. Make changes in required files, reload the browser to verify the changes.

4. Squash the commits and Create a pull request.

### External Links and Useful Resources

- [Nodejs](https://nodejs.org/en/)
- [nodemon](https://www.npmjs.com/package/nodemon)
- [My Blog](https://shekharreddykmit.wordpress.com/)
- [Talk Thread](https://talk.openmrs.org/t/atlas-3-0-project/6540)
- [Awesome Nodejs](https://github.com/sindresorhus/awesome-nodejs)

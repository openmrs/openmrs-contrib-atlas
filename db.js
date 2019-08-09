var mysql = require('mysql');
var logger = require('log4js').getLogger();
logger.level = 'debug';

// set the mysql properties
var connection = mysql.createConnection({

    //set the variables as per your db credentials
    host     : process.env.DB_HOST || 'db' ,
    user     : process.env.DB_USERNAME || 'atlas' ,
    password : process.env.DB_PASSWORD || 'iamatlas' ,
    database : process.env.DB_NAME || 'atlasdb'
});

//get the connection
connection.connect(function (error) {
    if(!!error){
        logger.error(error);
    }else{
        logger.debug('Connected to MySQL database');
    }
});

module.exports = connection;

var mysql = require('mysql');

// set the mysql properties
var connection = mysql.createConnection({
    
    //set the variables as per your db credentials
    host     : 'db' ,
    user     : 'atlas' ,
    password : 'iamatlas' ,
    database : 'atlasdb'
});

//get the connection
connection.connect(function (error) {
    if(!!error){
        console.log(error);
    }else{
        console.log('connected');
    }
});

module.exports = connection;

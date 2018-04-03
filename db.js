var mysql = require('mysql');

// set the mysql properties
var connection = mysql.createConnection({
    
    //set the variables as per your db credentials
    host     : '127.0.0.1',
    user     : 'root',
    database : 'atlas'
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

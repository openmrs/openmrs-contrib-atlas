var express = require('express');
var router = express.Router();

module.exports = function(connection) {
    /* GET all the versions */
    router.get('/versions', function(req, res, next) {

        connection.query("SELECT * FROM versions", function (error, rows, field) {
            if(!!error){
                console.log(error);
            }
            else{
                res.setHeader('Content-Type', 'application/json');
                res.json(rows);
            }
        });
    });
    return router;
};

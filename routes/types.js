var express = require('express');
var router = express.Router();

module.exports = function(connection) {
    /* GET all the types */
    router.get('/types', function(req, res, next) {

        connection.query("SELECT * FROM types", function (error, rows, field) {
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

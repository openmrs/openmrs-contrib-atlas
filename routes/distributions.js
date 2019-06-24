var express = require('express');
var router = express.Router();
var utils = require('../utils.js');

module.exports = function(connection) {
    /* GET all the distributions */
    router.get('/distributions', function(req, res, next) {

        connection.query("SELECT * FROM distributions", function (error, rows, field) {
            if(!!error){
                console.log(error);
            }
            else{
                //var data  = JSON.stringify(rows);
                res.setHeader('Content-Type', 'application/json');
                res.json(rows);
            }
        });
    });

    /* GET a specific distribution with id */
    router.get('/distribution/:id', function(req, res, next) {

        var id=req.params['id'];

        connection.query("SELECT * FROM distributions WHERE id=?", [id], function (error, rows, field) {
            if(!!error){
                console.log(error);
            }
            else{
                //var data  = JSON.stringify(rows);
                res.setHeader('Content-Type', 'application/json');
                res.json(rows);
            }
        });
    });

    /* Create new distribution */
    router.post('/distribution', utils.isAdmin, function (req, res, next) {
        req.body = JSON.parse(Object.keys(req.body)[0]);
        var name = req.body.name;
        var is_standard = req.body.is_standard;

        connection.query('INSERT INTO distributions(name,is_standard) VALUES(?,?)', [name,is_standard], function (error, rows,field) {
            if(!!error){
                console.log(error);
            }
            else {
                res.setHeader('Content-Type', 'application/json');
                res.json(id);
            }
        });
    });

    /* Update distribution */
    router.patch('/distribution/:id', utils.isAdmin, function (req, res, next) {
        req.body = JSON.parse(Object.keys(req.body)[0]);
        var id = req.params['id'];
        var name = req.body.name;
        var is_standard = req.body.is_standard;

        connection.query('update distributions set name=?, is_standard=? where id=?', [name,is_standard,id], function (error, rows,field) {
            if(!!error){
                console.log(error);
            }
            else {
                res.setHeader('Content-Type', 'application/json');
                res.json(id);
            }
        });
    });

    /* Delete distribution with given id */
    router.delete('/distribution/:id', utils.isAdmin, function(req, res, next) {

        var id=req.params['id'];

        connection.query('DELETE FROM distributions WHERE id =?', [id], function (error, rows,field) {
            if(!!error){
                console.log(error);
            }
            else {
                res.setHeader('Content-Type', 'application/json');
                res.json(id);
            }
        });
    });        
    
    return router;
};

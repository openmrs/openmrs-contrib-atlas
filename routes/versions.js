var express = require('express');
var router = express.Router();
var utils = require('../utils.js');

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

    /* GET a specific version with id */
    router.get('/version/:id', function(req, res, next) {

        var id=req.params['id'];

        connection.query("SELECT * FROM versions WHERE id=?", [id], function (error, rows, field) {
            if(!!error){
                console.log(error);
            }
            else{
                res.setHeader('Content-Type', 'application/json');
                res.json(rows);
            }
        });
    });
    
    /* Create new version */
    router.post('/version', utils.isAdmin, function (req, res, next) {
        req.body = JSON.parse(Object.keys(req.body)[0]);
        var version = req.body.version;

        connection.query('insert into versions(version) values (?)', [version], function (error, rows,field) {
            if(!!error){
                console.log(error);
            }
            else {
                res.setHeader('Content-Type', 'application/json');
                res.json(rows.id);
            }
        });
    });

    /* Update version with given id */
    router.patch('/version/:id', utils.isAdmin, function (req, res, next) {
        req.body = JSON.parse(Object.keys(req.body)[0]);
        var id = req.params['id'];
        var version = req.body.version;

        connection.query('UPDATE versions SET version=? WHERE id =?', [version,id], function (error, rows,field) {
            if(!!error){
                console.log(error);
            }
            else {
                res.setHeader('Content-Type', 'application/json');
                res.json(id);
            }
        });
    });

    /* Delete version with given id */
    router.delete('/version/:id', utils.isAdmin, function(req, res, next) {

        var id=req.params['id'];

        connection.query('DELETE FROM version WHERE id =?', [id], function (error, rows,field) {
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

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
        var version = req.body.version;

        connection.query('insert into versions(version) values (?)', [version], function (error, rows,field) {
            if(!!error){
                console.log(error);
            }
            else {
                res.setHeader('Content-Type', 'application/json');
                var json = req.body;
                json.id = rows.insertId;
                res.json(json);
            }
        });
    });

    /* Update version with given id */
    router.patch('/version/:id', utils.isAdmin, function (req, res, next) {
        var id = req.params['id'];
        var version = req.body.version;

        connection.query('UPDATE versions SET version=? WHERE id =?', [version,id], function (error, rows,field) {
            if(error) {
                console.log(error);
            } else {
                connection.query('SELECT * FROM versions WHERE id =?', [id], function (error, rows,field) {
                    if(!!error){
                        console.log(error);
                    }
                    else {
                        res.setHeader('Content-Type', 'application/json');
                        res.json(rows[0]);
                    }
                });    
            }
        });
    });

    /* Delete version with given id */
    router.delete('/version/:id', utils.isAdmin, function(req, res, next) {

        var id=req.params['id'];

        connection.query('SELECT * FROM versions WHERE id =?', [id], function (error, rows,field) {
            if(error) {
                console.log(error);
            } else {
                var data = rows[0];
                connection.query('DELETE FROM versions WHERE id =?', [id], function (error, rows,field) {
                    if(!!error){
                        console.log(error);
                    }
                    else {
                        res.setHeader('Content-Type', 'application/json');
                        res.json(data);
                    }
                });
            }
        });    
    });

    return router;
};

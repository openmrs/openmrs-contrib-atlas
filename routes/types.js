var express = require('express');
var router = express.Router();
var utils = require('../utils.js');

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

    /* GET a specific type with id */
    router.get('/type/:id', function(req, res, next) {

        var id=req.params['id'];

        connection.query("SELECT * FROM types WHERE id=?", [id], function (error, rows, field) {
            if(!!error){
                console.log(error);
            }
            else{
                res.setHeader('Content-Type', 'application/json');
                res.json(rows);
            }
        });
    });

    /* Create new type */
    router.post('/type', utils.isAdmin, function (req, res, next) {
        req.body = JSON.parse(Object.keys(req.body)[0]);
        var name = req.body.name;
        var icon = req.body.icon;


        connection.query('INSERT INTO types(name,icon) VALUES(?,?)', [name,icon], function (error, rows,field) {
            if(!!error){
                console.log(error);
            }
            else {
                res.setHeader('Content-Type', 'application/json');
                res.json(id);
            }
        });
    });
    
    /* Update type with given id */
    router.patch('/type/:id', utils.isAdmin, function (req, res, next) {
        req.body = JSON.parse(Object.keys(req.body)[0]);
        var id = req.params['id'];
        var name = req.body.name;
        var icon = req.body.icon;


        connection.query('UPDATE types SET name=?, icon=? WHERE id =?', [name,icon,id], function (error, rows,field) {
            if(!!error){
                console.log(error);
            }
            else {
                res.setHeader('Content-Type', 'application/json');
                res.json(id);
            }
        });
    });

    /* Delete type with given id */
    router.delete('/type/:id', utils.isAdmin, function(req, res, next) {

        var id=req.params['id'];

        connection.query('DELETE FROM types WHERE id =?', [id], function (error, rows,field) {
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

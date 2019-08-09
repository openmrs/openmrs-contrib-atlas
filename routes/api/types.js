var express = require('express');
var router = express.Router();
var utils = require('../../utils.js');
var logger = require('log4js').getLogger();
logger.level = 'debug';

module.exports = function(connection) {
    /* GET all the types */
    router.get('/types', function(req, res, next) {

        connection.query("SELECT * FROM types", function (error, rows, field) {
            if(!!error){
                logger.error(error);
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
                logger.error(error);
            }
            else{
                res.setHeader('Content-Type', 'application/json');
                res.json(rows);
            }
        });
    });

    /* Create new type */
    router.post('/type', utils.isAdmin, function (req, res, next) {
        var name = req.body.name;
        var icon = req.body.icon;


        connection.query('INSERT INTO types(name,icon) VALUES(?,?)', [name,icon], function (error, rows,field) {
            if(!!error){
                logger.error(error);
            }
            else {
                res.setHeader('Content-Type', 'application/json');
                var json = req.body;
                json.id = rows.insertId;
                res.json(json);
            }
        });
    });
    
    /* Update type with given id */
    router.patch('/type/:id', utils.isAdmin, function (req, res, next) {
        var id = req.params['id'];
        var name = req.body.name;
        var icon = req.body.icon;


        connection.query('UPDATE types SET name=?, icon=? WHERE id =?', [name,icon,id], function (error, rows,field) {
            if(!!error){
                logger.error(error);
            }
            else {
                connection.query('SELECT * FROM types WHERE id =?', [id], function (error, rows,field) {
                    if(error) {
                        logger.error(error);
                    } else {
                        res.setHeader('Content-Type', 'application/json');
                        res.json(rows[0]);        
                    }
                });
            }
        });
    });

    /* Delete type with given id */
    router.delete('/type/:id', utils.isAdmin, function(req, res, next) {

        var id=req.params['id'];

        connection.query('SELECT * FROM types WHERE id =?', [id], function (error, rows,field) {
            if(error) {
                logger.error(error);
            } else {
                var data = rows[0];
                connection.query('DELETE FROM types WHERE id =?', [id], function (error, rows,field) {
                    if(!!error){
                        logger.error(error);
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

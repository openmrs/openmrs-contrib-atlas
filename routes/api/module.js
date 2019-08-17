var express = require('express');
var router = express.Router();
var utils = require('../../utils');
var bcrypt = require('bcrypt');
var logger = require('log4js').getLogger();
logger.level = 'debug';

module.exports = function(connection) {

    var show_counts_query = "SELECT id,latitude,longitude,name,url,type, \
    IF(image is not null, concat(?,'://',?,'/marker/',id,'/image'), null) AS image_url, \
    show_counts,patients,encounters,observations,contact,email,notes,data,openmrs_version,distribution,date_created,date_changed,created_by FROM atlas";

    /* Add marker update rights for module */
    router.post('/module/auth', utils.isAuthenticated, function (req, res, next) {

        var module_id=req.session.module_id;
        var token=req.session.module_token;
        var atlas_id=req.body.atlas_id;

        if(!utils.isUUID(module_id) || !utils.isUUID(token) || !utils.isUUID(atlas_id)) {
            return res.send(400);
        }

        connection.query('SELECT * FROM auth WHERE principal=? AND atlas_id=? AND (privileges=? OR privileges=?)', [req.session.user.uid,atlas_id,"UPDATE","ALL"], function (error, rows, field) {
                
            if(!!error){
                logger.error(error);
            } else if (rows && rows.length > 0) {

                connection.query('DELETE FROM auth WHERE principal=?', [module_id], function (error, rows, field) {

                    if(error) {
                        logger.error(error);
                    } else {
                        utils.hashToken(token).then(function(token) {
                            connection.query('INSERT INTO auth(atlas_id,principal,token,privileges) VALUES(?,?,?,?)', [atlas_id,module_id,token,"UPDATE"], function (error, rows, field) {
                                if(!!error){
                                    logger.error(error);
                                } else {
                                    res.setHeader('Content-Type', 'application/json');
                                    res.json({ id: rows.insertId, atlas_id: atlas_id, principal: "module", privileges: "UPDATE", expires: null });           
                                }
                            });                                
                        });        
                    }
                });
            } else {
                res.send(401);
            }
        });
    });

    router.post(['/module/ping', '/module/ping.php'], function(req, res, next) {
        var module_id=req.body.id;
        var token=req.body.token;
        if(!utils.isUUID(module_id) || !utils.isUUID(token)) {
            return res.send(400);
        }

        connection.query('SELECT * FROM auth WHERE principal=? AND privileges=?', [module_id,"UPDATE"], function (error, rows, field) {
            if(!!error){
                logger.error(error);
            } else if(rows && rows.length > 0) {

                bcrypt.compare(token, rows[0].token, function(err, resp) {

                    if(!resp) return res.send(401);

                    var patients=req.body.patients;
                    var observations=req.body.observations;
                    var encounters=req.body.encounters;
                    var data=req.body.data;
                    var date_changed=new Date();
                    var openmrs_version=data.version;
                    data=JSON.stringify(data);

                    if(!patients || patients === '') patients = 0;
                    if(!observations || observations === '') observations = 0;
                    if(!encounters || encounters === '') encounters = 0;
            
                    connection.query('UPDATE atlas SET patients=?,observations=?,encounters=?,data=?,date_changed=?,openmrs_version=? WHERE id=?', [patients,observations,encounters,data,date_changed,openmrs_version,rows[0].atlas_id], function (error, rows, field) {
                        if(!!error){
                            logger.error(error);
                        } else {
                            res.setHeader('Content-Type', 'application/json');
                            res.send(req.body);
                        }
                    });
                });
            } else {
                res.send(401);
            }
        });
    });

    /* Get marker related to module */
    router.delete('/module/auth',  utils.isAuthenticated, function (req, res, next) {

        var module_id=req.session.module_id;
        var token=req.session.module_token;
        if(!utils.isUUID(module_id) || !utils.isUUID(token)) {
            return res.send(400);
        }

        connection.query('SELECT * FROM auth WHERE principal=?', [module_id], function (error, rows, field) {
            if(!!error){
                logger.error(error);
            } else if(rows && rows.length > 0) {
                var rule = rows[0];

                bcrypt.compare(token, rule.token, function(err, resp) {
                    if(!resp) return res.send(401);

                    connection.query('DELETE FROM auth WHERE principal=?', [module_id], function (error, rows, field) {
                        if(!!error){
                            logger.error(error);
                        } else {
                            res.setHeader('Content-Type', 'application/json');
                            delete rule.token;
                            res.json(rule);           
                        }
                    });
                });
            } else {
                res.send(404);
            }
        });
    });

    return router;
};
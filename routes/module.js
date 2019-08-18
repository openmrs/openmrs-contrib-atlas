var express = require('express');
var router = express.Router();
var util = require('util');
var utils = require('../utils');
var logger = require('log4js').getLogger();
logger.level = 'debug';

module.exports = function(connection) {

    const REQUEST_PROTOCOL = process.env.ATLAS_LINK_PROTOCOL || 'https';

    var show_counts_query = "SELECT id,latitude,longitude,name,url,type, \
    IF(image is not null, concat(?,'://',?,'/api/marker/',id,'/image'), null) AS image_url, \
    show_counts,patients,encounters,observations,contact,email,notes,data,openmrs_version,distribution,date_created,date_changed,created_by FROM atlas";

    router.get('/module', function(req, res, next) {
        res.redirect('/?module=true');
    });

    /* Get marker related to module */
    router.post('/module', function (req, res, next) {

        res.header('Access-Control-Allow-Origin', '*');

        var module_id=req.body.module_id;
        var token=req.body.token;
        if(!utils.isUUID(module_id) || !utils.isUUID(token)) {
            return res.send(400).send({ message: "Invalid module id or token" });
        }
        req.session.module_id=module_id;
        req.session.module_token=token;

        connection.query('SELECT * FROM auth WHERE principal=?', [module_id], function (error, rows, field) {
            if(!!error){
                logger.error(error);
                return res.status(500).send({ message: util.format(constants.DATABASE_ERROR_RESPONSE, new Date().toISOString().slice(0, 19).replace('T', ' ')) });
            } else if(rows && rows.length > 0) {
                connection.query(show_counts_query + ' WHERE id=?', [REQUEST_PROTOCOL, req.headers.host, rows[0].atlas_id], function (error, rows, field) {
                    if(!!error){
                        logger.error(error);
                        return res.status(500).send({ message: util.format(constants.DATABASE_ERROR_RESPONSE, new Date().toISOString().slice(0, 19).replace('T', ' ')) });
                    } else if(rows && rows.length > 0) {
                        res.setHeader('Content-Type', 'application/json');
                        delete rows[0].token;
                        res.json(rows[0]);           
                    } else {
                        res.status(404).send({ message: "Marker not found" });
                    }
                });
            } else {
                res.status(401).send({ message: "You are not authorized to update this marker" });
            }
        });
    });
    
    return router;
};
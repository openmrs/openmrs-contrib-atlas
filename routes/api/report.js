var express = require('express');
var router = express.Router();
var util = require('util');
var utils = require('../../utils.js');
var wc = require('which-country');
var logger = require('log4js').getLogger();
logger.level = 'debug';

module.exports = function(connection) {

    router.get('/report/module', function (req, res, next) {

        connection.query('select data from atlas', function (error, rows, field) {

            if(error) {
                logger.error(error);
                return res.status(500).send({ message: util.format(constants.DATABASE_ERROR_RESPONSE, new Date().toISOString().slice(0, 19).replace('T', ' ')) });
            } else {
                var resp = [];
                var idxs = {};

                rows.forEach(function(row) {
                    var data = row.data;
                    if(data && utils.isJson(data)) {
                        data = JSON.parse(data);
                        if(data && data.modules) {
                            data.modules.forEach(function(module) {
                                if(module.active !== "true") return;
                                if(typeof idxs[module.id] === "undefined") {
                                    idxs[module.id] = resp.length;
                                    resp.push({ id: module.id, name: module.name, versions: {} });
                                }
                                if(module.version) {
                                    if(resp[idxs[module.id]].versions[module.version]) {
                                        resp[idxs[module.id]].versions[module.version] += 1;
                                    } else {
                                        resp[idxs[module.id]].versions[module.version] = 1;
                                    }
                                }
                            });
                        }
                    }
                });

                res.setHeader('Content-Type', 'application/json');
                res.json(resp);
            }
        });
    });

    router.get('/report/module/:module_id', function (req, res, next) {

        connection.query('select data from atlas', function (error, rows, field) {

            if(error) {
                logger.error(error);
                return res.status(500).send({ message: util.format(constants.DATABASE_ERROR_RESPONSE, new Date().toISOString().slice(0, 19).replace('T', ' ')) });
            } else {

                if(rows && rows.length > 0) {
                    var module_id = req.params['module_id'];
                    var resp = {};
                    resp['id'] = module_id;
                    resp['versions'] = {};

                    rows.forEach(function(row) {
                        var data = row.data;
                        if(data && utils.isJson(data)) {
                            data = JSON.parse(data);
                            if(data && data.modules) {
                                data.modules.forEach(function(module) {
                                    if(module.active !== "true") return;
                                    if(module_id === module.id && module.version) {
                                        if(module.name) resp['name'] = module.name;
                                        if(resp.versions[module.version]) {
                                            resp.versions[module.version] += 1;
                                        } else {
                                            resp.versions[module.version] = 1;
                                        }
                                    }
                                });
                            }
                        }
                    });
                }

                res.setHeader('Content-Type', 'application/json');
                res.json(resp);
            }
        });
    });

    router.get('/report/countries', function (req, res, next) {

        connection.query('select latitude,longitude from atlas', function (error, rows, field) {

            if(error) {
                logger.error(error);
                return res.status(500).send({ message: util.format(constants.DATABASE_ERROR_RESPONSE, new Date().toISOString().slice(0, 19).replace('T', ' ')) });
            } else {
                var resp = {};
                countries = rows.map(function(row) { return wc([row.longitude,row.latitude]) });
                countries.forEach(function(country) {
                    if(resp[country]) {
                        resp[country] += 1;
                    } else {
                        resp[country] = 1;
                    }
                });

                res.setHeader('Content-Type', 'application/json');
                res.json(resp);
            }
        });
    });
    
    return router;
};
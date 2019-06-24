var express = require('express');
var router = express.Router();
var uuid = require('uuid');
var utils = require('../utils.js');

module.exports = function(connection) {

    function filterMarkerIds(req, markers) {
        for(var i = 0; i < markers.length; i++) {
            //If user not is signed in or authenticated user is not the creator of a marker
            //then hide the marker's id
            if(req.session.user == null || markers[i].created_by != req.session.user.uid) markers[i].id = i;
        }
    }

    var show_counts_query = "SELECT * FROM atlas";

    var no_counts_query = "SELECT id,latitude,longitude,name,url,type,image,show_counts, \
    IF(show_counts, patients, null) AS patients, \
    IF(show_counts, encounters, null) AS encounters, \
    IF(show_counts, observations, null) as observations, \
    contact,email,notes,data,atlas_version,openmrs_version,distribution,date_created,date_changed,created_by FROM atlas";

    /* GET all the markers */
    router.get('/markers', function(req, res, next) {

        var query = "";
        if(req.session.authenticated && req.session.user.admin) query = show_counts_query;
        else query = no_counts_query;

        //filter by url
        var criteria = [
            {
                param: 'username',
                col: 'created_by',
            },
            {
                param: 'type',
                col: 'type',
            },
            {
                param: 'versions',
                col: 'openmrs_version',
            },
            {
                param: 'dists',
                col: 'distribution',
            },
        ]

        //if parameter exists in the url
        //push it into params, and add column name to sql query
        var params = [];
        criteria.forEach(function(crit) {
            if(req.query[crit.param]) {
                query += (params.length === 0? ' WHERE ':' AND ')+crit.col+"=?";
                params.push(req.query[crit.param]);
            }
        });

        connection.query(query, params, function (error, rows, field) {
            if(!!error){
                console.log(error);
            }
            else{
                //var data  = JSON.stringify(rows);
                res.setHeader('Content-Type', 'application/json');
                //If user is logged in and is admin, don't filter marker ids. Else, do it.
                if(!(req.session.user && req.session.user.admin)) filterMarkerIds(req, rows);
                res.json(rows);
            }
        });

    });

    /* Get a specific marker with id parameter */
    router.get('/marker/:id', function (req, res, next) {

        var query = "";
        if(req.session.authenticated && req.session.user.isAdmin) query = show_counts_query;
        else query = no_counts_query;

        var id=req.params['id'];
        console.log(id);
        connection.query(query+' where id=?',[id], function (error, rows, field) {

            if(!!error){
                console.log(error);
            }
            else {
                res.setHeader('Content-Type', 'application/json');
                //If user is logged in and is admin, don't filter marker ids. Else, do it.
                if(!(req.session.user && req.session.user.admin)) filterMarkerIds(req, rows);
                res.json(rows);
                //connection.end();
            }
        })
    });

    /* Create new marker */
    router.post('/marker/', utils.isAuthenticated, function (req, res, next) {

        //If authenticated user is not the owner of the marker or an admin, return 401 (Unauthorized)
        if(req.session.user.uid != req.body.uid && !req.session.user.admin) return res.send(401);

        req.body = JSON.parse(Object.keys(req.body)[0]);
        var id=uuid.v4();
        var latitude=req.body.latitude;
        var longitude=req.body.longitude;
        var name=req.body.name;
        var url=req.body.url;
        var type=req.body.type;
        var image=req.body.image;
        var patients=req.body.patients;
        var encounters=req.body.encounters;
        var observations=req.body.observations;
        var contact=req.body.contact;
        var email=req.body.email;
        var notes=req.body.notes;
        var data=req.body.data;
        var atlas_verison=req.body.atlas_version;
        var date_created= new Date().toISOString().slice(0, 19).replace('T', ' ');
        var date_changed=new Date().toISOString().slice(0, 19).replace('T', ' ');
        var created_by=req.body.uid;
        var show_counts=req.body.show_counts;
        var openmrs_version=req.body.openmrs_version?req.body.openmrs_version:"unknown";
        var distribution=req.body.distribution;

        console.log(id+"    "+latitude+longitude+name+url+type+image+patients+encounters+date_changed+"           "+date_created);

        connection.query('insert into atlas values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [id,latitude,longitude,name,url,type,image,patients,encounters,observations,contact,email,notes,data,atlas_verison,date_created,date_changed,created_by,show_counts,openmrs_version,distribution], function (error, rows,field) {
            if(!!error){
                console.log(error);
            }
            else {
                res.setHeader('Content-Type', 'application/json');
                res.json(id);
            }
        });
    });

    /* Update marker with given id */
    router.patch('/marker/:id', utils.isAuthenticated, function (req, res, next) {

        //If authenticated user is not the owner of the marker or an admin, return 401 (Unauthorized)
        if(req.session.user.uid != req.body.uid && !req.session.user.admin) return res.send(401);

        req.body = JSON.parse(Object.keys(req.body)[0]);
        var id=req.params['id'];
        var latitude=req.body.latitude;
        var longitude=req.body.longitude;
        var name=req.body.name;
        var url=req.body.url;
        var type=req.body.type;
        var image=req.body.image;
        var patients=req.body.patients;
        var encounters=req.body.encounters;
        var observations=req.body.observations;
        var contact=req.body.contact;
        var email=req.body.email;
        var notes=req.body.notes;
        var data=req.body.data;
        var atlas_verison=req.body.atlas_version;
        var date_created= new Date().toISOString().slice(0, 19).replace('T', ' ');
        var date_changed=new Date().toISOString().slice(0, 19).replace('T', ' ');
        var created_by=req.body.uid;
        var show_counts=req.body.show_counts;
        var openmrs_version=req.body.openmrs_version?req.body.openmrs_version:"unknown";
        var distribution=req.body.distribution;
        var query = 'UPDATE atlas SET latitude=?,longitude=?,name=?,url=?,type=?,image=?,patients=?,encounters=?,observations=?,contact=?,email=?,notes=?,data=?,atlas_version=?,date_created=?,date_changed=?,created_by=?,show_counts=?,openmrs_version=?,distribution=? WHERE id =?';
        // If the user is not admin, we have to check whether the marker belongs to the user
        if(!req.session.user.admin) {
            query += ' AND created_by=\''+req.session.user.uid+'\'';
        }

        console.log(id+"    "+latitude+longitude+name+url+type+image+patients+encounters+date_changed+"           "+date_created);

        connection.query(query, [latitude,longitude,name,url,type,image,patients,encounters,observations,contact,email,notes,data,atlas_verison,date_created,date_changed,created_by,show_counts,openmrs_version,distribution,id], function (error, rows,field) {
            if(!!error){
                console.log(error);
            }
            else {
                res.setHeader('Content-Type', 'application/json');
                res.json(id);
            }
        });
    });

    /* Update marker with given id (called by atlas module) */
    router.post('/module/ping.php', utils.isAuthenticated, function (req, res, next) {
        console.log(req.body);
        var id=req.body.id;
        var patients=req.body.patients;
        var encounters=req.body.encounters;
        var observations=req.body.observations;
        var data=req.body.data;
        var atlas_verison=req.body.atlas_version;
        var date_changed=new Date().toISOString().slice(0, 19).replace('T', ' ');
        var openmrs_version=data.version;

        connection.query('UPDATE atlas SET patients=?,encounters=?,observations=?,data=?,atlas_version=?,date_changed=?,openmrs_version=? WHERE id =?', [patients,encounters,observations,data,atlas_verison,date_changed,openmrs_version,id], function (error, rows,field) {
            if(!!error){
                console.log(error);
            }
            else {
                res.setHeader('Content-Type', 'application/json');
                res.json(id);
            }
        });
    });

    /* Delete marker with given id */
    router.delete('/marker/:id', utils.isAuthenticated, function(req, res, next) {

        var id=req.params['id'];
        // If the user is not admin, we have to check whether the marker belongs to the user
        var query = 'DELETE FROM atlas WHERE id =?';
        if(!req.session.user.admin) {
            query += ' AND created_by=\''+req.session.user.uid+'\'';
        }

        connection.query(query, [id], function (error, rows,field) {
            if(!!error){
                console.log(error);
            }
            else {
                res.setHeader('Content-Type', 'application/json');
                res.json(id);
            }
        });
    });

    /* Delete marker with given id (called by atlas module) */
    router.delete('/module', utils.isAuthenticated, function(req, res, next) {

        var id=req.query['id'];
        var secret=req.query['secret'];

        connection.query('DELETE FROM atlas WHERE id =?', [id], function (error, rows,field) {
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

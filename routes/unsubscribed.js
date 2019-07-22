var express = require('express');
var router = express.Router();
var utils = require('../utils.js');
var ldapUtils = require('../ldap.js');

module.exports = function(connection) {

    router.get('/unsubscribe', function(req, res, next) {
        if(req.session.authenticated) {

            connection.query("SELECT * FROM unsubscribed WHERE username=?", [req.session.user.uid], function (error, rows, field) {
                console.log(rows);
                if(!!error) {
                    console.log(error);
                } else if(rows && rows.length) {
                    res.redirect('/?unsubscribed=true');
                } else {
                    res.redirect('/?unsubscribeDialog=true');
                }
            });
    
        } else {
            res.redirect('/login?redirect=' + encodeURIComponent('/unsubscribe'));
        }
    });

    /* Unsubscribe authenticated user from notifications */
    router.post('/unsubscribed', utils.isAuthenticated, function (req, res, next) {

        connection.query("INSERT INTO unsubscribed(username) VALUES(?)", [req.session.user.uid], function (error, rows, field) {
            console.log(rows);
            if(!!error){
                console.log(error);
            } else {
                res.setHeader('Content-Type', 'application/json');
                res.json({ id: rows.insertId, username: req.session.user.uid });
            }
        });
    });
    
    /* Subscribe authenticated user for notifications */
    router.delete('/unsubscribed', utils.isAuthenticated, function(req, res, next) {

        // Delete entry from 'unsubscribed'
        connection.query('DELETE FROM unsubscribed WHERE username=?', [req.session.user.uid], function (error, rows, field) {
            if(error) {
                console.log(error);
            } else {
                res.setHeader('Content-Type', 'application/json');
                res.json({ username: req.session.user.uid });
            }
        });
    });

    /* Unsubscribe user from notifications */
    router.post('/unsubscribed/:username', utils.isAdmin, function (req, res, next) {

        var username = req.params['username'];

        ldapUtils.getUser(username, function(error, user) {

            if(error) {
                console.log(error);
            } else if (user) {
                connection.query("INSERT INTO unsubscribed(username) VALUES(?)", [username], function (error, rows, field) {
                    if(!!error){
                        console.log(error);
                    } else {
                        res.setHeader('Content-Type', 'application/json');
                        res.json({ id: rows.insertId, username: username });
                    }
                });        
            } else {
                res.status(400).send({ message: username + ' not found' });
            }
        }); 

    });

    /* Subscribe user for notifications */
    router.delete('/unsubscribed/:username', utils.isAdmin, function(req, res, next) {

        var username = req.params['username'];

        // Delete entry from 'unsubscribed'
        connection.query('DELETE FROM unsubscribed WHERE username=?', [username], function (error, rows, field) {
            if(error) {
                console.log(error);
            } else {
                res.setHeader('Content-Type', 'application/json');
                res.json({ username: username });
            }
        });
    });
    
    return router;
};
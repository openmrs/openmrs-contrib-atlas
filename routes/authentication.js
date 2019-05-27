var express = require('express');
var router = express.Router();
var ldapUtils = require('../ldap');

module.exports = function () {
    //GET login
    router.get('/login', function(req, res) {
        if(req.session.authenticated) {
            res.redirect('/');            
        } else {
            //Display error message only once when error occurs
            const error = req.session.signin_error;
            req.session.signin_error = null;
            res.render('login', {user: req.session.user, error: error});
        }
    });

    //Validate login credentials and redirect accordingly
    router.post('/login', function(req, res) {
        ldapUtils.authenticate(req.body.username, req.body.password, function(err) {
            //If authentication fails, redirect to login
            if(err) {
                console.log(err);
                req.session.signin_error = err.lde_message;
                res.redirect('/login');
            }
            else {
                //Fetch user details
                ldapUtils.getUser(req.body.username, function(err, user) {
                    console.log(user);
                    //If unable to fetch user details, redirect to login
                    if(err) {
                        console.log(err);
                        req.session.signin_error = err.lde_message;
                        res.redirect('/login');
                    } else {
                        //Login user, store user details in the session, and redirect to Atlas home page
                        req.session.authenticated = true;
                        req.session.user = user;
                        res.redirect('/');
                    }
                });                
            }
        });
    });
    
    //Logout user by destroying session
    router.get('/logout', function (req, res) {
        req.session.destroy();
        res.redirect('/');
    });

    return router;
};

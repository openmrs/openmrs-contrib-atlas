var express = require('express');
var router = express.Router();

module.exports = function () {
    
    //Admin page
    router.get('/admin', function (req, res) {
        if(req.session.authenticated && req.session.user.admin) res.render('admin/admin');
        else res.send(401);
    });

    //Page to view all types
    router.get('/admin/types', function (req, res) {
        if(req.session.authenticated && req.session.user.admin) res.render('admin/types/types');
        else res.send(401);
    });

    //Page to create new type
    router.get('/admin/types/new', function (req, res) {
        if(req.session.authenticated && req.session.user.admin) res.render('admin/types/newType');
        else res.send(401);
    });
    
    //Page to edit a type
    router.get('/admin/types/:id', function (req, res) {
        if(req.session.authenticated && req.session.user.admin) res.render('admin/types/editType', { id: req.params['id'] });
    });
    
    //Page to view all versions
    router.get('/admin/versions', function (req, res) {
        if(req.session.authenticated && req.session.user.admin) res.render('admin/versions/versions');
        else res.send(401);
    });

    //Page to create a new version
    router.get('/admin/versions/new', function (req, res) {
        if(req.session.authenticated && req.session.user.admin) res.render('admin/versions/newVersion');
        else res.send(401);
    });
    
    //Page to edit a version
    router.get('/admin/versions/:id', function (req, res) {
        if(req.session.authenticated && req.session.user.admin) res.render('admin/versions/editVersion', { id: req.params['id'] });
    });

    //Page to view all distributions
    router.get('/admin/distributions', function (req, res) {
        if(req.session.authenticated && req.session.user.admin) res.render('admin/distributions/distributions');
        else res.send(401);
    });

    //Page to create a new distribution
    router.get('/admin/distributions/new', function (req, res) {
        if(req.session.authenticated && req.session.user.admin) res.render('admin/distributions/newDistribution');
        else res.send(401);
    });
    
    //Page to edit a distribution
    router.get('/admin/distributions/:id', function (req, res) {
        if(req.session.authenticated && req.session.user.admin) res.render('admin/distributions/editDistribution', { id: req.params['id'] });
        else res.send(401);
    });
    
    return router;
}; 
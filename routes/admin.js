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
        else res.send(401);
    });
    
    return router;
}; 
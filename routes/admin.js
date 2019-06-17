var express = require('express');
var router = express.Router();

module.exports = function () {
    
    //Admin page
    router.get('/admin', function (req, res) {
        if(req.session.authenticated && req.session.user.admin) res.render('admin/admin');
        else res.send(401);
    });

    return router;
}; 
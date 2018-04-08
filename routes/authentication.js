var express = require('express');
var router = express.Router();

module.exports = function () {
    //GET login
    router.get('/login', function(req, res, next) {
        res.redirect('http://localhost:8080/authenticate/atlas');
    });

    router.get('/logout', function (req, res) {
        req.session.destroy();
        res.redirect('/');
    });

    return router;
};

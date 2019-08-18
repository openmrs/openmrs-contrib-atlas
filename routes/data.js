var express = require('express');
var router = express.Router();

/* GET home page. */
module.exports = function(){
    router.get('/data', function(req, res, next) {
        res.render('data');
    });

    return router;
};

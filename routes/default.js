var express = require('express');
var router = express.Router();

/* GET home page. */
module.exports = function(){
    router.get('/', function(req, res, next) {

        res.render('index', {
            title: 'OpenMRS Atlas',
            isAuth: req.session,
            user: req.session.user,
            google_maps_api_key:  process.env.GOOGLE_MAPS_JS_API_KEY || 'NO_API',

        });

    });

    return router;
};

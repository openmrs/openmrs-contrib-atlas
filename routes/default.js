var express = require('express');
var router = express.Router();

/* GET home page. */
module.exports = function(){
    router.get('/', function(req, res, next) {

        var marker_id = req.query['marker'];    
        var update_marker = req.query['update'];    
        var delete_marker = req.query['delete'];    
        var unsubscribed = req.query['unsubscribed'];
        var unsubscribeDialog = req.query['unsubscribeDialog'];
        var module = req.query['module'];

        if(module === "true") {
            req.session.module_mode=true;
            if(!req.session.authenticated) {
                return res.redirect('/login');
            }
        } 

        if((update_marker || delete_marker || unsubscribed || unsubscribeDialog) && !req.session.authenticated) {
            return res.redirect('/login?redirect=' + encodeURIComponent(req.url));
        } 

        var options = {
            title: 'OpenMRS Atlas',
            isAuth: req.session,
            user: req.session.user,
            google_maps_api_key:  process.env.GOOGLE_MAPS_JS_API_KEY || 'NO_API',
            google_analytics_tracking_id: process.env.GOOGLE_ANALYTICS_TRACKING_ID || 'NONE',
            marker_id: marker_id,
            update_marker: update_marker,
            delete_marker: delete_marker,
            unsubscribed: unsubscribed,
            unsubscribeDialog: unsubscribeDialog,
            moduleMode: req.session.module_mode
        };
        res.render('index', options);

    });

    return router;
};

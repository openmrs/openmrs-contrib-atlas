module.exports = {

    /* Middleware to check whether the user is logged in */
    isAuthenticated : function(req, res, next) {
        if(req.session.authenticated) {
            return next();
        } else {
            res.redirect("/login");
        }
    },
    
    /* Middleware to check whether the user is authenticated as admin */
    isAdmin: function(req, res, next) {
        if(req.session.authenticated && req.session.user.admin) {
            return next();
        } else {
            res.send(401);
        }
    }
    
};
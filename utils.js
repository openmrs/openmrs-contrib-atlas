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
    },
    
    /* Add entry to RSS table */
    addRSS: function(connection, title, description, url, image_url, created_by) {

        connection.query('INSERT INTO rss(title, description, url, image_url, author) VALUES(?,?,?,?,?)', [title, description, url, image_url, created_by], function (error, rows,field) {
            if(!!error){
                console.log(error);
            }
        });
        
    }
};
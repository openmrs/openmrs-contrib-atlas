var bcrypt = require('bcrypt');
var schedule = require('node-schedule');
var nodemailer = require("nodemailer");
var ldapUtils = require('./ldap.js');
var conf = require('./conf.example.js');

const baseURL = 'https://atlas.openmrs.org';

function getActionLink(action, marker_id) {
    return baseURL + '/?' + action + '=' + marker_id;
}

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

    /* Hash provided token */
    hashToken: async function (token) {

        const saltRounds = 10;
        const salt = await bcrypt.genSalt(saltRounds);
        const hash = await bcrypt.hash(token, salt);
      
        return hash;
    },
    
    /* Add entry to RSS table */
    addRSS: function(connection, title, description, url, image_url, created_by) {

        connection.query('INSERT INTO rss(title, description, url, image_url, author) VALUES(?,?,?,?,?)', [title, description, url, image_url, created_by], function (error, rows,field) {
            if(!!error){
                console.log(error);
            }
        });
    },

    /* Checks whether url is absolute */
    /* Taken from https://stackoverflow.com/questions/10687099/how-to-test-if-a-url-string-is-absolute-or-relative */
    isUrlAbsolute: function(url) {
        if (url.indexOf('//') === 0) {return true;} // URL is protocol-relative (= absolute)
        if (url.indexOf('://') === -1) {return false;} // URL has no protocol (= relative)
        if (url.indexOf('.') === -1) {return false;} // URL does not contain a dot, i.e. no TLD (= relative, possibly REST)
        if (url.indexOf('/') === -1) {return false;} // URL does not contain a single slash (= relative)
        if (url.indexOf(':') > url.indexOf('/')) {return false;} // The first colon comes after the first slash (= relative)
        if (url.indexOf('://') < url.indexOf('.')) {return true;} // Protocol is defined before first dot (= absolute)
        return false; // Anything else must be relative
    },

    /* Send mails to owners of fading markers */
    scheduleMails: function(connection) {

        const fromMail = "'OpenMRS ID Dashboard' <id-noreply@openmrs.org>";

        let transporter = nodemailer.createTransport(conf.smtp);

        const intervals = [12,18,24];

        var sitesQuery = "SELECT id,name FROM atlas";
        for(var i = 0; i < intervals.length; i++) {
            sitesQuery += i == 0? " WHERE " : " OR ";
            sitesQuery += "DATE(date_changed) = DATE(NOW() - INTERVAL " + intervals[i] + " MONTH)";
        }

        schedule.scheduleJob('0 0 0 * * *', function(){

            connection.query(sitesQuery, function (error, rows, field) {

                if(error) {
                    console.log(error);
                } else {

                    rows.forEach(function(site) {

                        connection.query("SELECT * FROM auth WHERE atlas_id=? AND principal IS NOT NULL AND (SELECT COUNT(*) FROM unsubscribed WHERE username=auth.principal)=0", [site.id], function (error, rows, field) {

                            var html = "";

                            html += "<img src='https://camo.githubusercontent.com/ae65ac74a4fc50f91b544fc7a91d6c3b39b4bd76/68747470733a2f2f7368656b68617272656464796b6d69742e66696c65732e776f726470726573732e636f6d2f323031362f30382f61746c6173312e706e67' style='width: 475px; height: 145px;' /><br/><br/>";                            html += "<b>The marker for \"" + site.name + "\" on the OpenMRS Atlas has not been updated in nearly a year.</b> After a year, markers on the OpenMRS Atlas begin fading to show their age. Act now to prevent your site's marker from fading.<br/><br/>";
                            html += "You can address this in 30 seconds or less...<br/><br/>";
                            html += "Has anything changed in the past year? <a href='" + baseURL + "/?marker=" + site.id + "'>Edit your site on OpenMRS Atlas</a><br/><br/>";
                            html += "No changes but still active? <a href='" + getActionLink('update', site.id) + "'>Keep your marker from fading with one click</a><br/><br/>";
                            html += "No longer active? No action needed. Just let your marker fade.<br/><br/>";
                            html += "Want to remove your site from the OpenMRS Atlas? <a href='" + getActionLink('delete', site.id) + "'>Delete your site</a><br/><br/>";
                            html += "If you have any questions or concerns about the OpenMRS Atlas, feel free to <a>ask your question on OpenMRS Talk.</a><br/><br/>";
                            html += "Don't want these notifications? <a href='" + baseURL + "/unsubscribe'>Unsubscribe from these notifications</a><br/><br/>";

                            if(error) {
                                console.log(error);
                            } else {
                                rows.forEach(function(rule) {

                                    ldapUtils.getUser(rule.principal, function(err, user) {

                                        if(err) {
                                            console.log(err);
                                        } else {

                                            mailOptions = {
                                                from: fromMail,
                                                to: user.mail,
                                                subject: "Your marker for " + site.name + " is fading",
                                                text: "",
                                                html: html
                                            };
                                
                                            transporter.sendMail(mailOptions, function(error, info) {
                                                if (error) {
                                                    console.log(error);
                                                } else {
                                                    console.log('Email sent: ' + info.response);
                                                    connection.query("INSERT INTO notifications(marker_id,username,notified_on) VALUES(?,?,?)", [rule.atlas_id,rule.principal,new Date()], function (error, rows, field) {
        
                                                        if(error) {
                                                            console.log(error);
                                                        } 
                                                    });                                                    
                                                }
                                            });

                                        }
                                    });                
                                            
                                });    
                            }

                        });
    
                    })
                }
            });

        });

    }
};
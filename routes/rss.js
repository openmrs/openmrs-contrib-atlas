var express = require('express');
var router = express.Router();
var RSS = require('rss');

module.exports = function(connection) {

    const ATLAS_TITLE = process.env.ATLAS_RSS_TITLE || 'OpenMRS Atlas';
    const ATLAS_DESC = process.env.ATLAS_RSS_DESC || 'Updates to OpenMRS Atlas';
    const ATLAS_LINK = process.env.ATLAS_RSS_LINK || 'https://atlas.openmrs.org';
    const RSS_LINK = ATLAS_LINK + '/rss';
    const FEED_LENGTH = process.env.ATLAS_RSS_LENGTH || 20;
    const ATLAS_RSS_IMAGE_URL = process.env.ATLAS_RSS_IMAGE_URL;
    const IMAGE_RED_DOT = 'https://atlas.openmrs.org/images/red-dot.png';

    /* GET RSS Feed */
    router.get('/rss', function(req, res, next) {

        connection.query("SELECT title,description,url,image_url,author FROM rss ORDER BY date DESC LIMIT "+FEED_LENGTH, function (error, rows, field) {
            if(!!error){
                console.log(error);
            }
            else{

                var feed = new RSS({
                    title: ATLAS_TITLE,
                    description: ATLAS_DESC,
                    feed_url: RSS_LINK,
                    site_url: ATLAS_LINK,
                    language: 'en',
                    pubDate: new Date(),
                });

                rows.forEach(function(row) {
                    row.guid = ATLAS_LINK;

                    var image_url = IMAGE_RED_DOT;
                    if(row.image_url) {
                        image_url = row.image_url;
                    } else if (ATLAS_RSS_IMAGE_URL) {
                        image_url = ATLAS_RSS_IMAGE_URL;
                    }

                    row.custom_elements = [
                        { 'image': image_url }
                    ]
                    feed.item(row);
                });

                var feed_xml = feed.xml({indent: true});
                res.set('Content-Type', 'text/xml');
                res.send(feed_xml);
            }
        });

    });

    return router;
};
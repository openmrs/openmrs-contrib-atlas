module.exports = function(app, db) {
    function importRoute(routeName) {
        var str = './'+routeName;
        var routeModule = require(str);

        app.use(routeModule(db));
    }

    // Web endpoints
    importRoute('default');
    importRoute('authentication');
    importRoute('admin');
    importRoute('rss');

    // REST endpoints
    var routes = require('./api/index');
    routes(app, db);
};

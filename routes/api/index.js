module.exports = function(app, db) {
    function importRoute(routeName) {
        var str = './'+routeName;
        var routeModule = require(str);

        app.use('/api', routeModule(db));
    }

    // REST endpoints
    importRoute('distributions');
    importRoute('markers');
    importRoute('types');
    importRoute('versions');
    importRoute('auth');
    importRoute('unsubscribed');
    importRoute('module');
};

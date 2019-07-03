var getCachedVersions = null;

function fetchVersions(){

    return $.ajax({
            url: "/versions",
            type: "GET"
        })
        .done(function (versions) {
            getCachedVersions = (function(){
                return function(){ return versions; }
            })();
        })
        .fail(function (jqXHR) {
            bootbox.alert({ message: errorMessages.failMessage + jqXHR.statusText, backdrop: true });
        })
}
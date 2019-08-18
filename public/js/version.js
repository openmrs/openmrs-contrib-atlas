var getCachedVersions = null;

function fetchVersions(){

    return $.ajax({
            url: "/api/versions",
            type: "GET"
        })
        .done(function (versions) {
            getCachedVersions = (function(){
                return function(){ return versions; }
            })();
        })
        .fail(function (jqXHR) {
            bootbox.alert({ message: errorMessages.failMessage + (jqXHR.responseJSON.message? jqXHR.responseJSON.message: jqXHR.statusText), backdrop: true });
        })
}
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
            bootbox.alert(errorMessages.failMessage + jqXHR.statusText);
        })
}
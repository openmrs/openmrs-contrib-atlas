var getCachedTypes = null;

function fetchTypes(){

    return $.ajax({
            url: "/api/types",
            type: "GET"
        })
        .done(function (types) {
            getCachedTypes = (function(){
                return function(){ return types; }
            })();
        })
        .fail(function (jqXHR) {
            bootbox.alert({ message: errorMessages.failMessage + jqXHR.statusText, backdrop: true });
        })
}
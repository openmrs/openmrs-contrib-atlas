var getCachedTypes = null;

function fetchTypes(){

    return $.ajax({
            url: "/types",
            type: "GET"
        })
        .done(function (types) {
            getCachedTypes = (function(){
                return function(){ return types; }
            })();
        })
        .fail(function (jqXHR) {
            bootbox.alert(errorMessages.failMessage + jqXHR.statusText);
        })
}
function getGeolocation() {
    if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(function(position) {
            myPosition = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
            $('#atlas-hidden-longitude').val(position.coords.longitude);
            $('#atlas-hidden-latitude').val(position.coords.latitude);;
            map.setCenter(myPosition);
            map.setZoom(10);
            return;
        }, handle_errors);
    } else {
        yqlgeo.get('visitor', function(position) {
           if (response.error) {
                var error = { code: 0 };
                handle_error(error);
                return;
            }
            myPosition = new google.maps.LatLng(position.place.centroid.latitude,
                position.place.centroid.longitude);
            map.setCenter(myPosition);
            map.setZoom(10);
            return;
        });
    }
}

function handle_errors(error) {
    switch (error.code) {
        case error.PERMISSION_DENIED:
            alert("User did not share geolocation data");
        break;
        case error.POSITION_UNAVAILABLE:
            alert("Could not detect current position");
        break;
            case error.TIMEOUT: alert("Retrieving position timeout");
        break;
            default: alert("Unknown error");
        break;
    }
}

function editMarker()  {
    getGeolocation();
}

function createSite() {
    myPosition = getCurrentLatLng();
    var image = {
        url: 'http://maps.google.com/intl/en_us/mapfiles/ms/micons/blue-dot.png',
        scaledSize: new google.maps.Size(32, 32)
    };
    var marker = new google.maps.Marker({
        position: map.getCenter(),
        map: map,
        title: 'New',
        icon: image,
        animation: google.maps.Animation.DROP,
    });
    marker.setDraggable (true);
    return marker;
}

function getCurrentLatLng() {
    var lng = $('#atlas-hidden-longitude').val();
    var lat = $('#atlas-hidden-latitude').val();
    if ( lng != '' && lat != '' ){
        return new google.maps.LatLng(lat, lng);
    } else {
        return null;
    }
}


function initLoginButton() {
  $('#login').mouseover(function(){
    $('#logout').css('display', 'block');
  });
  $('#login').mouseleave(function(){
    $('#logout').css('display', 'none');
  });
  $('#editSite, #newSite').click(function(){
    $('#legendSelected').html(divSites); 
    $('#legend1').html(divTypes); 
    $('#legend2').html(divVersions); 
    legendGroups = 2;
    initLegend();
    repaintMarkers();
    if ($(this).attr("id") == "editSite")
      editMarker();
    if ($(this).attr("id") == "newSite")
      var marker = createSite();
  });
}
$(function () {
  
});

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
  closeBubbles();
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
  var site = newSite();
  var fadeGroup = getFadeGroup(site);
  var infowindow = createInfoWindow(site, marker);
  var editwindow = createEditInfoWindow(site, marker);
  sites[site.id] = {'siteData': site, 'marker':marker, 'infowindow':infowindow, 'editwindow':editwindow, 'bubbleOpen':false,'editBubbleOpen':false, 'fadeGroup':fadeGroup};
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

function newSite() {
  var site = {
    id: sites.length,
    contact: userName,
    uid: currentUser,
    name: 'New Site',
    email: userEmail,
    url: '',

    type:  'TBD',
    date_changed: new Date().toLocaleString(),
    date_created: new Date().toLocaleString()
  }
  return site;
}

function deleteMarker(site) {
  sites[site].marker.setMap(null);
  var i = sites.indexOf(site);
  if(i != -1) {
    sites.splice(i, 1);
  }
}

function createEditInfoWindow(site, marker) {
  var html = "<div class='site-bubble'>";
  html += "<form class='form' role='form'>"
  html += "<div class='form-group'><input type='text' required='true' placeholder='Site Name' class='form-control input-sm' value='"+ site.name + "' name='name'></div>";
  html += "<div class='form-group'>";
  if (site.image)
    html += "<img class='form-group' src='" + site.image + "' width='80px' height='80px' alt='thumbnail' />";
    html += "<div class='form-group'><input type='text' class='form-control input-sm' placeholder='Site URL' value='"+ site.url + "' name='url'></div>";
    html += "<div class='form-group'><input type='text' class='form-control input-sm'  placeholder='Contact' value='"+ site.contact + "' name='contact'></div>";
    html += "<div class='form-group'><input type='email' class='form-control input-sm' placeholder='Email' value='"+ site.email + "' name='email'></div>";
    html += "<textarea class='form-control' value='"+ site.notes + "' name='notes' rows='2' placeholder='Notes'></textarea>";
    html += "</div>";
    html += "<div class='row'><div class='col-xs-8'>";
    html += "<select class=form-control input-sm>"
              +"<option>Clinical</option>"
              +"<option>Evaluation</option>"
              +"<option>Development</option>"
              +"<option>Research</option>"
              +"<option>Other</option>"
            +"</select></div>";
  ;
  html += "<div class=''><button type='submit' class='btn btn-primary'>Save</button></div></div></form></div>"
  var infowindow = new google.maps.InfoWindow({
    content: html
  });
  google.maps.event.addListener(infowindow, 'closeclick', function() {
    sites[site.id].editBubbleOpen = false;
  });
  if (site.uid == currentUser) { 
    $("#map_canvas").on('click', "#delete", function(e){
      e.preventDefault();
      var id = $(this).attr("value");
      deleteMarker(id);
    });
    $("#map_canvas").on('click', "#undo", function(e){
      e.preventDefault();
      var id = $(this).attr("value");
      sites[id].editBubbleOpen = false;
      sites[id].editwindow.close();
    });
  }
  return infowindow;
}

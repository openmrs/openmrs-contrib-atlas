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
  initEditListener();
  $("#map_canvas").on('click', "#delete", function(e){
    e.preventDefault();
    var id = $(this).attr("value");
    bootbox.confirm("Are you sure ? Your site will be deleted", function(result) {
      if (result) deleteMarker(id);
    });
  });  
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
  myPosition = map.getCenter();
  var image = {
    url: 'http://maps.google.com/intl/en_us/mapfiles/ms/micons/blue-dot.png',
    scaledSize: new google.maps.Size(32, 32)
  };
  var marker = new google.maps.Marker({
    position: myPosition,
    map: map,
    title: 'New',
    icon: image,
    draggable: false,
    animation: google.maps.Animation.DROP,
  });
  marker.setDraggable(true);
  var site = newSite(myPosition);
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
    return map.getCenter();
  }
}

function newSite(myPosition) {
  var site = {
    id: sites.length,
    token: '',
    contact: userName,
    uid: currentUser,
    name: 'New Site',
    email: userEmail,
    notes: '',
    url: '',
    image: '',
    latitude: myPosition.lat(),
    longitude: myPosition.lng(),
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
  var html = contentEditwindow(site);
  var infowindow = new google.maps.InfoWindow({
    content: html
  });
  google.maps.event.addListener(infowindow, 'closeclick', function() {
    sites[site.id].editBubbleOpen = false;
  });
  if (site.uid == currentUser) { 
    $("#map_canvas").on('click', "#undo", function(e){
      e.preventDefault();
      var id = $(this).attr("value");
      sites[id].marker.setDraggable(false);
      sites[id].marker.setPosition(new google.maps.LatLng(site.latitude, site.longitude));
      sites[id].editBubbleOpen = false;
      sites[id].editwindow.close();
    });
  }
  return infowindow;
} 

function initEditListener() {
   $('#map_canvas').on('submit', 'form', (function(e) {
    e.preventDefault();
    var id = $('#site').val();
    var name = $('#name').val().trim();
    var mail = $('#email').val().trim();
    var notes = $('#notes').val().trim();
    var contact =$('#contact').val().trim();
    var url  = $('#url').val().trim();
    var type = $('select').val().trim();
    if(name === '' || id === '') {
      bootbox.alert("Site Name is missing !");
    } else {
      var site = sites[id].siteData;
      var pos = sites[id].marker.getPosition();
      site.name = name;
      site.email =  mail;
      site.url = url;
      site.contact = contact;
      site.notes = notes;
      site.type = type;
      site.longitude = pos.lng();
      site.latitude = pos.lat();
      sites[id].siteData = site;
      sites[id].infowindow.setContent(contentInfowindow(site));
      sites[id].editwindow.setContent(contentEditwindow(site));
      sites[id].editwindow.close();
      sites[id].editBubbleOpen = false;
      sites[id].marker.setDraggable(false);
      var json = JSON.stringify(site);
      //alert(json);
      $.ajax({
        url: 'ping.php/atlas',
        type: 'POST',
        data: json,
        dataType: 'text',
      })
      .done(function(response) {
        site.token = response;
        //bootbox.alert('Marker saved');
      })
      .fail(function() {
        bootbox.alert( "Error saving your marker - Please try again !" );
      });
    }
    return false;
  }));
}

function contentInfowindow(site) {
var html = "<div class='site-bubble'>";
  html += "<div class='site-name'>" + site.name + "</div>";
  html += "<div class='site-panel'>";
  if (site.image)
    html += "<img class='site-image' src='" + site.image + "' width='80px' height='80px' alt='thumbnail' />";
  if (site.url)
    html += "<div class='site-url'><a target='_blank' href='" + safeUrl(site.url) + "' title='" + site.url + "'>"
            + displayUrl(safeUrl(site.url)) + "</a></div>";
  if (site.patients && site.patients !== '0')
    html += "<div class='site-count'>" + addCommas(site.patients) + " patients</div>";
  if (site.encounters && site.encounters !== '0')
    html += "<div class='site-count'>" + addCommas(site.encounters) + " encounters</div>";
  if (site.observations && site.observations !== '0')
    html += "<div class='site-count'>" + addCommas(site.observations) + " observations</div>";
  if (site.contact)
    html += "<div class='site-contact'><span class='site-label'>Contact:</span> " + site.contact + "</div>";
  if (site.email)
    html += "<a href='mailto:"+ site.email + "' class='site-email'><img src='images/mail.png' width='15px' height='15px'/></a>";
  html += "</div>";
  if (site.notes)
    html += "<fieldset class='site-notes'>" + site.notes + "</fieldset>";
  if (site.type)
    html += "<div class='site-type'><span class='site-type'>" + site.type + "</span>";
  if (versionForSite(site))  
    html += "<span class='site-version'>" + versionForSite(site) + "</span></div>";
  /*
   if (site.date_changed)
    var date_update = new Date(site.date_changed);
    html += "<div id='site-update'>Last Updated: " + date_update.toLocaleDateString() + "</div>";
  */
  html += "</div>"
  return html;
}

function contentEditwindow(site) {
  var html = "<div class='site-bubble bubble-form'>";
  html += "<form method='post' id='"+ site.id +"'>"
  html += "<div class='form-group'><input type='text' required='true' placeholder='Site Name' title='Site Name' class='form-control input-sm' value='"+ site.name + "' id='name' name='name'></div>";
  html += "<div class='form-group'>";
  if (site.image)
  html += "<img class='form-group' src='" + site.image + "' width='80px' height='80px' alt='thumbnail' />";
  html += "<div class='form-group'><input type='url' class='form-control input-sm' placeholder='Site URL' title='Site URL' value='"+ site.url + "' name='url' id='url'></div>";
  html += "<div class='form-group'><input type='text' class='form-control input-sm'  placeholder='Contact' title='Contact' value='"+ site.contact + "' name='contact' id ='contact'></div>";
  html += "<div class='form-group'><input type='email' class='form-control input-sm' placeholder='Email' title='Email' value='"+ site.email + "' name='email' id='email'></div>";
  html += "<textarea class='form-control' value='' name='notes' rows='2' id='notes' placeholder='Notes'>"+ site.notes + "</textarea>";
  html += "<input type='hidden' id='site' value='"+site.id+"'/></div>";
  html += "<div class='row'><div class='col-xs-8'>";
  html += "<select title='Site type' id='type' class='form-control input-sm'>"
            +"<option>Clinical</option>"
            +"<option>Evaluation</option>"
            +"<option>Development</option>"
            +"<option>Research</option>"
            +"<option>Other</option>"
          +"</select></div>";
  html += "<div class=''><button type='submit' class='btn btn-primary'>Save</button></div></div></form></div>"
  return html;
}
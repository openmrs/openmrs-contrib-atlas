<!DOCTYPE html>
<html>
<head>
<title>OpenMRS Atlas</title>
<meta name="viewport" content="initial-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="atlas.css" type="text/css" media="screen" />
<script type="text/javascript" src="http://maps.google.com/maps/api/js?sensor=false">
</script>
<script type="text/javascript">
var map;
var sites = [];
var images = []
var shadows = [];
var fadeOverTime = false;

function showId(id) {
  prompt('Implementation ID', id);
}

function FadeControl(controlDiv, map) {
  // Set CSS styles for the DIV containing the control
  // Setting padding to 5 px will offset the control
  // from the edge of the map
  controlDiv.style.padding = '5px';
 
  // Set CSS for the control border
  var controlUI = document.createElement('DIV');
  controlUI.id = "fadeControl";
  controlUI.title = 'Fade inactive sites over time.';
  controlDiv.appendChild(controlUI);

  var checkbox = document.createElement('INPUT');
  checkbox.type = "checkbox";
  checkbox.id = 'fadeCheckbox'
  checkbox.onchange = function() {
    fadeOverTime = !fadeOverTime;
    repaintMarkers();
  };
  controlUI.appendChild(checkbox);

  var label = document.createElement('LABEL');
  label.id = 'fadeLabel';
  label.innerHTML = 'Fade';
  label.htmlFor = 'fadeCheckbox';
  controlUI.appendChild(label);
}

function closeBubbles() {
  for (key in sites) {
    if (sites[key].bubbleOpen) {
	  sites[key].infowindow.close();
	  sites[key].bubbleOpen = false;
    }	
  }
}

function initialize() {
  var myOptions = {
    zoom: 3,
    mapTypeId: google.maps.MapTypeId.ROADMAP
  };
  map = new google.maps.Map(document.getElementById("map_canvas"), myOptions);

  images[0] = new google.maps.MarkerImage('atlas_sprite.png',
    // This marker is 20 pixels wide by 32 pixels tall.
    new google.maps.Size(20, 34),
    // The origin for this image is 0,0.
    new google.maps.Point(0,0),
    // The anchor for this image is the base of the flagpole at 0,32.
    new google.maps.Point(10, 34));
  shadows[0] = new google.maps.MarkerImage('atlas_sprite.png',
    new google.maps.Size(37, 34),
    new google.maps.Point(20,0),
    new google.maps.Point(10, 34));
  images[1] = new google.maps.MarkerImage('atlas_sprite.png',
    // This marker is 20 pixels wide by 32 pixels tall.
    new google.maps.Size(20, 34),
    // The origin for this image is 0,0.
    new google.maps.Point(57,0),
    // The anchor for this image is the base of the flagpole at 0,32.
    new google.maps.Point(10, 34));
  shadows[1] = new google.maps.MarkerImage('atlas_sprite.png',
    new google.maps.Size(37, 34),
    new google.maps.Point(77,0),
    new google.maps.Point(10, 34));
  images[2] = new google.maps.MarkerImage('atlas_sprite.png',
    // This marker is 20 pixels wide by 32 pixels tall.
    new google.maps.Size(20, 34),
    // The origin for this image is 0,0.
    new google.maps.Point(114,0),
    // The anchor for this image is the base of the flagpole at 0,32.
    new google.maps.Point(10, 34));
  shadows[2] = new google.maps.MarkerImage('atlas_sprite.png',
    new google.maps.Size(37, 34),
    new google.maps.Point(134,0),
    new google.maps.Point(10, 34));
  images[3] = new google.maps.MarkerImage('atlas_sprite.png',
    // This marker is 20 pixels wide by 32 pixels tall.
    new google.maps.Size(20, 34),
    // The origin for this image is 0,0.
    new google.maps.Point(171,0),
    // The anchor for this image is the base of the flagpole at 0,32.
    new google.maps.Point(10, 34));
  shadows[3] = new google.maps.MarkerImage('atlas_sprite.png',
    new google.maps.Size(37, 34),
    new google.maps.Point(191,0),
    new google.maps.Point(10, 34));

  /*
  var fadeControlDiv = document.createElement('DIV');
  var fadeControl = new FadeControl(fadeControlDiv, map);
  fadeControlDiv.index = 1;
  map.controls[google.maps.ControlPosition.TOP_RIGHT].push(fadeControlDiv);
  */

  google.maps.event.addListener(map, 'click', function() {
    closeBubbles();
  });

  getJSON();
}

function getJSON() {
  var script = document.createElement('script');
  script.setAttribute('src', 'http://openmrs.org/atlas/data.php?callback=loadSites');
  script.setAttribute('id', 'jsonScript');
  script.setAttribute('type', 'text/javascript');
  document.documentElement.firstChild.appendChild(script);
}

function loadSites(json) {
  var bounds = new google.maps.LatLngBounds();
  for(i=0; i<json.length; i++) {
    var site = json[i];
    var fadeGroup = getFadeGroup(site);
    var marker = createMarker(site, fadeGroup, bounds);
    var infowindow = createInfoWindow(site, marker);
    sites[site.id] = {'marker':marker, 'infowindow':infowindow, 'bubbleOpen':false, 'fadeGroup':fadeGroup};
  }
  map.fitBounds(bounds);
}

function repaintMarkers() {
  for (key in sites) {
    var site = sites[key];
    var imageIndex = indexForFadeGroup(site.fadeGroup);
    if (shouldBeVisible(site.fadeGroup)) {
      site.marker.setIcon(images[imageIndex]);
      site.marker.setShadow(shadows[imageIndex]);
      site.marker.setVisible(true);
    } else {
      site.marker.setVisible(false);
    }
  }
}

function shouldBeVisible(fadeGroup) {
  return !fadeOverTime || fadeGroup < 4;
}

function createMarker(site, fadeGroup, bounds) {
  var latLng = new google.maps.LatLng(site.latitude, site.longitude);
  var imageIndex = indexForFadeGroup(fadeGroup);
  var marker = new google.maps.Marker({
    position: latLng,
    map: map,
    title: site.name,
    icon: images[imageIndex],
    shadow: shadows[imageIndex],
    animation: google.maps.Animation.DROP
  });
  bounds.extend(latLng);
  return marker;
}

function dateForSite(site) {
  var dateString = site.date_changed;
  if (!dateString)
    dateString = site.date_created;
  dateString = dateString.replace(/-/g, '/');
  return new Date(dateString).getTime();
}

function getFadeGroup(site) {
  var ageInMonths = Math.max(0,(new Date().getTime() - dateForSite(site))/2592000000); // milliseconds in 30 days
  var fadeGroup = Math.floor(ageInMonths / 6);
  return Math.min(fadeGroup, 4); // higher index == more transparent (max is 4)
}

function indexForFadeGroup(fadeGroup) {
  if (!fadeOverTime)
    return 0;
  return Math.min(fadeGroup, 3); // max images index is 3, fadeGroup can go higher
}

function cropUrl(url) {
	if (url != null && url.length > 50)
	  return url.substring(0,25) + "..." + url.substring(url.length-22);
	return url;
}

function addCommas(n) {
	n += '';
	x = n.split('.');
	x1 = x[0];
	x2 = x.length > 1 ? '.' + x[1] : '';
	var regex = /(\d+)(\d{3})/;
	while (regex.test(x1)) {
	  x1 = x1.replace(regex, '$1' + ',' + '$2');
	}
	return x1 + x2;
}

function createInfoWindow(site, marker) {

  var html = "<div class='site-bubble'>";
  html += "<div class='site-name'>" + site.name + "</div>";
  html += "<div class='site-panel'>"
  if (site.image)
    html += "<img class='site-image' src='" + site.image + "' width='80px' height='80px' alt='thumbnail' />";
  if (site.url)
    html += "<div class='site-url'><a target='_blank' href='" + site.url + "' title='" + site.url + "'>" + cropUrl(site.url) + "</a></div>";
  if (site.patients && site.patients != '0')
    html += "<div class='site-count'>" + addCommas(site.patients) + " patients</div>";
  if (site.encounters && site.encounters != '0')
    html += "<div class='site-count'>" + addCommas(site.encounters) + " encounters</div>";
  if (site.observations && site.observations != '0')
    html += "<div class='site-count'>" + addCommas(site.observations) + " observations</div>";
  if (site.contact)
    html += "<div class='site-contact'><span class='site-label'>Contact:</span> " + site.contact + "</div>";
  if (site.email)
    html += "<a href='mailto:"+ site.email + "' class='site-email'><img src='mail.png' width='15px' height='15px'/></a>";
  html += "</div>";
  if (site.notes)
    html += "<fieldset class='site-notes'><legend>Notes</legend>" + site.notes + "</fieldset>";
  if (site.type)
    html += "<div class='site-type'><span class='site-type'>" + site.type + "</span></div>";
  html += "<input class='site-id' readonly='true' value='" + site.id + "' onclick='this.select()' />";
  html += "</div>";

  var infowindow = new google.maps.InfoWindow({
    content: html,
  });
  google.maps.event.addListener(infowindow, 'closeclick', function() {
	sites[site.id].bubbleOpen = false;
  });
  google.maps.event.addListener(marker, "click", function() {
	if (sites[site.id].bubbleOpen) {
	  infowindow.close();
	  sites[site.id].bubbleOpen = false;
	} else {
	  closeBubbles();
      infowindow.open(map,marker);
      sites[site.id].bubbleOpen = true;
    }
  });
  return infowindow;
}

setTimeout('initialize()', 500);
</script>
</head>
<body>
  <div id="map_title"><img src="OpenMRS-logo.png" /></div>
  <div id="map_canvas" style="width:100%; height:100%"></div>
</body>
</html>
function initLegendChoice() {
  $("#legendSelected").html(divTypes);
  $("#legend2").html(divVersions);
  $("#legend1").html(divSites);

  $("#legendSelected").mouseover(function(){
    $("#legendChoice").css("display", "block");
  });
  $("#marker-groups").mouseleave(function(){
    $("#legendChoice").css("display", "none");
  });
  $("#legend1, #legend2").click(function(){
    var clicked = $(this).attr("id");
    clickLegend(clicked);
    $("#legendChoice").css("display", "none");
  });
}
function clickLegend(id){
  switch ($("#"+id).html()) {
    case divVersions:
      if (version.length > 0) {
        $("#"+id).html($("#legendSelected").html());
        $("#legendSelected").html(divVersions);
        legendGroups = 1;
      }
      break;
    case divSites: 
      $("#"+id).html($("#legendSelected").html());
      $("#legendSelected").html(divSites); 
      //controlText.innerHTML = "<b>Groups</b>";
      legendGroups = 2;
      break;
    case divTypes:
      $("#"+id).html($("#legendSelected").html());
      $("#legendSelected").html(divTypes); 
      //controlText.innerHTML = "<b>Groups</b>";
      legendGroups = 0;
      break;
  }
  repaintMarkers();
  initLegend();
}

function showId(id) {
  prompt("Implementation ID", id);
}

function FadeControl(controlDiv, map) {
  // Set CSS styles for the DIV containing the control
  // Setting padding to 5 px will offset the control
  // from the edge of the map
  controlDiv.style.padding = "5px";
 
  // Set CSS for the control border
  var controlUI = document.createElement("DIV");
  controlUI.id = "fadeControl";
  controlUI.title = "Fade inactive sites over time.";
  controlDiv.appendChild(controlUI);

  var checkbox = document.createElement("INPUT");
  checkbox.type = "checkbox";
  checkbox.id = "fadeCheckbox";
  checkbox.onchange = function() {
    fadeOverTime = !fadeOverTime;
    repaintMarkers();
  };
  controlUI.appendChild(checkbox);

  var label = document.createElement("LABEL");
  label.id = "fadeLabel";
  label.innerHTML = "Fade";
  label.htmlFor = "fadeCheckbox";
  controlUI.appendChild(label);
}

function closeBubbles() {
  for (var key in sites) {
    if (sites[key].bubbleOpen) {
      sites[key].infowindow.close();
      sites[key].bubbleOpen = false;
    }
    if (sites[key].editBubbleOpen) {
      sites[key].editwindow.close();
      sites[key].editBubbleOpen = false;
    } 
  }
}
function initVersion() {
 var i=0, x, count, item;
 while(i < version.length){
     count = 1;
     item = version[i];
     x = i+1;
     while(x < version.length && (x = version.indexOf(item,x)) !== -1){
         count+=1;
         version.splice(x,1);
     }
     version[i] = new Array(version[i],count);
     ++i;
 }
 version.sort(function(a, b){
    return a[1]-b[1];
 });
 version.reverse();
 if (version.length > 3) otherVersion = 1;
 version = version.slice(0,3);
 version.sort(versionCompare);
 version.reverse();
 while (version.length < 4){
     version.push(0);
 }
}

function initialize() {
  $("#map_canvas").gmap3({
    map:{
      options:{
        zoom: 4,
        minZoom: 2,
        mapTypeId: google.maps.MapTypeId.ROADMAP
      },
    }
  });
  map = $("#map_canvas").gmap3('get');
  images[0] = new google.maps.MarkerImage("atlas_sprite.png",
    // This marker is 20 pixels wide by 32 pixels tall.
    new google.maps.Size(20, 34),
    // The origin for this image is 0,0.
    new google.maps.Point(0,0),
    // The anchor for this image is the base of the flagpole at 0,32.
    new google.maps.Point(10, 34));
  shadows[0] = new google.maps.MarkerImage("atlas_sprite.png",
    new google.maps.Size(37, 34),
    new google.maps.Point(20,0),
    new google.maps.Point(10, 34));
  images[1] = new google.maps.MarkerImage("atlas_sprite.png",
    // This marker is 20 pixels wide by 32 pixels tall.
    new google.maps.Size(20, 34),
    // The origin for this image is 0,0.
    new google.maps.Point(57,0),
    // The anchor for this image is the base of the flagpole at 0,32.
    new google.maps.Point(10, 34));
  shadows[1] = new google.maps.MarkerImage("atlas_sprite.png",
    new google.maps.Size(37, 34),
    new google.maps.Point(77,0),
    new google.maps.Point(10, 34));
  images[2] = new google.maps.MarkerImage("atlas_sprite.png",
    // This marker is 20 pixels wide by 32 pixels tall.
    new google.maps.Size(20, 34),
    // The origin for this image is 0,0.
    new google.maps.Point(114,0),
    // The anchor for this image is the base of the flagpole at 0,32.
    new google.maps.Point(10, 34));
  shadows[2] = new google.maps.MarkerImage("atlas_sprite.png",
    new google.maps.Size(37, 34),
    new google.maps.Point(134,0),
    new google.maps.Point(10, 34));
  images[3] = new google.maps.MarkerImage("atlas_sprite.png",
    // This marker is 20 pixels wide by 32 pixels tall.
    new google.maps.Size(20, 34),
    // The origin for this image is 0,0.
    new google.maps.Point(171,0),
    // The anchor for this image is the base of the flagpole at 0,32.
    new google.maps.Point(10, 34));
  shadows[3] = new google.maps.MarkerImage("atlas_sprite.png",
    new google.maps.Size(37, 34),
    new google.maps.Point(191,0),
    new google.maps.Point(10, 34));
  map.controls[google.maps.ControlPosition.RIGHT_BOTTOM].push(legend);
  /*
  var fadeControlDiv = document.createElement("DIV");
  var fadeControl = new FadeControl(fadeControlDiv, map);
  fadeControlDiv.index = 1;
  map.controls[google.maps.ControlPosition.TOP_RIGHT].push(fadeControlDiv);
  */

  google.maps.event.addListener(map, "click", function() {
    closeBubbles();
  });
  var login = document.getElementById("login");
  map.controls[google.maps.ControlPosition.TOP_RIGHT].push(login);
  var screenshot = document.getElementById("screenshot");
  map.controls[google.maps.ControlPosition.TOP_RIGHT].push(screenshot);
  var markerGroups = document.getElementById("marker-groups");
  map.controls[google.maps.ControlPosition.TOP_RIGHT].push(markerGroups);

  getJSON();
}

function getJSON() {
  var script = document.createElement("script");
  script.setAttribute("src", "http://localhost/openmrs-contrib-atlas/public/data.php?callback=loadSites");
  script.setAttribute("id", "jsonScript");
  script.setAttribute("type", "text/javascript");
  document.documentElement.firstChild.appendChild(script);
}

function initLegend(){
  var legend = document.getElementById("legend");
  legend.setAttribute("hidden", true);
  if (legendGroups !== 2) {
    var icons = Icons();
    legend.removeAttribute("hidden");
    legend.innerHTML = "<h3>Legend</h3>";
    for (var type in icons) {
      if (icons[type].label) {
        var name = icons[type].label;
        var icon = icons[type].icon;
        if (!(icons[type].label === "Unknown" && unknownVersion === 0) && !(icons[type].label === "Other" && otherVersion === 0 && legendGroups === 1 )
                && !(legendGroups === 0 && !types.hasOwnProperty(type))) {
            var div = document.createElement("div");
            div.innerHTML = "<img src='"+ icon + "'>" + name;
            legend.appendChild(div);
        }
      }
    }
  }
}
function clearLegend(){
  var legend = document.getElementById("legend");
    legend.innerHTML = "";

}
function Icons(){
  var icons;
  if (legendGroups === 0){
    icons = {
      Research: {
        icon: "http://maps.google.com/intl/en_us/mapfiles/ms/micons/green-dot.png",
        label: "Research"
      },
      Clinical: {
        icon: "http://maps.google.com/intl/en_us/mapfiles/ms/micons/purple-dot.png",
        label: "Clinical"
      },
      Development: {
        icon: "http://maps.google.com/intl/en_us/mapfiles/ms/micons/blue-dot.png",
        label: "Development"
      },
      Evaluation: {
        icon: "http://maps.google.com/intl/en_us/mapfiles/ms/micons/yellow-dot.png",
        label: "Evaluation"
      },
      Other: {
        icon: "http://maps.google.com/intl/en_us/mapfiles/ms/micons/red-dot.png",
        label: "Other"
      }
    };
  } else if (legendGroups === 1) {
    icons = {
      1: {
        icon: "http://maps.google.com/intl/en_us/mapfiles/ms/micons/green-dot.png",
        label: version[0][0]
      },
      2: {
        icon: "http://maps.google.com/intl/en_us/mapfiles/ms/micons/yellow-dot.png",
        label: version[1][0]
      },
      3: {
        icon: "http://maps.google.com/intl/en_us/mapfiles/ms/micons/blue-dot.png",
        label: version[2][0]
      },
      Other: {
        icon: "http://maps.google.com/intl/en_us/mapfiles/ms/micons/red-dot.png",
        label: "Other"
      },
      Unknown: {
        icon: "http://maps.google.com/intl/en_us/mapfiles/ms/micons/purple.png",
        label: "Unknown"
      }
    };
  } else {
      icons = {
        Other: {
          icon: "http://maps.google.com/intl/en_us/mapfiles/ms/micons/red-dot.png",
          label: "Other"
        }
      };
    }
  return icons;
}

function colorForSite(site) {
  var icons = Icons();
  var image = {
      url: icons.Other.icon,
      scaledSize: new google.maps.Size(32, 32)
  };
  if (legendGroups === 1) {
    switch (versionMajMinForSite(site)) {
      case version[0][0]:
       image.url = icons["1"].icon;
       break;
      case version[1][0]:
        image.url = icons["2"].icon;
        break;
      case version[2][0]:
        image.url = icons["3"].icon;
        break;
      case null:
        image.url = icons.Unknown.icon;
        break;
     }  
  } else if (legendGroups === 0){
    switch (site.type) {
      case "Research":
       types.Research = 1;
       image.url = icons.Research.icon;
       break;
      case "Clinical":
        types.Clinical = 1;
        image.url = icons.Clinical.icon;
        break;
      case "Development":
        types.Development = 1;
        image.url = icons.Development.icon;
        break;
      case "Evaluation":
        types.Evaluation = 1;
        image.url = icons.Evaluation.icon;
        break;
      case "Other":
        types.Other = 1;
        image.url = icons.Other.icon;
        break;
    }
  }
  if ((site.uid === currentUser || auth_site.indexOf(site.uuid) !== -1) && legendGroups === 2)
      image.url = "http://maps.google.com/intl/en_us/mapfiles/ms/micons/blue-dot.png";
  return image;
}

function loadVersion(json) {
  for(i=0; i<json.length; i++) {
    var site = json[i];
    if (site.version) version.push(versionMajMinForSite(site));
    else unknownVersion++;
  }
  initVersion();
}

function loadSites(json) {
  var bounds = new google.maps.LatLngBounds();
  loadVersion(json);
  for(i=0; i<json.length; i++) {
    var site = json[i];
    if (!site.hasOwnProperty("uuid"))
      site.uuid = null;
    var fadeGroup = getFadeGroup(site);
    var marker = createMarker(site, fadeGroup, bounds);
    var editwindow = null;
    var infowindow = createInfoWindow(site, marker);
    if ((site.uid !== "" && site.uid === currentUser) || (auth_site.indexOf(site.uuid) !== -1) || site.uuid !== null)
      editwindow = createEditInfoWindow(site, marker);
    initLegend();
    if (site.version)
        version.push(versionMajMinForSite(site));
    sites[site.id] = {"siteData": site, "marker":marker, "infowindow":infowindow, "editwindow":editwindow, "bubbleOpen":false,"editBubbleOpen":false, "fadeGroup":fadeGroup};
  }
  map.fitBounds(bounds);
}

function repaintMarkers() {
  for (var key in sites) {
    var site = sites[key];
    var imageIndex = indexForFadeGroup(site.fadeGroup);
    if (shouldBeVisible(site.fadeGroup)) {
      site.marker.setIcon(colorForSite(site.siteData));
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
    icon: colorForSite(site),
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
  dateString = dateString.replace(/-/g, "/");
  return new Date(dateString).getTime();
}

function versionForSite(site) {
  if (site.version) {
    var version = site.version;
    return version.match(/\d+(\.\d+)+/g).toString();
  }
  return null; 
}

function versionMajMinForSite(site) {
  if (site.version) {
    var version = site.version;
    return version.match(/\d+(\.\d+)/g).toString();
  }
  return null; 
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

function safeUrl(url) {
  if (url !== null) {
    if (url.indexOf("http://") === 0 || url.indexOf("https://") === 0)
      return url;
    return "http://" + url;
  }
  return url;
}

function displayUrl(url) {
  if (url === null)
    return url;
  var displayUrl = url.replace(/^https?:\/\//i, "");
  if (displayUrl.length > 50)
    return displayUrl.substring(0,25) + "..." + displayUrl.substring(displayUrl.length-22);
  return displayUrl;
}

function addCommas(n) {
  n += "";
  x = n.split(".");
  x1 = x[0];
  x2 = x.length > 1 ? "." + x[1] : "";
  var regex = /(\d+)(\d{3})/;
  while (regex.test(x1)) {
    x1 = x1.replace(regex, "$1" + "," + "$2");
  }
  return x1 + x2;
}
versionCompare = function(left, right) {
  if (typeof left[0] + typeof right[0] !== "stringstring")
    return false;
  var a = left[0].split(".");
  var b = right[0].split(".");
  var i = 0;
  var len = Math.max(a.length, b.length);    
  for (; i < len; i++) {
     if ((a[i] && !b[i] && parseInt(a[i]) > 0) || (parseInt(a[i]) > parseInt(b[i]))) {
        return 1;
    } else if ((b[i] && !a[i] && parseInt(b[i]) > 0) || (parseInt(a[i]) < parseInt(b[i]))) {
        return -1;
    }
  }
  return 0;
};

function createInfoWindow(site, marker) {
  var html = "<div class='site-bubble'>";
  html += "<div class='site-name'>" + site.name + "</div>";
  html += "<div class='site-panel'>";
  if (site.image)
    html += "<img class='site-image' src='" + site.image + "' width='80px' height='80px' alt='thumbnail' />";
  if (site.url)
    html += "<div class='site-url'><a target='_blank' href='" + safeUrl(site.url) + "' title='" + site.url + "'>"
            + displayUrl(safeUrl(site.url)) + "</a></div>";
  if (site.patients && site.patients !== "0")
    html += "<div class='site-count'>" + addCommas(site.patients) + " patients</div>";
  if (site.encounters && site.encounters !== "0")
    html += "<div class='site-count'>" + addCommas(site.encounters) + " encounters</div>";
  if (site.observations && site.observations !== "0")
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
  html += "</div>";
  var infowindow = new google.maps.InfoWindow({
    content: html
  });
  google.maps.event.addListener(infowindow, "closeclick", function() {
    sites[site.id].bubbleOpen = false;
  });
  google.maps.event.addListener(marker, "click", function() {
    if (sites[site.id].editBubbleOpen) {
      sites[site.id].editwindow.close();
      sites[site.id].editBubbleOpen = false;
    } else if (sites[site.id].bubbleOpen) {
      infowindow.close();
      sites[site.id].bubbleOpen = false;
    } else {
      closeBubbles();
      infowindow.open(map,marker);
      sites[site.id].bubbleOpen = true;
      if ((site.uid == currentUser) || site.uuid !== null) { 
        $(".gm-style-iw").parent().append("<div id='edit' value='"+site.id+"' title ='Edit site' class='control' style='position: absolute;overflow:none; right:12px;bottom:10px; color:#3F3F3F'><i class='fa fa-lg fa-pencil' style='color:rgba(171, 166, 166, 1)'></i></div>");
        $(".gm-style-iw").parent().append("<div id='delete' value='"+site.id+"' title ='Delete site' class='control' style='position: absolute;overflow:none; right:12px;bottom:25px; color:#3F3F3F'><i class='fa fa-lg fa-trash-o' style='color:rgba(171, 166, 166, 1)'></i></div>");
      } else {
        if (currentUser !== "visitor")
          $(".gm-style-iw").parent().append("<div id='lock' style='position: absolute;overflow:none; right:13px;bottom:10px; color:#3F3F3F'><i title='Claim ownership using Helpesk'  class='fa fa-lg fa-lock' style='color:rgba(171, 166, 166, 1)'></i></div>");
        else
          $(".gm-style-iw").parent().append("<div id='lock' style='position: absolute;overflow:none; right:13px;bottom:10px; color:#3F3F3F'><i class='fa fa-lg fa-lock' style='color:rgba(171, 166, 166, 1)'></i></div>");
      }
    }
      if ((site.uid === currentUser) || site.uuid !== null) {
    $("#map_canvas").on("click", "#edit", function(e){
      //e.preventDefault();
      var id = $(this).attr("value");
      infowindow.close();
      sites[id].bubbleOpen = false;
      sites[id].editwindow.open(map,sites[id].marker);
      sites[id].editBubbleOpen = true;
      sites[id].marker.setDraggable(true);
      $(".gm-style-iw").parent().append("<div id='undo' title ='Undo change' value='"+id+"' class='control' style='position: absolute;overflow:none; right:12px;bottom:10px; color:#3F3F3F'><i class='fa fa-lg fa-history' style='color:rgba(171, 166, 166, 1)'></i></div>");
      $(".gm-style-iw").parent().append("<div id='delete' title ='Delete site' value='"+id+"' class='control' style='position: absolute;overflow:none; right:12px;bottom:28px; color:#3F3F3F'><i class='fa fa-lg fa-trash-o' style='color:rgba(171, 166, 166, 1)'></i></div>");
    });
  } 
  });

  return infowindow;
}
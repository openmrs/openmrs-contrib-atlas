var popoverTemplate = '<div class="popover"><div class="arrow"></div><div class="popover-content"></div></div>';

$(function () {
  $('#create-capture').click(function () {
    var lat = map.getCenter().lat();
    var lng = map.getCenter().lng();
    var zoom = map.getZoom();
    var url = "capture?legend=" + legendGroups + "&zoom="
        + zoom + "&lat=" + lat + "&lng=" + lng ;
    console.log(url);
    window.location = url ;
  });
  var message = "<b><h3>About OpenMRS Atlas</h3></b>";
  message += "This map is updated with information from OpenMRS users around the world."
  message +=" To add or edit information, you’ll need a free <a href='https://id.openmrs.org/' target='_blank' >OpenMRS ID.</a>"
  message += "<b><h3>Manually Add Information to Atlas</h3></b>";
  message += "<ul><li>Click “Sign In” and provide your <a href='https://id.openmrs.org/' target='_blank' >OpenMRS ID</a> and password.</li><li>Click the user menu with your name that appears. Choose <b>“Add New Site”</b>.</li>"
  message += "<li>Move the newly-created map marker and place it in the correct location."
  message += "</li><li>Click on the marker, then click the <b><i class='fa fa-lg fa-pencil' style='color:rgba(171, 166, 166, 1)'></i> pencil icon</b> in the pop-up box to edit your information.</li><li>Click <b>Save</b> when finished.</li></ul>";
  message += "<b><h3>Update Information Automatically from OpenMRS</h3></b>";
  message += "<ul><li>If you don't already have the Atlas module installed, <a href='https://modules.openmrs.org/#/show/10/atlas' target='_blank'>download the Atlas Module </a>from OpenMRS Modules manually or through the OpenMRS Modules Administration screen."
  message += "<li>Install the module, following the directions provide in the OpenMRS Modules Administration screen.";
  message += "</li><li>In the OpenMRS Administration page, click on “OpenMRS Atlas” to <b>sign in with your OpenMRS ID</b> and add or update your information.</li></ul>";
  $('#help').click(function () {
    bootbox.dialog({
      message: message,
      className: "help-modal",
      title: "<h2><span class='glyphicon glyphicon-question-sign'></span> <b>OpenMRS Atlas Help</b></h2>",
      buttons: {
        main: {
          label: "Done",
          className: "btn-primary",
        }
      }
    });
  });

  $("#share").popover({
    trigger: "manual",
    template: popoverTemplate,
    placement: "bottom",
    html: "true",
    content: function() {
      return "<input type='text' id='shareURL' style='width: 250px' readonly value='"+getShareUrl()+"'><em>Copy link to your clipboard to share.</em>";
    }
  });
  $("#share").on('shown.bs.popover', function () {
    $("#shareURL").select();
  });
  $('#map_canvas').click(function () {
    $("#share").popover("hide")
  });
  $("#share").click(function (e) {
    e.stopPropagation();
    $("#share").popover("toggle")
  });
  $("#search-bar").val("");
  $("#search").click(function (e) {
    resetFadeGroups();
    showSearchModalBox();
  });
  $("#search-bar").bind('input', function() { 
    resetFadeGroups();
    var search_term = $(this).val().toLowerCase();
    var search_results = document.getElementById("search-results");
    var search_results_html = "";
    if(!search_term) return;
    var count=0;
    Object.keys(sites).forEach(function(id) {
      if(count>=maxSearchResults) return;
      var site = sites[id];
      if(site.siteData.name.toLowerCase().includes(search_term)) {
        search_results_html += "<div class='search-result' onclick='selectSearchResult(\"" + site.siteData.id + "\")'>";
        var marker_image = "";
        getCachedTypes().forEach(function(type) {
          if(marker_image !== "") return;
          if(type.name === site.siteData.type) marker_image = type.icon;
        });
        search_results_html += "<img class='search-image' src='" + marker_image + "' />";
        search_results_html += "<b>" + site.siteData.name + "</b>";
        search_results_html += "</div>";
        count += 1;
      }
    });
    search_results.innerHTML = search_results_html;
  });
  //Toggle search bar if ctrl is pressed
  $(document).keydown(function(event) {
    if(event.keyCode === 191) {
      event.preventDefault();
      resetFadeGroups();
      showSearchModalBox();
    }
  });

});

function showSearchModalBox() {
  $("#search-modal").modal({
    "backdrop"  : true,
    "keyboard"  : true,
    "show"      : true
  });
  setTimeout(function() {
    if($("#search-bar").val() === "") {
      $("#search-bar").focus();
    } else {
      $("#search-bar").select();
    }
  }, 200);
}

function selectSearchResult(id) {
  focusMarker(id);
  $("#search-modal").modal("hide");
}

function initDownloadButton() {
  $('#download').click(function () {

    var controls = document.getElementsByClassName('atlas-container');
    Object.keys(controls).forEach(function(idx) {
      controls[idx].style.visibility = "hidden";
    })
    var fullscreen_control = document.getElementsByClassName('gm-fullscreen-control')[0];
    if(fullscreen_control) fullscreen_control.style.visibility = "hidden";
    var noprint_controls = document.getElementsByClassName('gmnoprint');
    Object.keys(noprint_controls).forEach(function(idx) {
      noprint_controls[idx].style.visibility = "hidden";
    })

    html2canvas(document.getElementById('map_canvas'), {
      scale: 2,
      useCORS: true,
      allowTaint:true,
    }).then(function(canvas) {
      var link = document.createElement("a");
      link.download = "openmrs-atlas.png";
      link.href = canvas.toDataURL("image/png");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      delete link;

      Object.keys(controls).forEach(function(idx) {
        controls[idx].style.visibility = "visible";
      })
      if(fullscreen_control) fullscreen_control.style.visibility = "visible";
      Object.keys(noprint_controls).forEach(function(idx) {
        noprint_controls[idx].style.visibility = "visible";
      })
    });
  });
}

function customizeView() {
  if (viewParam.site !== null) {
    console.log('entered the customview');
    var site;
    sites.forEach(function(val, index) {
      console.log(val.siteData.site_id);
      if (val.siteData.site_id === viewParam.site ) {
        site = val;
        console.log(viewParam.site + site);
      }
    });
    if (site) {
      viewParam.position = site.marker.getPosition();
      console.log('if condition passed')
      setTimeout(function() {
        google.maps.event.trigger(site.marker, 'click');
      }, 1000);
    }
  }
  setTimeout(function() {
    map.setZoom(viewParam.zoom);
    map.setCenter(viewParam.position);
  }, 600);
}

function getLegend() {
  switch(legendGroups) {
    case 2 :
      return "site";
      break;
    case 0 :
      return "type";
      break;
    case 1 :
      return "version";
      break;
    default :
      return "type";
  }
}
function getShareUrl(){
  var site = getOpenBubble();
  var lat = map.getCenter().lat();
  var lng = map.getCenter().lng();
  var zoom = map.getZoom();
  var url = location.protocol + "//" + location.host + "?legend=" + getLegend() + "&zoom="
      + zoom + "&position=" + lat + "," + lng + "&clusters=" + clustersEnabled;
  url = (site == null) ? url : (url + "&site=" + site);
  return url;
}
function getOpenBubble(){
  var site = null;
  sites.forEach(function(val, index) {
    if (val.bubbleOpen === true)
      site = val.siteData.site_id;
  });
  return site;
}

var detachDialog = "This will unlink this server from the site on the Atlas. The Atlas site will no longer be"
detachDialog += " updated by this server. <br> Are you sure you want to unlink this site?"

$(function () {
  if(window !== window.top)
    parent.postMessage("update", "*");
  $("#map_canvas").on("click", "#me-button", function(e) {
    e.preventDefault();
    var id = $(this).val();
    attachMarker(id);
  });

  $("#map_canvas").on("click", "#detach-button", function(e) {
    e.preventDefault();
    var id = $(this).val();
    bootbox.confirm(detachDialog, function(result) {
      if (result) detachMarker(id);
    });
  });

  $("#map_canvas").on("click", "#include-count", function(e){
    $(".site-stat").toggleClass("disabled");
  });
});

function openBubble(uniqueMarker) {
  if (uniqueMarker !== null)
    google.maps.event.trigger(uniqueMarker, 'click');
}

function getModuleMarker(module_id, token) {
  $.ajax({
      url: "/module",
      type: "POST",
      data: encodeURIComponent("module_id")+"="+encodeURIComponent(module_id)+"&"+encodeURIComponent("token")+"="+encodeURIComponent(token),
  })
  .done(function(response) {
    sites[response.id].siteData.module = 1;
    sites[response.id].infowindow.setContent(contentInfowindow(sites[response.id].siteData));
  })
  .fail(function(jqXHR, textStatus, errorThrown) {
    bootbox.alert({ message: "Error fetching module marker - Please try again ! - " + jqXHR.statusText , backdrop: true });
  });
}

function attachMarker(id) {
  var site = sites[id].siteData;
  var json = JSON.stringify({ atlas_id: id });
  $.ajax({
    url: "/api/module/auth",
    type: "POST",
    data: json,
    dataType: "json",
    processData: false,
    contentType: "application/json",
  })
  .done(function(response) {
    Object.keys(sites).forEach(function(siteid) {
      if(sites[siteid].siteData.module === 1) {
        delete sites[siteid].siteData.module;
        sites[siteid].infowindow.setContent(contentInfowindow(sites[siteid].siteData));
      }
    });
    site.module = 1;
    moduleHasSite = 1;
    sites[id].siteData = site;
    sites[id].infowindow.setContent(contentInfowindow(site));
    repaintMarkers();
    if(window !== window.top)
      parent.postMessage("update", "*");
    bootbox.alert({ message: 'The module is now linked to ' + site.name, backdrop: true });
  })
  .fail(function(jqXHR, textStatus, errorThrown) {
    bootbox.alert({ message: "Error linking module to marker - Please try again ! - " + jqXHR.statusText , backdrop: true });
  });
}

function detachMarker(id) {
  if(!sites[id]) return;
  var site = sites[id].siteData;
  $.ajax({
    url: "/api/module/auth",
    type: "DELETE",
    dataType: "text",
  })
  .done(function(response) {
    site.module = 0;
    moduleHasSite = 0;
    sites[id].siteData = site;
    sites[id].infowindow.setContent(contentInfowindow(site));
    repaintMarkers();
    if(window !== window.top)
      parent.postMessage("update", "*");
    bootbox.alert({ message: "Module detached", backdrop: true });
  })
  .fail(function(jqXHR, textStatus, errorThrown) {
    bootbox.alert({ message: "Error deleting authorization - Please try again ! - " + (jqXHR.responseJSON.message? jqXHR.responseJSON.message: jqXHR.statusText), backdrop: true });
  });
}

function openDialogID(url,width,height) 
{ 
    var top =(screen.height - width)/2; 
    var left = (screen.width - height)/2;
    window.open(url+"#redirect-to","Sign In","toolbar=0,menubar=0,location=0,status=0,scrollbars=0,resizable=no,top="+top+",left="+left+",width="+width+",height="+height); 
}

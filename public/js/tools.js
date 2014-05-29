$(function () {
  $('#screenshot').click(function () {
    var centerLat = map.getCenter().lat();
    var centerLng = map.getCenter().lng();
    var zoom = map.getZoom();
    window.location = "capture";
  });
});
$(function () {
  $('#screenshot').click(function () {
    var lat = map.getCenter().lat();
    var lng = map.getCenter().lng();
    var zoom = map.getZoom();
    var url = "capture?legend=" + legendGroups + "&zoom="
     + zoom + "&lat=" + lat + "&lng=" + lng ;
     console.log(url);
    window.location = url ;
  });
});
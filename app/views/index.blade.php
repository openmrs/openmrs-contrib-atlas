<!DOCTYPE html>
<html>
<head>
<title>OpenMRS Atlas</title>
<meta name="viewport" content="initial-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="css/atlas.css" type="text/css" media="screen" />
<link rel="stylesheet" href="css/menu.css" type="text/css" />
<link href="//netdna.bootstrapcdn.com/bootstrap/3.0.0/css/bootstrap-glyphicons.css" rel="stylesheet" />
<link href="//netdna.bootstrapcdn.com/font-awesome/4.1.0/css/font-awesome.min.css" rel="stylesheet">
<script id="globalnav-script" src="https://id.openmrs.org/globalnav/js/app-optimized.js" type="text/javascript"></script>
<script type="text/javascript" src="http://maps.google.com/maps/api/js?sensor=false"></script>
<script src="//ajax.googleapis.com/ajax/libs/jquery/1.11.0/jquery.min.js"></script>
<script type="text/javascript" src="js/user.js"></script>
<script type="text/javascript" src="js/atlas.js"></script>
<script type="text/javascript" src="js/yqlgeo.js"></script>
<script type="text/javascript">
var map;
var currentUser;
var sites = [];
var types = [];
var version = [];
var unknownVersion = 0;
var otherVersion = 0;
var images = [];
var shadows = [];
var fadeOverTime = false;
var legendGroups = 0;
var divSites ='<img src="http://maps.google.com/intl/en_us/mapfiles/ms/micons/red-dot.png"><b>Sites</b>';
var divTypes ='<img src="images/group-dot.png"><b>Types</b>'
var divVersions ='<img src="images/group-dot.png"><b>Versions</b>';

$(document).ready(function() {
  initLegendChoice();
  initLoginButton();
  currentUser = $('#user-id').val().trim();
 });

setTimeout('initialize()', 500);
</script>
</head>
<body>
  <div id="map_title"><img src="images/OpenMRS-logo.png" /></div>
  <div id="map_canvas" style="width:100%; height:100%"></div>
  <div id="legend" class="control"></div>
  @if (Session::has(user))
  <div class="container control logged" id ="login">
      <div class="dropDownControl" id="user"><span class="glyphicon glyphicon-user"></span> {{ $user->name }}</div>
      <div class = "dropDownOptionsDiv" id="logout">
      <div class = "dropDownItemDiv" id="editSite"><img src="images/blue-dot.png">Edit my site</div>
        <div class = "dropDownItemDiv" id="newSite"><img src="images/blue-dot.png">Add new site</div>
        <div class = "dropDownItemDiv" id="logout"><span class="glyphicon glyphicon-log-out"></span> {{ link_to_route('logout', 'Logout' )}}</div>
          <div class="separatorDiv"></div>        
      </div>          
  </div>
  @else
    <div class="loginControl dropDownControl control" title="Click to login with your OpenMRS ID" id ="login">
    <span class="glyphicon glyphicon-log-in"></span> {{ link_to_route('login', 'Login' )}}
  </div>
  @endif
  <div class="container control login" id ="marker-groups">
      <div class="dropDownControl" id="legendSelected" title="Click to switch legend"></div>
      <div class = "dropDownOptionsDiv" id="legendChoice">
          <div class = "dropDownItemDiv" id="legend1"></div>
          <div class = "dropDownItemDiv" id="legend2"></div>
          <div class="separatorDiv"></div>        
      </div>          
  </div>
  <div id='atlas-hidden-latitude' style='hidden:true;'></div>
  <div id='atlas-hidden-longitude' style='hidden:true;'></div>
  <input type="hidden" id="user-id" value="{{ $user->uid }} " />
</body>
</html>
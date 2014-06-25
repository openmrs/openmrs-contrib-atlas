<!DOCTYPE html>
<html>
<head>
<title>OpenMRS Atlas</title>
<meta name="viewport" content="initial-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="css/atlas.css" type="text/css" media="screen" />
<link rel="stylesheet" href="lib/css/font-awesome.min.css">
<link rel="stylesheet" href="lib/css/bootstrap.min.css">
<script id="globalnav-script" src="https://id.openmrs.org/globalnav/js/app-optimized.js" type="text/javascript"></script>
<script type="text/javascript" src="https://maps.google.com/maps/api/js?sensor=false"></script>
<script type="text/javascript" src="lib/js/jquery-1.11.1.min.js"></script>
<script type="text/javascript" src="lib/js/bootstrap.min.js"></script>
<script type="text/javascript" src="lib/js/gmap3.min.js"></script>
<script type="text/javascript" src="lib/js/bootbox.min.js"></script>
<script type="text/javascript" src="js/user.js"></script>
<script type="text/javascript" src="js/atlas.js"></script>
<script type="text/javascript" src="js/tools.js"></script>
<script type="text/javascript" src="lib/js/yqlgeo.js"></script>
<script type="text/javascript">
var auth = null;
@if ( strlen($auth_site) > 5)
  auth = JSON.stringify({{ $auth_site }});
@endif
if (auth != null) 
  var auth_site = JSON.parse(auth);
else
  var auth_site = "";
var siteSrc = "{{ getenv('SITE_SOURCE') }}";
var currentUser;
var userEmail;
var userName;
var nextSite = 0;
var map;
var sites = [];
var types = [];
var version = [];
var unknownVersion = 0;
var otherVersion = 0;
var images = [];
var shadows = [];
var fadeOverTime = true;
var legendGroups = 0;
var divSites ='<img src="https://maps.google.com/intl/en_us/mapfiles/ms/micons/red-dot.png"><b>Sites</b>';
var divTypes ='<img src="images/group-dot.png"><b>Types</b>'
var divVersions ='<img src="images/group-dot.png"><b>Versions</b>';

$(document).ready(function() {
  initLegendChoice();
  initLoginButton();
  initDownloadButton();
  currentUser = $('#user-id').val().trim();
  if (currentUser == '') currentUser = 'visitor';
  userName = $('#user-name').val().trim();
  userEmail = $('#user-email').val().trim();
 });

setTimeout('initialize()', 500);
</script>
@if ( app()->env == 'prod')
<script>
(function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function()
{ (i[r].q=i[r].q||[]).push(arguments)}
,i[r].l=1*new Date();a=s.createElement(o),
m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
})(window,document,'script','//www.google-analytics.com/analytics.js','ga');
ga('create', 'UA-16695719-3', 'openmrs.org');
ga('require', 'displayfeatures');
ga('send', 'pageview');
</script>
@endif
</head>
<body>
  <div id="map_title"><img src="images/OpenMRS-logo.png" /></div>
  <div id="map_canvas" style="width:100%; height:100%"></div>
  <div id="legend" class="control"></div>
  <div class="atlas-container control screen" id ="download">
      <div class="dropDownControl control"
        title="Click to download a screenshot" id ="down-screen">
        <i class="fa fa-download"></i></span> Download
      </div>
      <div class = "dropDownOptionsDiv screen" id="screen">
        <div class = "dropDownItemDiv screen" id="1024x768"><i class="fa fa-file-image-o"></i>1024x768</div>
        <div class = "dropDownItemDiv screen" id="1280x1024"><i class="fa fa-file-image-o"></i>1920x1080</div>
        <div class = "dropDownItemDiv screen" id="3840x2160"><i class="fa fa-file-image-o"></i>3840x2160</div>
        <div class="separatorDiv"></div>
      </div>
  </div>
  @if (Session::has(user))
  <div class="atlas-container control logged" id ="login">
      <div class="dropDownControl" id="user"><span class="glyphicon glyphicon-user"></span> {{ $user->name }}</div>
      <div class = "dropDownOptionsDiv" id="logout">
        <div class = "dropDownItemDiv" id="locateMe"><img src="images/blue-dot.png">Locate Me</div>
        <div class = "dropDownItemDiv" id="editSite" @if(strlen($auth_site) < 5) hidden="true" @endif>
        <img src="images/blue-dot.png">Edit my site</div>
        <div class = "dropDownItemDiv" id="newSite"><img src="images/blue-dot.png">Add new site</div>
        <div class = "dropDownItemDiv" id="logout"><span class="glyphicon glyphicon-log-out"></span> {{ link_to_route('logout', 'Logout' )}}</div>
        <div class="separatorDiv"></div>        
      </div>          
  </div>
  @else
    <div class="atlas-container loginControl dropDownControl control" title="Click to login with your OpenMRS ID" id ="login">
    <span class="glyphicon glyphicon-log-in"></span> {{ link_to_route('login', 'Login' )}}
  </div>
  @endif
  <div class="atlas-container control login" id ="marker-groups">
      <div class="dropDownControl" id="legendSelected" title="Click to switch legend"></div>
      <div class = "dropDownOptionsDiv" id="legendChoice">
          <div class = "dropDownItemDiv" id="legend1"></div>
          <div class = "dropDownItemDiv" id="legend2"></div>
          <div class = "dropDownItemDiv" id="fade" title="Fade outdated sites over time.">
            <label><input type="checkbox" id="fadeCheckbox"><b>Fade</b></label>
          </div>
      </div>          
  </div>     
  <div id='atlas-hidden-latitude' style='hidden:true;'></div>
  <div id='atlas-hidden-longitude' style='hidden:true;'></div>
  <input type="hidden" id="user-id" value="{{ $user->uid }} " />
  <input type="hidden" id="user-name" value="{{ $user->name }} " />
  <input type="hidden" id="user-email" value="{{ $user->email }} " />
</html>
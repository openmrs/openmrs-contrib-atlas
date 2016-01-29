<!DOCTYPE html>
<html>
<head>
<title>OpenMRS Atlas</title>
<meta name="viewport" content="initial-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="css/atlas.css" type="text/css" media="screen" />
<link rel="stylesheet" href="lib/css/font-awesome.min.css">
<link rel="stylesheet" href="lib/css/bootstrap.min.css">
@if (!Session::has(module))
<script id="globalnav-script" src="https://id.openmrs.org/globalnav/js/app-optimized.js" type="text/javascript"></script>
@endif
<script type="text/javascript" src="https://maps.google.com/maps/api/js?sensor=false"></script>
<script type="text/javascript" src="lib/js/jquery-1.11.1.min.js"></script>
<script type="text/javascript" src="lib/js/bootstrap.min.js"></script>
<script type="text/javascript" src="lib/js/gmap3.min.js"></script>
<script type="text/javascript" src="lib/js/bootbox.min.js"></script>
<script type="text/javascript" src="js/user.js"></script>
<script type="text/javascript" src="js/atlas.js"></script>
<script type="text/javascript" src="js/tools.js"></script>
<script type="text/javascript" src="js/module.js"></script>
<script type="text/javascript" src="lib/js/yqlgeo.js"></script>
<script type="text/javascript" src="https://google-maps-utility-library-v3.googlecode.com/svn/trunk/markerclustererplus/src/markerclusterer_packed.js"></script>
<script type="text/javascript">
var auth = null;
var moduleUUID = null;
var counts = {};
var countsEnabled = 1;
var moduleHasSite = null;
@if ( strlen($auth_site) > 30)
  auth = JSON.stringify({{ $auth_site }});
@endif
if (auth != null) 
  var auth_site = JSON.parse(auth);
else
  var auth_site = "";
@if ( strlen($moduleUUID) > 30)
  @if (Input::has('patients'))
  counts.patients = {{ Input::get('patients') }} ;
  @endif
  @if (Input::has('encounters'))
  counts.encounters = {{ Input::get('encounters') }} ;
  @endif
  @if (Input::has('observations'))
  counts.observations = {{ Input::get('observations') }} ;
  @endif
  @if (Input::has('sendCounts'))
  countsEnabled = {{ Input::get('sendCounts') }} ;
  @endif
  moduleUUID = "{{ $moduleUUID }}";
  moduleHasSite = {{ $moduleHasSite }};
@endif
var siteSrc = "{{ getenv('SITE_SOURCE') }}";
var currentUser;
var userEmail;
var userName;
var nextSite = 0;
var map;
var clusters;
var clustersEnabled = 0;
var sites = [];
var types = [];
var existingVersion = [];
var version = [];
var unknownVersion = 0;
var otherVersion = 0;
var images = [];
var shadows = [];
var fadeOverTime = true;
var legendGroups = 0;
var viewParam = {
  site : null,
  position : new google.maps.LatLng(15,15),
  zoom : 3,
};
@if (Input::has('site'))
  viewParam.site = "{{ Input::get('site') }}";
@endif
@if (Input::has('zoom') && is_numeric(Input::get('zoom')))
  viewParam.zoom = {{ Input::get('zoom') }};
@endif
@if (Input::has('position') && preg_match('/^[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?),*[-+]?(180(\.0+)?|((1[0-7]\d)|([1-9]?\d))(\.\d+)?)$/', Input::get('position')))
  viewParam.position = new google.maps.LatLng({{ Input::get('position') }});
@endif
@if (Input::has('legend'))
  switch("{{ Input::get('legend') }}") {
    case "site" :
      legendGroups = 2;
      break;
    case "type" :
      legendGroups = 0;
      break;
    case "version" :
      legendGroups = 1;
      break;
    default :
      legendGroups = 0;
  }
@endif
@if (Input::get('clusters') == true)
  clustersEnabled = 1;
  legendGroups = 2;
@endif
$(document).ready(function() {
  @if ( strlen($moduleUUID) > 30)
    legendGroups = 2;
  @endif
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
  <div id="map_title"></div>
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
        @if ($user->role == 'ADMIN' && !Input::has('uuid'))
        <div class = "dropDownItemDiv" id="admin"><span class="glyphicon glyphicon-wrench"></span> {{ link_to_route('admin', ' Admin' )}}</div>
        @endif
        <div class = "dropDownItemDiv" id="locateMe"><img src="images/blue-dot.png">Locate Me</div>
        <div class = "dropDownItemDiv" id="editSite" @if(strlen($auth_site) < 5) hidden="true" @endif>
        <img src="images/blue-dot.png">Edit my site</div>
        <div class = "dropDownItemDiv" id="newSite"><img src="images/blue-dot.png">Add new site</div>
        <div class = "dropDownItemDiv" id="logout"><span class="glyphicon glyphicon-log-out"></span> 
        @if (!Session::has(module))
          {{ link_to_route('logout', 'Sign Out' )}}
        @else
          {{ link_to_route('logout', 'Sign Out', array('uuid' => $moduleUUID), array('target'=>'blank'))}}
        @endif
        </div>
        <div class="separatorDiv"></div>        
  </div>
  @else
    <div class="atlas-container loginControl dropDownControl control" title="Click to sign in with your OpenMRS ID" id ="login">
    <span class="glyphicon glyphicon-log-in"></span>
    @if (!Session::has(module))
      {{ link_to_route('login', 'Sign In')}}
    @else
      {{ link_to_route('login', 'Sign In', null, array('onclick'=>'openDialogID(this.href,1100,500);return false;'))}}
    @endif
  </div>
  @endif
  <div class="atlas-container loginControl dropDownControl control" title="How to place my information on the Atlas" id ="help">
  <span class="glyphicon glyphicon-question-sign"></span> Help
  </div>
  <div tabindex="1" class="atlas-container loginControl dropDownControl control" title="Share this Atlas view" id ="share">
  <span class="glyphicon glyphicon-share"></span> Share
  </div>
  <div class="atlas-container control login" id ="marker-groups">
      <div class="dropDownControl enabled" id="groups" title="Click to switch legend"><img src="images/group-dot.png"><b> View</b></div>
      <div class = "dropDownOptionsDiv" id="legendChoice">
          <div class = "dropDownItemDiv" id="legend-group"> <label><input type="checkbox" id="group-checkbox"><b>Group</b></label></div>
          <div class = "dropDownItemDiv enabled" id="legend-type"><img src="images/group-dot.png"><b>Types</b></div>
          <div class = "dropDownItemDiv" id="legend-version"><img src="images/group-dot.png"><b>Versions</b></div>
          <div class = "dropDownItemDiv" id="fade" title="Fade outdated sites over time.">
            <label><input type="checkbox" id="fadeCheckbox"><b>Fading</b></label>
          </div>
          <div class = "dropDownItemDiv" id="legend-clusters" title="Enable markers clustering.">
            <label><input type="checkbox" id="clusters-checkbox"><b>Clustering</b></label>
          </div>
      </div>          
  </div>     
  <div id='atlas-hidden-latitude' style='hidden:true;'></div>
  <div id='atlas-hidden-longitude' style='hidden:true;'></div>
  <input type="hidden" id="user-id" value="{{ $user->uid }} " />
  <input type="hidden" id="user-name" value="{{ $user->name }} " />
  <input type="hidden" id="user-email" value="{{ $user->email }} " />
</body>
</html>
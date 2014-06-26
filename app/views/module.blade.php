<html>
<head>
<title>Sign In</title>
<meta name="viewport" content="initial-scale=1.0, user-scalable=no" />
{{ HTML::style('css/atlas.css') }}
{{ HTML::style('lib/css/font-awesome.min.css') }}
{{ HTML::style('lib/css/bootstrap.min.css') }}
<script type="text/javascript" src="{{ asset('lib/js/jquery-1.11.1.min.js') }}"></script>
<script type="text/javascript" src="{{ asset('lib/js/bootstrap.min.js') }}"></script>
<style>
.close {
	display: none;
}
#signin {
	overflow: hidden;
}
.modal-vertical-centered {
  transform: translate(0, 25%) !important;
  -ms-transform: translate(0, 25%) !important; /* IE 9 */
  -webkit-transform: translate(0, 25%) !important; /* Safari and Chrome */
}
</style>
<script type="text/javascript">
$(document).ready(function() {
    parent.postMessage("update", "*");
	$('#buttonS').click(function() {
		var NWin = popupWindowCenter($(this).prop('href'), '', 1000,500);
		if (window.focus) 
			NWin.focus();
		return false;
	});
	$('#signin').modal({
		keyboard: false,
		backdrop: 'static'
	});
	$('#signin').modal('show');
	$('#signin').on('hidden.bs.modal', function (e) {
		$('#signin').modal('show');
	});
});
function popupWindowCenter(URL,title,w,h){
	var left = (screen.width/2)-(w/2);
	var top = (screen.height/2)-(h/2);
	var newWin = window.open (URL, title, 'toolbar=no, location=no,directories=no, status=no, menubar=no, scrollbars=no, resizable=no,copyhistory=no, width='+w+', height='+h+', top='+top+', left='+left);
	return newWin;
}
</script>
</head>
<body>
<div class="modal modal-vertical-centered" id="signin" tabindex="-1" role="dialog" aria-labelledby="Sign In Required" aria-hidden="true">
  <div class="modal-dialog modal-sm">
    <div class="modal-content">
    	<div class="modal-header">
	        <button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>
	        <h3 class="modal-title">Sign In Required</h4>
      	</div>
      	<div class="modal-body">
	        {{ link_to_route('login', 'Sign in with your OpenMRS ID', null, array('id'=>'buttonS', 'class'=>'btn btn-primary btn-block')) }}
      </div>
    </div>
  </div>
</div>
</body>
</html>
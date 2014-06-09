<html>
<script type="text/javascript">
	window.onunload = refreshParent;
	function refreshParent() {
	    window.opener.location.reload();
	}
	window.onload=function(){
		window.close();
	}
</script>
</html>


<!DOCTYPE html>
<html>
<head>
<title>Atlas Administration</title>
{{ HTML::style('css/admin.css') }}
{{ HTML::style('lib/css/font-awesome.min.css') }}
{{ HTML::style('lib/css/bootstrap.min.css') }}
</head>
<body>
<div class="header">
<div id="logo"><img src="images/OpenMRS-logo.png" /></div>
<div><h1>Atlas Administration</h1></div>
</div>
<div class="container-fluid" style="text-align: center">
	@if ($info !== null)
		<p class="bg-success">{{ $info }}</p>
	@endif
	@if ($error !== null)
		<p class="bg-danger">{{ $error }}</p>
	@endif
	<div class="row">
		<div class="span8 offset2">
			<div class="query">
				{{ Form::open(array('url' => 'admin',  'class'=>'form-horizontal')) }}
				<div class="form-group">
					<div class="controls">
					{{ Form::textarea('query', null, array(
						'class'=>'form-control',
						'required'=>'required',
						'placeholder' => 'Enter your SQL Query')) }}
					</div>
				</div>
				<div class="form-group">
					<div class="controls">
					<br><input type="submit" value="Execute Query" class="btn-success btn btn-block"/>
					</div>
				</div>
				{{ Form::close() }}
			</div>
			<div class="show">
			@if ($results !== null)
				<h3>Result</h3>
				<table class="table table-bordered table-striped">
					<thead>
					<tr>
					@foreach ($columns as $col)
					<th>{{ $col }}</th>
					@endforeach
					</tr>
					</thead>
					<tbody>
					@foreach ($results as $row)
					<tr>
					@foreach ($row as $value)
					<td>{{ $value }}</td>
					@endforeach
					</tr>
					@endforeach
					</tbody>
				</table>
			@endif
			</div>
		</div>
	</div>
</div>
</body>
</html>
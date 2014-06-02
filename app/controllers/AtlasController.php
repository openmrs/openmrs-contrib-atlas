<?php

class AtlasController extends BaseController {

    /**
     *  Decode multipass token and log user
     */

    public function takeCapture()
    {
    	if (!Input::has('legend') || !Input::has('zoom') || !Input::has('lat') || !Input::has('lng'))
	 		App::abort(500, 'Missing parameters');
	 	
    	$phantomjs = getenv('PHANTOM_PATH');
		$filename = storage_path() . '/captures/capture_' . str_random(12) . '.png';
		$legend = Input::get('legend');
		$zoom = Input::get('zoom');
		$lat = Input::get('lat');
		$lng = Input::get('lng');
		$siteURL = getenv('SITE_URL');
	 	Log::info('Temp file name:' . $filename);

	 	App::finish(function($request, $response) use ($filename)
		{
			if (file_exists($filename)) {
				unlink($filename);
				Log::info('Temp file removed');
			}
		});
		
	 	$command = $phantomjs . ' ' . public_path() . '/js/capture.js ' . $filename .' '. $legend . ' '
	 	 . $zoom . ' ' . $lat . ' ' . $lng . ' ' . $siteURL;
	 	Log::info('Comand:' . $command);
		shell_exec($command);

    	if ( file_exists($filename)) {
    		$file = 'atlas_capture.png';
    		return Response::download($filename, $file);
		} else {	
    		App::abort(500, 'Capture error');
		}
	}

	public function downloadCapture()
    {
		$legend = Input::get('legend');
		$size = Input::get('size');
		$siteURL = getenv('SITE_URL');
		
		$requestedFile =  storage_path(). '/captures/atlas'. $legend . '_' . $size . '.png';

    	if ( file_exists($requestedFile)) {
    		$file = 'atlas_capture' . $size . '.png';
    		return Response::download($requestedFile, $file);
		} else {	
    		App::abort(404, 'Image not found');
		}
	}

	public function cronCapture()
    {
    	$phantomjs = getenv('PHANTOM_PATH');
		$legend = Input::get('legend');
		$zoom = Input::get('zoom');
		$width = Input::get('width');
		$height = Input::get('height');
		$size = $width . 'x' . $height;
		$siteURL = getenv('SITE_URL');
		$filename =  storage_path(). '/captures/atlas'. $legend . '_' . $size . '.png';
		$path = storage_path(). '/captures';
	 	$command = $phantomjs . ' ' . public_path() . '/js/capture-cron.js ' . $path .' '. $legend . ' '
	 	 . $width . ' ' . $height . ' ' . $siteURL . ' > ' . storage_path(). '/phantomjs.log';
	 	Log::info('Comand:' . $command);
		shell_exec($command);

    	if ( file_exists($filename)) {
    		$file = 'atlas_capture.png';
    		return Response::download($filename, $file);
		} else {	
    		App::abort(500, 'Capture error');
		}
	}
}
<?php

class AtlasController extends BaseController {

    /**
     *  Decode multipass token and log user
     */

    public function takeCapture()
    {
    	$phantomjs = getenv('PHANTOM_PATH');
		$filename = storage_path() . '/capture_' . str_random(12) . '.png';
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
}
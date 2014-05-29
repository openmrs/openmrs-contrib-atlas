<?php

class AtlasController extends BaseController {

    /**
     *  Decode multipass token and log user
     */

    public function takeCapture()
    {
    	$phantomjs = getenv('PHANTOM_PATH');
		$filename = storage_path() . '/capture_' . str_random(12) . '.png';
	 	Log::info('Temp file name:' . $filename);

	 	App::finish(function($request, $response) use ($filename)
		{
			if (file_exists($filename)) {
				unlink($filename);
				Log::info('Temp file removed');
			}
		});
		
	 	$command = $phantomjs . ' ' . public_path() . '/js/capture.js ' . $filename . ' > '. storage_path() . '/phantomjs.log';
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
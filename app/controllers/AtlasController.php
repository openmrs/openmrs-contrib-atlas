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
		$filename = storage_path() . '/captures/capture_' . str_random(12) . '.jpg';
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
    		$file = 'atlas_capture.jpg';
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
		$fade = 0;
		if (Input::get('fade') === "true")
			$fade = 1;
		$requestedFile =  storage_path(). '/captures/atlas'. $legend . $fade . '_' . $size . '.jpg';

    	if ( file_exists($requestedFile)) {
    		$file = 'openmrs_atlas_' . $size . '.jpg';
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
		$filename =  storage_path(). '/captures/atlas'. $legend . '_' . $size . '.jpg';
		$path = storage_path(). '/captures';
	 	$command = $phantomjs . ' ' . public_path() . '/js/capture-cron.js ' . $path .' '. $legend . ' '
	 	 . $width . ' ' . $height . ' ' . $siteURL . ' > ' . storage_path(). '/phantomjs.log';
	 	Log::info('Comand:' . $command);
		shell_exec($command);

    	if ( file_exists($filename)) {
    		$file = 'atlas_capture.jpg';
    		return Response::download($filename, $file);
		} else {	
    		App::abort(500, 'Capture error');
		}
	}

	public function rssGenerator($updates = null)
	{
		if($updates == "updates")
			$sites = DB::table('archive')->where('action', 'UPDATE')->take(100)->orderBy('archive_date', 'desc')->get();
        else if($updates == "all")
        	$sites = DB::table('archive')->take(100)->orderBy('archive_date', 'desc')->get();
		else
			$sites = DB::table('archive')->whereNotIn('action', array('UPDATE'))->orderBy('archive_date', 'desc')->take(100)->get();

		foreach ($sites as $site) {
			$site = (array)$site;
		    $major = 0;
		    $minor = 0;
		    if ($site['show_counts'] == 0) {
				$site['patients'] = 0;
				$site['encounters'] = 0;
				$site['observations'] = 0;
			}
		    $atlasVersion = json_decode($site['atlas_version']);
		    if ($atlasVersion != null)
		        list($major, $minor) = explode(".", $atlasVersion);
		    if ($major >= 1 && $minor > 1) {
		        unset($site['data']);
		        //TODO
		        $sitesList[] = $site;
		    } else {
		        $dataJson = json_decode($site['data'], true);
		        $version = $dataJson['version'];
		        $site['version'] = $version;
		        unset($site['data']);
		        $sitesList[] = $site;
		    }
		}

		$feed = Feed::make();

		$openmrs = new FeedPerson;
		$openmrs->name('OpenMRS');
		$openmrs->email('helpdesk@openmrs.org');

		$logo = new FeedImage;
		$logo->title('OpenMRS Atlas Feed');
		$logo->imageUrl(asset('images/openmrs.gif'));
		$logo->linkUrl(route('home'));

		$feed->channel()->BaseURL(route('home'));
		$feed->channel()->Title()->Add('text', 'OpenMRS Atlas Feed');
		$feed->channel()->Author(0, $openmrs);
		$feed->channel()->permalink(route('rss'));
		$feed->channel()->Description()->Add('text', 'Latest updates on OpenMRS Atlas');
		$feed->links()->add(new FeedLink('text', (route('home'))));
		$feed->logo()->title('OpenMRS Atlas Feed')
			->imageUrl(asset('images/openmrs.gif'))
			->linkUrl(route('home'))->up()
		    ->pubdate(time())
		    ->permalink(route('rss'))
		    ->baseurl(route('home'));

		foreach ($sitesList as $site) {

			$title = $site['name'];

			if ($site['action'] === "ADD")
				$title = $site['name'] . " joined the OpenMRS Atlas";
			if ($site['action'] === "UPDATE")
				$title = $site['name'] . " updated on OpenMRS Atlas";
			if ($site['action'] === "DELETE")
				$title = "OpenMRS Atlas bids farewell to " . $site['name'];

			$dateCreated = new DateTime($site['date_created']);
			$notes = ($site['notes'] == "") ? "" : "<br><b>Notes:</b> " . $site['notes'];
			$url = ($site['url'] == ""  && filter_var($site['url'], FILTER_VALIDATE_URL)) ? "" : "<br><a href=\"".$site['url']."\">" . $site['url'] . "</a>";
			$observations = preg_match("/^$|0/", $site['observations']) ? "" : "<br><b>Observation:</b> " . $site['observations'];
			$encounters = preg_match("/^$|0/", $site['encounters']) ? "" : "<br><b>Encounters:</b> " . $site['encounters'];
			$patients = preg_match("/^$|0/", $site['patients']) ? "" : "<br><b>Patients:</b> " . $site['patients'];
			$counts = $encounters . $patients . $observations;
			$site['version'] = ($site['version'] == "") ? "Unknown" : $site['version'];
			
			$content = '<b>OpenMRS Version :</b> ' . $site['version'] . $counts . $notes . "<br><b>Date created :</b> " . $dateCreated->format('Y-m-d H:i:s') . $url ;

	        $date = new DateTime($site['archive_date']);
			$feed->entry()->published($date->getTimeStamp())
				->author()->name($site['contact'])->email($site['email'])->up()
	            ->title($title)
	            ->guid($site['id'])
	            ->permalink(route('home') . '?site=' . $site['site_uuid'])
	            ->category($site['type'])
	            ->content()->add('html',$content)->up();
		}
		
		$response = Response::make($feed->Rss20(), 200);
		$response->header('Content-Type', 'application/rss+xml');
		return $response;
	}
}
<?php

use Illuminate\Console\Command;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Input\InputArgument;

class CaptureCommand extends Command {

	/**
	 * The console command name.
	 *
	 * @var string
	 */
	protected $name = 'screen-capture';

	/**
	 * The console command description.
	 *
	 * @var string
	 */
	protected $description = 'Generate HD screenshot.';

	/**
	 * Create a new command instance.
	 *
	 * @return void
	 */
	public function __construct()
	{
		parent::__construct();
	}

	/**
	 * Execute the console command.
	 *
	 * @return mixed
	 */
	public function fire()
	{
		$force = $this->option('force');
		$path = storage_path(). '/captures';
		$rep = scandir($path);
		
		$date = new Datetime();
		$date = $date->modify('-10 minute');
		$this->info('Last checked: ' . $date->format('Y-m-d H:i:s'));
		
		$lastCreated = DB::table('atlas')->select('date_created')->orderBy('date_created', 'desc')->first();
		$lastChanged = DB::table('archive')->select('archive_date')->orderBy('archive_date', 'desc')->first();

		Log::debug('Last updated: ' . $lastChanged->archive_date);
		Log::debug('Last created: ' . $lastCreated->date_created);
		Log::debug('Number of images: ' . count($rep));
		$this->info('Last updated: ' . $lastChanged->archive_date);
		$this->info('Last created: ' . $lastCreated->date_created);
		$this->info('Number of images: ' . count($rep));

		$dateCreated = new Datetime($lastCreated->date_created);
		$dateChanged = new Datetime($lastChanged->archive_date);
		if (count($rep) < 4 || $force ||  ($dateChanged > $date) ||  ($dateCreated > $date) ) {
			$this->info('Generating screenshot');
			$phantomjs = getenv('PHANTOM_PATH');
			$siteURL = getenv('SITE_URL');
			$path = storage_path(). '/captures';
			for ($i = 0; $i < 4; $i++) {
				for ($j = 0; $j < 2; $j++) {
					$legend = $i;
					$fade = $j;
					$width = '1024';
					$height = '768';
					$size = $width . 'x' . $height;
					$filename =  storage_path(). '/captures/atlas'. $legend . $fade .'_' . $size . '.jpg';
					if (file_exists($filename))
						unlink($filename);

				 	$command = $phantomjs . ' ' . public_path() . '/js/capture-cron.js ' . $path .' '. $legend . ' '
				 	 . $width . ' ' . $height . ' ' . $siteURL . ' ' . $fade . ' > ' . storage_path(). '/phantomjs.log';
				 	Log::debug('Comand:' . $command);
					shell_exec($command);
					Log::debug('Image created: ' . $filename);
					$this->info('Image created: ' . $filename);

					$width = '1920';
					$height = '1080';
					$size = $width . 'x' . $height;

					$filename =  storage_path(). '/captures/atlas'. $legend . $fade . '_' . $size . '.jpg';
					if (file_exists($filename))
						unlink($filename);

				 	$command = $phantomjs . ' ' . public_path() . '/js/capture-cron.js ' . $path .' '. $legend . ' '
				 	 . $width . ' ' . $height . ' ' . $siteURL . ' ' . $fade . ' > ' . storage_path(). '/phantomjs.log';
				 	Log::debug('Comand:' . $command);
					shell_exec($command);
					Log::debug('Image created: ' . $filename);
					$this->info('Image created: ' . $filename);

					$width = '3840';
					$height = '2160';
					$size = $width . 'x' . $height;

					$filename =  storage_path(). '/captures/atlas'. $legend . $fade . '_' . $size . '.jpg';
					if (file_exists($filename))
						unlink($filename);

				 	$command = $phantomjs . ' ' . public_path() . '/js/capture-cron.js ' . $path .' '. $legend . ' '
				 	 . $width . ' ' . $height . ' ' . $siteURL . ' ' . $fade . ' > ' . storage_path(). '/phantomjs.log';
				 	Log::debug('Comand:' . $command);
					shell_exec($command);
					Log::debug('Image created: ' . $filename);
					$this->info('Image created: ' . $filename);
				}
			}
			Log::debug('Screenshot creation succesfull');
			$this->info('Screenshot creation succesfull');
		} else {
			Log::debug('Screenshot are up to date');
			$this->info('Screenshot are up to date');
		}

	}

	/**
	 * Get the console command arguments.
	 *
	 * @return array
	 */
	protected function getArguments()
	{
		return array(
		);
	}

	/**
	 * Get the console command options.
	 *
	 * @return array
	 */
	protected function getOptions()
	{
		return array(
			array('force', null, InputOption::VALUE_NONE, 'Force screenshot update', null)
		);
	}

}

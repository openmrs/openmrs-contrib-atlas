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
		
		$lastUpdate = DB::table('atlas')->select('date_changed')->orderBy('date_changed', 'desc')->first();
		Log::info('Last updated: ' . $lastUpdate->date_changed);
		$this->info('Last updated: ' . $lastUpdate->date_changed);

		$dateChanged = new Datetime($lastUpdate->date_changed);
		if (count($rep) == 0 || $force ||  ($dateChanged > $date) ) {
			$this->info('Generating screenshot');
			$phantomjs = getenv('PHANTOM_PATH');
			$siteURL = getenv('SITE_URL');
			$path = storage_path(). '/captures';
			for ($i = 0; $i < 3; $i++) {
				$legend = $i;
				$width = '1024';
				$height = '768';
				$size = $width . 'x' . $height;
				$filename =  storage_path(). '/captures/atlas'. $legend . '_' . $size . '.png';
				if (file_exists($filename))
					unlink($filename);

			 	$command = $phantomjs . ' ' . public_path() . '/js/capture-cron.js ' . $path .' '. $legend . ' '
			 	 . $width . ' ' . $height . ' ' . $siteURL . ' > ' . storage_path(). '/phantomjs.log';
			 	Log::info('Comand:' . $command);
				shell_exec($command);
				Log::info('Image created: ' . $filename);
				$this->info('Image created: ' . $filename);

				$width = '1920';
				$height = '1080';
				$size = $width . 'x' . $height;
				$filename =  storage_path(). '/captures/atlas'. $legend . '_' . $size . '.png';
				if (file_exists($filename))
					unlink($filename);

			 	$command = $phantomjs . ' ' . public_path() . '/js/capture-cron.js ' . $path .' '. $legend . ' '
			 	 . $width . ' ' . $height . ' ' . $siteURL . ' > ' . storage_path(). '/phantomjs.log';
			 	Log::info('Comand:' . $command);
				shell_exec($command);
				Log::info('Image created: ' . $filename);
				$this->info('Image created: ' . $filename);
			}
			Log::info('Screeshot creation succesfull');
			$this->info('Screeshot creation succesfull');
		} else {
			Log::info('Screenshot are up to date');
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
			array('force', null, InputOption::VALUE_NONE, 'Force screnshot update', null)
		);
	}

}

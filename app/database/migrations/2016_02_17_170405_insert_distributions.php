<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class InsertDistributions extends Migration {

	public function up()
	{
		DB::table('distributions')->insert(
			array(
				array(
					'name'=>'OpenMRS 1.x',
					'is_standard'=>true
				),array(
				'name'=>'Reference Application 2.x',
				'is_standard'=>true
			),array(
				'name'=>'Bahmni',
				'is_standard'=>true
			),array(
				'name'=>'KenyaEMR',
				'is_standard'=>true
			)
			)
		);
	}

	public function down()
	{
		DB::table('distributions')->delete();
	}

}

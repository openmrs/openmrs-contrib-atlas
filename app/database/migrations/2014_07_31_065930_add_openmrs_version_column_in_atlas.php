<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class AddOpenmrsVersionColumnInAtlas extends Migration {

	/**
	 * Run the migrations.
	 *
	 * @return void
	 */
	public function up()
	{
		Schema::table('atlas', function(Blueprint $table)
		{
			$table->string('openmrs_version', 50);
		});
		Schema::table('archive', function(Blueprint $table)
		{
			$table->string('openmrs_version', 50);
		});
	}

	/**
	 * Reverse the migrations.
	 *
	 * @return void
	 */
	public function down()
	{
		Schema::table('atlas', function(Blueprint $table)
		{
			if (Schema::hasColumn('atlas', 'openmrs_version'))
				$table->dropColumn("openmrs_version");
		});
		Schema::table('archive', function(Blueprint $table)
		{
			if (Schema::hasColumn('archive', 'openmrs_version'))
				$table->dropColumn("openmrs_version");
		});
	}

}

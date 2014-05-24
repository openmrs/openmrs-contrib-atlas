<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class UpdateArchive extends Migration {

	/**
	 * Run the migrations.
	 *
	 * @return void
	 */
	public function up()
	{
		if (Schema::hasColumn('archive', 'openmrs_id'))
    	{
	        Schema::table('archive', function(Blueprint $table)
	        {
	                $table->renameColumn('openmrs_id', 'changed_by');
	        });
    	}
	}

	/**
	 * Reverse the migrations.
	 *
	 * @return void
	 */
	public function down()
	{
		if (Schema::hasColumn('archive', 'changed_by'))
    	{
	        Schema::table('archive', function(Blueprint $table)
	        {
	                $table->renameColumn('changed_by', 'openmrs_id');
	        });
    	}
	}
}

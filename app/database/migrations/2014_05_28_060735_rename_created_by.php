<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class RenameCreatedBy extends Migration {

	/**
	 * Run the migrations.
	 *
	 * @return void
	 */
	public function up()
	{
		if (Schema::hasColumn('atlas', 'openmrs_id'))
    	{
	        Schema::table('atlas', function(Blueprint $table)
	        {
	                $table->renameColumn('openmrs_id', 'created_by');
	        });
    	}
    	if (!Schema::hasColumn('archive', 'created_by')) {
			Schema::table("archive", function($table) {
			    $table->string("created_by", 1024)->nullable();
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
		if (Schema::hasColumn('atlas', 'created_by'))
    	{
	        Schema::table('atlas', function(Blueprint $table)
	        {
	                $table->renameColumn('created_by', 'openmrs_id');
	        });
    	}
		Schema::table("archive", function($table) {
			$table->dropIfExists("created_by");
		});
	}

}

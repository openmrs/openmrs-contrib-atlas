<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class AddUuidAndActionToArchive extends Migration {

	/**
	 * Run the migrations.
	 *
	 * @return void
	 */
	public function up() {

		Schema::table('archive', function(Blueprint $table)
        {
        	if (Schema::hasColumn('archive', 'id'))
            	DB::statement('alter table archive change `id` `site_uuid` VARCHAR(38);');
            $table->string('id', 38);
    	});

    	$archives = DB::table('archive')->get();
		foreach ($archives as $site) {
			if (!$site->id) {
				$param = array('id' => Uuid::uuid4()->toString());
				DB::table('archive')->where('archive_date', '=', $site->archive_date)->update($param);
			}
		}

    	Schema::table('archive', function(Blueprint $table)
        {
			$table->primary('id');
			$table->enum('action', array('DELETE', 'UPDATE', 'ADD'))->nullable();
    	});

    }

	/**
	 * Reverse the migrations.
	 *
	 * @return void
	 */
	public function down()
	{
		if (Schema::hasColumn('archive', 'action'))
    	{
	        Schema::table('archive', function(Blueprint $table)
	        {
	            $table->dropColumn('action');
	        });
    	}
    	if (Schema::hasColumn('archive', 'id') && Schema::hasColumn('archive', 'site_uuid'))
    	{
	        Schema::table('archive', function(Blueprint $table)
	        {
	            $table->dropColumn('id');
	            $table->renameColumn('site_uuid', 'id');
	        });
    	}
	}
}
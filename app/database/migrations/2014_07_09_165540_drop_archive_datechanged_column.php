<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class DropArchiveDatechangedColumn extends Migration {

	/**
	 * Run the migrations.
	 *
	 * @return void
	 */
	public function up()
	{
		Schema::table('archive', function(Blueprint $table)
		{
			if (Schema::hasColumn('archive', 'date_changed'))
				$table->dropColumn("date_changed");
		});
	}

	/**
	 * Reverse the migrations.
	 *
	 * @return void
	 */
	public function down()
	{
		Schema::table('archive', function(Blueprint $table)
		{
			if (Schema::hasColumn('archive', 'show_counts'))
				$ttable->timestamp('date_changed');
		});
	}

}

<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class AddShowCounts extends Migration {

	/**
	 * Run the migrations.
	 *
	 * @return void
	 */
	public function up()
	{
		Schema::table('atlas', function(Blueprint $table)
		{
			$table->boolean('show_counts')->default(true);
		});
		Schema::table('archive', function(Blueprint $table)
		{
			$table->boolean('show_counts')->default(true);
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
			if (Schema::hasColumn('atlas', 'show_counts'))
				$table->dropColumn("show_counts");
		});
		Schema::table('archive', function(Blueprint $table)
		{
			if (Schema::hasColumn('archive', 'show_counts'))
				$table->dropColumn("show_counts");
		});
	}

}

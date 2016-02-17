<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class CreateDistributions extends Migration {

	/**
	 * Run the migrations.
	 *
	 * @return void
	 */
	public function up()
	{
		Schema::create('distributions', function($table){
			$table->increments('id');
			$table->string('name', 50);
			$table->timestamp('created_at')->default(DB::raw('CURRENT_TIMESTAMP on update CURRENT_TIMESTAMP'));
			$table->boolean('is_standard')->default(false);
		});

		Schema::table('atlas', function($table){
			$table->integer('distribution')->unsigned()->nullable()->default(null);
			$table->foreign('distribution')->references('id')->on('distributions');
		});

		Schema::table('archive', function($table){
			$table->string('distribution_name')->nullable()->default(null);
		});
	}

	/**
	 * Reverse the migrations.
	 *
	 * @return void
	 */
	public function down()
	{
		if(Schema::hasTable('atlas') && Schema::hasColumn('atlas','distribution')){
			Schema::table('atlas', function($table){
				$table->dropColumn('distribution');
			});
		}
		if(Schema::hasTable('archive') && Schema::hasColumn('archive','distribution')){
			Schema::table('archive', function($table){
				$table->dropColumn('distribution_name');
			});
		}

		Schema::table('distributions', function(Blueprint $table)
		{
			Schema::dropIfExists("distributions");
		});
	}

}

<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class CreateAuth extends Migration {

	/**
	 * Run the migrations.
	 *
	 * @return void
	 */
	public function up()
	{
		Schema::create('auth', function($table) {
			$table->increments('id');
			$table->string('atlas_id', 38);
			$table->string('principal', 1024);
			$table->string('token', 50);
			$table->string('privileges', 50)->default('ALL');
			$table->timestamp('expires')->nullable();
			$table->foreign('atlas_id')->references('id')->on('atlas');
		});
		Schema::table("atlas", function($table) {
        	$table->string("openmrs_id")->nullable();
        });
        Schema::table("archive", function($table) {
        	$table->string("openmrs_id")->nullable();
        });
    }

	/**
	 * Reverse the migrations.
	 *
	 * @return void
	 */
	public function down()
	{
		Schema::table("auth", function(Blueprint $table)
    	{
        	Schema::dropIfExists("auth");
    	});
    	Schema::table("atlas", function(Blueprint $table) {
        	$table->dropIfExists("openmrs_id");
        });
        Schema::table("archive", function(Blueprint $table) {
        	$table->dropIfExists("openmrs_id");
        });
	}

}

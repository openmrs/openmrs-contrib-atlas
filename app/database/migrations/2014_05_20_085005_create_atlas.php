<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class CreateAtlas extends Migration {

	/**
	 * Run the migrations.
	 *
	 * @return void
	 */
	public function up()
	{
		Schema::create('atlas', function($table) {
	        $table->string('id', 38)->primary();
	        $table->string('latitude', 50);
	        $table->string('longitude', 50);
	        $table->string('name', 1024);
	        $table->string('url', 1024)->nullable();
	        $table->string('type', 1024);
	        $table->string('image', 1024)->nullable();
	        $table->integer('patients')->nullable();
	        $table->integer('encounters')->nullable();
	        $table->integer('observations')->nullable();
	        $table->string('contact', 1024)->nullable();
	        $table->string('email', 1024)->nullable();
	        $table->text('notes')->nullable();
	        $table->text('data')->nullable();
	        $table->string('atlas_version', 50)->nullable();
	        $table->timestamp('date_created');
	        $table->timestamp('date_changed')->default(DB::raw('CURRENT_TIMESTAMP on update CURRENT_TIMESTAMP'));
    	});

    	Schema::create('archive', function($table) {
	        $table->string('id', 38);	
	        $table->string('latitude', 50);
	        $table->string('longitude', 50);
	        $table->string('name', 1024);
	        $table->string('url', 1024)->nullable();
	        $table->string('type', 1024);
	        $table->string('image', 1024)->nullable();
	        $table->integer('patients')->nullable();
	        $table->integer('encounters')->nullable();
	        $table->integer('observations')->nullable();
	        $table->string('contact', 1024)->nullable();
	        $table->string('email', 1024)->nullable();
	        $table->text('notes')->nullable();
	        $table->text('data')->nullable();
	        $table->string('atlas_version', 50)->nullable();
	        $table->timestamp('date_created');
	        $table->timestamp('date_changed');
	        $table->timestamp('archive_date')->default(DB::raw('CURRENT_TIMESTAMP'));
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
        	Schema::dropIfExists("atlas");
    	});
		Schema::table('archive', function(Blueprint $table)
    	{
        	Schema::dropIfExists("archive");
    	});
	}

}

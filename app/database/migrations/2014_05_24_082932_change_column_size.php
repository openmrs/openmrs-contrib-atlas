<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class ChangeColumnSize extends Migration {

	/**
	 * Run the migrations.
	 *
	 * @return void
	 */
	public function up()
	{
		DB::statement('ALTER TABLE auth MODIFY COLUMN token VARCHAR(1024)');
		DB::statement('ALTER TABLE auth MODIFY COLUMN privileges VARCHAR(1024) DEFAULT "ALL"');
		DB::statement('ALTER TABLE archive MODIFY COLUMN changed_by VARCHAR(1024)');
	}

	/**
	 * Reverse the migrations.
	 *
	 * @return void
	 */
	public function down()
	{
		DB::statement('ALTER TABLE auth MODIFY COLUMN token VARCHAR(50)');
		DB::statement('ALTER TABLE auth MODIFY COLUMN privileges VARCHAR(50)');
		DB::statement('ALTER TABLE archive MODIFY COLUMN changed_by VARCHAR(50)');
	}

}

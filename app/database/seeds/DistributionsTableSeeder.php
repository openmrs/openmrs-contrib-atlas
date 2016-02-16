<?php

class DistributionsTableSeeder extends Seeder
{

    public function run()
    {

        DB::table('distributions')->delete();

        DB::table('distributions')->insert(
            array(
                array(
                    'name'=>'OpenMRS 1.x',
                    'is_standard'=>true
                ),array(
                    'name'=>'Reference Application 2.x',
                    'is_standard'=>true
                ),array(
                    'name'=>'Bahmni',
                    'is_standard'=>true
                ),array(
                    'name'=>'KenyaEMR',
                    'is_standard'=>true
                )
            )
        );
    }
}




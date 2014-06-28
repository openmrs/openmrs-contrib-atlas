<?php

class AdminController extends BaseController {

    /**
     *  Administration 
     */

    public function adminQuery()
    {
    	App::error(function(Exception $exception){
			return View::make('adminQuery', array(
				'error' => $exception->getMessage())
			);
		});

    	if (Request::method() == 'POST') {

    		$error = null;
    		$result = null;
    		$columns = null;
    		$info = null;
    		$query = strtolower(trim(Input::get('query')));
    		Log::info('Query received : ' . $query);

    		if ($query != null) {

    			if (starts_with($query, array('select', 'show', 'describe'))) {
                    $result = DB::select($query);
		    		Log::info('Result size: ' . count($result));
		    		$info = "Query executed successfully.";	
		    		
		    		if (count($result) < 1) {
		    			$result = null;
		    			$info = "Success - Result set is empty.";
		    		} else 
		    			$columns = array_keys((array)head($result));

    			} else if (DB::statement($query))
    				$info = "Query executed successfully.";

    			else
    				$error = "Unknown error executing your query.";
    			
    		} else {
    			$error = 'Error : Your query is empty.';
    		}

    		return View::make('adminQuery', array(
    			'error' => $error,
    			'results' => $result,
    			'info' => $info,
    			'columns' => $columns));
    	}
    	return View::make('adminQuery');
	}
}
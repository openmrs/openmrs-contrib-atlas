<?php

class StringUtils
{
    public static function getSanitisedString($value){
        $value = is_string($value) ? trim($value) : null;
        return empty($value) ? null : $value;
    }

}
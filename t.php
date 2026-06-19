<?php

$file = explode(file_get_contents(__DIR__."/chat.txt"), "\n");
$me = [];
foreach ($file as $key => $value) {
    if (str_contains('jefyokta',$value)) {
        $me[] = $value;
        # code...
    }
    # code...

    var_dump($value);
}


var_dump($me);
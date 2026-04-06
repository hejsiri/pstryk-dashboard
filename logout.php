<?php

declare(strict_types=1);

require_once __DIR__ . '/config/bootstrap.php';

unset($_SESSION['pstryk_auth']);
$scriptName = (string) ($_SERVER['SCRIPT_NAME'] ?? '/logout.php');
$basePath = rtrim(str_replace('\\', '/', dirname($scriptName)), '/');
if ($basePath === '.' || $basePath === '/') {
    $basePath = '';
}
$target = ($basePath !== '' ? $basePath : '') . '/index.php';

header('Location: ' . $target);
exit;

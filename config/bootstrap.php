<?php

declare(strict_types=1);

use PstrykWeb\PstrykApiClient;

require_once __DIR__ . '/../src/PstrykApiClient.php';
require_once __DIR__ . '/../src/DateWindow.php';

// Trwałe sesje w katalogu projektu (zamiast domyślnego /tmp).
$sessionDir = __DIR__ . '/../storage/sessions';
if (!is_dir($sessionDir)) {
    @mkdir($sessionDir, 0775, true);
}
session_save_path($sessionDir);

// Utrzymuj sesję długo, aby użytkownik nie był wylogowywany po zamknięciu przeglądarki.
$sessionLifetime = 60 * 60 * 24 * 365; // 1 rok
ini_set('session.gc_maxlifetime', (string) $sessionLifetime);
ini_set('session.cookie_lifetime', (string) $sessionLifetime);
session_set_cookie_params([
    'lifetime' => $sessionLifetime,
    'path' => '/',
    'secure' => false,
    'httponly' => true,
    'samesite' => 'Lax',
]);

session_start();

function pstryk_client_from_session(): PstrykApiClient
{
    $auth = $_SESSION['pstryk_auth'] ?? [];

    return new PstrykApiClient(
        $auth['access_token'] ?? null,
        $auth['refresh_token'] ?? null,
        isset($auth['user_id']) ? (int) $auth['user_id'] : null,
        $auth['integrations_api_token'] ?? null
    );
}

function pstryk_save_client(PstrykApiClient $client): void
{
    $_SESSION['pstryk_auth'] = $client->toSessionPayload();
}

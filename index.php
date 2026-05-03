<?php

declare(strict_types=1);

use PstrykWeb\DateWindow;

require_once __DIR__ . '/config/bootstrap.php';

$error = null;
$meters = [];
$selectedMeter = null;
$todayPricing = [];
$tomorrowPricing = [];
$todaySellPricing = [];
$tomorrowSellPricing = [];
$todayUsage = [];
$todayCost = [];
$monthUsage = [];
$monthCost = [];
$previousMonthUsage = [];
$previousMonthCost = [];
$latestUsageFrame = null;
$rawApiEntries = [];
$selfUrl = strtok($_SERVER['REQUEST_URI'] ?? 'index.php', '?') ?: 'index.php';
$showRawApi = (string) ($_GET['raw'] ?? '0') === '1';
$forceRefresh = (string) ($_GET['refresh_api'] ?? '0') === '1';
$isDashboardDataRequest = (string) ($_GET['dashboard_data'] ?? '0') === '1';
$cacheTtlSeconds = 3600;
$warsawNow = new DateTimeImmutable('now', new DateTimeZone('Europe/Warsaw'));
$todayPublishAt = $warsawNow->setTime(13, 0, 0);
$secondsToPublish = max(0, $todayPublishAt->getTimestamp() - $warsawNow->getTimestamp());
$cssPath = __DIR__ . '/assets/app.css';
$jsPath = __DIR__ . '/assets/app.js';
$bgDefaultPath = __DIR__ . '/assets/img/background-pstryk-dasboard-morning.jpeg';
$bgDayPath = __DIR__ . '/assets/img/background-pstryk-dasboard-day.jpeg';
$bgNightPath = __DIR__ . '/assets/img/background-pstryk-dasboard-night.jpeg';
$bgMorningPath = __DIR__ . '/assets/img/background-pstryk-dasboard-morning.jpeg';
$bgEveningPath = __DIR__ . '/assets/img/background-pstryk-dasboard-evening.jpeg';

function selected_background_rel_path(DateTimeImmutable $now, string $mode = 'auto'): string
{
    if ($mode === 'day') {
        return 'assets/img/background-pstryk-dasboard-day.jpeg';
    }
    if ($mode === 'night') {
        return 'assets/img/background-pstryk-dasboard-night.jpeg';
    }
    if ($mode === 'morning') {
        return 'assets/img/background-pstryk-dasboard-morning.jpeg';
    }
    if ($mode === 'evening') {
        return 'assets/img/background-pstryk-dasboard-evening.jpeg';
    }

    $hour = (int) $now->format('G'); // 0..23

    // 09:00 - 17:59 dzień
    if ($hour >= 9 && $hour < 18) {
        return 'assets/img/background-pstryk-dasboard-day.jpeg';
    }
    // 21:00 - 04:59 noc
    if ($hour >= 21 || $hour < 5) {
        return 'assets/img/background-pstryk-dasboard-night.jpeg';
    }

    // 05:00-08:59 poranek
    if ($hour >= 5 && $hour < 9) {
        return 'assets/img/background-pstryk-dasboard-morning.jpeg';
    }

    // 18:00-20:59 wieczór
    return 'assets/img/background-pstryk-dasboard-evening.jpeg';
}

$allowedBgModes = ['auto', 'morning', 'day', 'evening', 'night'];
$bgMode = (string) ($_SESSION['dashboard_bg_mode'] ?? 'auto');
if (!in_array($bgMode, $allowedBgModes, true)) {
    $bgMode = 'auto';
}

$bgRelPath = selected_background_rel_path($warsawNow, $bgMode);
$bgPath = __DIR__ . '/' . $bgRelPath;
if (!is_file($bgPath)) {
    $bgRelPath = 'assets/img/background-pstryk-dasboard-morning.jpeg';
    $bgPath = $bgDefaultPath;
}
$isNightBg = str_contains($bgRelPath, 'background-pstryk-dasboard-night.');

$assetVersion = sha1(json_encode([
    'index_mtime' => @filemtime(__FILE__) ?: 0,
    'index_size' => @filesize(__FILE__) ?: 0,
    'css_mtime' => @filemtime($cssPath) ?: 0,
    'css_size' => @filesize($cssPath) ?: 0,
    'js_mtime' => @filemtime($jsPath) ?: 0,
    'js_size' => @filesize($jsPath) ?: 0,
    'favicon_ico_mtime' => @filemtime(__DIR__ . '/assets/img/favicon.ico') ?: 0,
    'favicon_ico_size' => @filesize(__DIR__ . '/assets/img/favicon.ico') ?: 0,
    'favicon_svg_mtime' => @filemtime(__DIR__ . '/assets/img/favicon-source.svg') ?: 0,
    'favicon_svg_size' => @filesize(__DIR__ . '/assets/img/favicon-source.svg') ?: 0,
    'favicon_16_mtime' => @filemtime(__DIR__ . '/assets/img/favicon-16x16.png') ?: 0,
    'favicon_16_size' => @filesize(__DIR__ . '/assets/img/favicon-16x16.png') ?: 0,
    'favicon_32_mtime' => @filemtime(__DIR__ . '/assets/img/favicon-32x32.png') ?: 0,
    'favicon_32_size' => @filesize(__DIR__ . '/assets/img/favicon-32x32.png') ?: 0,
    'icon_192_mtime' => @filemtime(__DIR__ . '/assets/img/icon-192.png') ?: 0,
    'icon_192_size' => @filesize(__DIR__ . '/assets/img/icon-192.png') ?: 0,
    'icon_512_mtime' => @filemtime(__DIR__ . '/assets/img/icon-512.png') ?: 0,
    'icon_512_size' => @filesize(__DIR__ . '/assets/img/icon-512.png') ?: 0,
    'apple_touch_icon_mtime' => @filemtime(__DIR__ . '/assets/img/apple-touch-icon.png') ?: 0,
    'apple_touch_icon_size' => @filesize(__DIR__ . '/assets/img/apple-touch-icon.png') ?: 0,
    'bg_default_mtime' => @filemtime($bgDefaultPath) ?: 0,
    'bg_day_mtime' => @filemtime($bgDayPath) ?: 0,
    'bg_night_mtime' => @filemtime($bgNightPath) ?: 0,
    'bg_morning_mtime' => @filemtime($bgMorningPath) ?: 0,
    'bg_evening_mtime' => @filemtime($bgEveningPath) ?: 0,
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: (string) time());
$scriptName = (string) ($_SERVER['SCRIPT_NAME'] ?? '/index.php');
$basePath = rtrim(str_replace('\\', '/', dirname($scriptName)), '/');
if ($basePath === '.' || $basePath === '/') {
    $basePath = '';
}

function app_url(string $path): string
{
    global $basePath;
    return ($basePath !== '' ? $basePath : '') . '/' . ltrim($path, '/');
}

$cssUrl = app_url('assets/app.css') . '?v=' . rawurlencode($assetVersion);
$jsUrl = app_url('assets/app.js') . '?v=' . rawurlencode($assetVersion);
$bgUrl = app_url($bgRelPath) . '?v=' . rawurlencode($assetVersion);
$logoUrl = app_url('assets/img/Pstryk-logo.svg') . '?v=' . rawurlencode($assetVersion);
$homeUrl = app_url('index.php');
$appleTouchIconUrl = app_url('assets/img/apple-touch-icon.png') . '?v=' . rawurlencode($assetVersion);
$faviconIcoUrl = app_url('assets/img/favicon.ico') . '?v=' . rawurlencode($assetVersion);
$faviconSvgUrl = app_url('assets/img/favicon-source.svg') . '?v=' . rawurlencode($assetVersion);
$favicon16Url = app_url('assets/img/favicon-16x16.png') . '?v=' . rawurlencode($assetVersion);
$favicon32Url = app_url('assets/img/favicon-32x32.png') . '?v=' . rawurlencode($assetVersion);
$icon192Url = app_url('assets/img/icon-192.png') . '?v=' . rawurlencode($assetVersion);
$icon512Url = app_url('assets/img/icon-512.png') . '?v=' . rawurlencode($assetVersion);
$manifestUrl = app_url('manifest.json') . '?v=' . rawurlencode($assetVersion);
$logoutUrl = app_url('logout.php');
$visitCount = dashboard_visit_count();

function cache_file_path(string $key): string
{
    $dir = __DIR__ . '/storage/cache';
    if (!is_dir($dir)) {
        @mkdir($dir, 0775, true);
    }
    return $dir . '/' . sha1($key) . '.json';
}

function api_cached_call(string $key, int $ttlSeconds, callable $fetcher, bool $forceRefresh = false): array
{
    $path = cache_file_path($key);
    $now = time();
    $cached = null;

    if (is_file($path)) {
        $raw = file_get_contents($path);
        $decoded = is_string($raw) ? json_decode($raw, true) : null;
        if (is_array($decoded) && array_key_exists('data', $decoded) && array_key_exists('fetched_at', $decoded)) {
            $cached = $decoded;
        }
    }

    if (!$forceRefresh && is_array($cached)) {
        $age = $now - (int) $cached['fetched_at'];
        if ($age <= $ttlSeconds) {
            return [
                'data' => $cached['data'],
                'meta' => [
                    'from_cache' => true,
                    'stale' => false,
                    'age_seconds' => $age,
                    'ttl_seconds' => $ttlSeconds,
                    'fetched_at' => (int) $cached['fetched_at'],
                    'fetch_error' => null,
                ],
            ];
        }
    }

    try {
        $data = $fetcher();
        $payload = ['fetched_at' => $now, 'data' => $data];
        @file_put_contents($path, json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        return [
            'data' => $data,
            'meta' => [
                'from_cache' => false,
                'stale' => false,
                'age_seconds' => 0,
                'ttl_seconds' => $ttlSeconds,
                'fetched_at' => $now,
                'fetch_error' => null,
            ],
        ];
    } catch (Throwable $e) {
        if (is_array($cached)) {
            $age = $now - (int) $cached['fetched_at'];
            return [
                'data' => $cached['data'],
                'meta' => [
                    'from_cache' => true,
                    'stale' => true,
                    'age_seconds' => $age,
                    'ttl_seconds' => $ttlSeconds,
                    'fetched_at' => (int) $cached['fetched_at'],
                    'fetch_error' => $e->getMessage(),
                ],
            ];
        }
        throw $e;
    }
}

$client = pstryk_client_from_session();

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'login') {
    $email = trim((string) ($_POST['email'] ?? ''));
    $password = (string) ($_POST['password'] ?? '');

    try {
        $client->login($email, $password);
        session_regenerate_id(true);
        pstryk_save_client($client);
        header('Location: ' . $selfUrl);
        exit;
    } catch (Throwable $e) {
        $error = $e->getMessage();
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'set_integrations_token' && $client->hasAuth()) {
    $token = trim((string) ($_POST['integrations_api_token'] ?? ''));
    $client->setIntegrationsApiToken($token !== '' ? $token : null);
    pstryk_save_client($client);
    header('Location: ' . $selfUrl);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'clear_integrations_token' && $client->hasAuth()) {
    $client->setIntegrationsApiToken(null);
    pstryk_save_client($client);
    header('Location: ' . $selfUrl);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'set_bg_mode') {
    $requestedMode = (string) ($_POST['bg_mode'] ?? 'auto');
    if (!in_array($requestedMode, $allowedBgModes, true)) {
        $requestedMode = 'auto';
    }
    $_SESSION['dashboard_bg_mode'] = $requestedMode;
    $isAjax = (string) ($_POST['ajax'] ?? '') === '1'
        || strtolower((string) ($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '')) === 'xmlhttprequest';
    if ($isAjax) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok' => true, 'mode' => $requestedMode], JSON_UNESCAPED_UNICODE);
        exit;
    }
    header('Location: ' . $selfUrl);
    exit;
}

if ($client->hasAuth()) {
    try {
        $cachePrefix = 'user:' . (string) ($client->getUserId() ?? 'unknown');
        $metersResult = api_cached_call(
            $cachePrefix . ':meter:list',
            $cacheTtlSeconds,
            static fn() => $client->getMeters(),
            $forceRefresh
        );
        $meters = is_array($metersResult['data']) ? $metersResult['data'] : [];
        if ($showRawApi) {
            $rawApiEntries[] = [
                'title' => 'Lista liczników',
                'endpoint' => 'GET /api/meter/',
                'response' => $meters,
                'meta' => $metersResult['meta'],
            ];
        }

        if (!empty($meters)) {
            $requestedMeterId = isset($_GET['meter_id']) ? (int) $_GET['meter_id'] : 0;
            $selectedMeter = $meters[0];

            foreach ($meters as $meter) {
                $meterId = (int) ($meter['id'] ?? 0);
                if ($requestedMeterId > 0 && $meterId === $requestedMeterId) {
                    $selectedMeter = $meter;
                    break;
                }
            }

            $meterId = (int) ($selectedMeter['id'] ?? 0);

            if ($meterId > 0) {
                $todayLocal = DateWindow::nowLocalDate();
                $tomorrowLocal = $todayLocal->modify('+1 day');

                [$todayStartUtc, $todayEndUtc] = DateWindow::localDayUtcWindow($todayLocal);
                [$tomorrowStartUtc, $tomorrowEndUtc] = DateWindow::localDayUtcWindow($tomorrowLocal);
                $todayStartIso = DateWindow::isoUtc($todayStartUtc);
                $todayEndIso = DateWindow::isoUtc($todayEndUtc);
                $tomorrowStartIso = DateWindow::isoUtc($tomorrowStartUtc);
                $tomorrowEndIso = DateWindow::isoUtc($tomorrowEndUtc);
                $monthStartLocal = $todayLocal->setDate(
                    (int) $todayLocal->format('Y'),
                    (int) $todayLocal->format('m'),
                    1
                )->setTime(0, 0, 0);
                $previousMonthStartLocal = $monthStartLocal->modify('-1 month');
                $previousMonthEndLocal = $monthStartLocal;
                $monthStartIso = DateWindow::isoUtc($monthStartLocal);
                $previousMonthStartIso = DateWindow::isoUtc($previousMonthStartLocal);
                $previousMonthEndIso = DateWindow::isoUtc($previousMonthEndLocal);
                $monthNowIso = DateWindow::isoUtc(new DateTimeImmutable('now', new DateTimeZone('Europe/Warsaw')));

                $todayPricingResult = api_cached_call(
                    $cachePrefix . ':pricing:buy:' . $meterId . ':' . $todayStartIso . ':' . $todayEndIso,
                    $cacheTtlSeconds,
                    static fn() => $client->getPricingBuy($meterId, $todayStartIso, $todayEndIso),
                    $forceRefresh
                );
                $todayPricing = is_array($todayPricingResult['data']) ? $todayPricingResult['data'] : [];
                if ($showRawApi) {
                    $rawApiEntries[] = [
                        'title' => 'Ceny zakupu - dziś',
                        'endpoint' => sprintf(
                            'GET /api/pricing/?meter_id=%d&window_start=%s&window_end=%s&resolution=hour',
                            $meterId,
                            $todayStartIso,
                            $todayEndIso
                        ),
                        'response' => $todayPricing,
                        'meta' => $todayPricingResult['meta'],
                    ];
                }

                $tomorrowPricingResult = api_cached_call(
                    $cachePrefix . ':pricing:buy:' . $meterId . ':' . $tomorrowStartIso . ':' . $tomorrowEndIso,
                    $cacheTtlSeconds,
                    static fn() => $client->getPricingBuy($meterId, $tomorrowStartIso, $tomorrowEndIso),
                    $forceRefresh
                );
                $tomorrowPricing = is_array($tomorrowPricingResult['data']) ? $tomorrowPricingResult['data'] : [];
                if ($showRawApi) {
                    $rawApiEntries[] = [
                        'title' => 'Ceny zakupu - jutro',
                        'endpoint' => sprintf(
                            'GET /api/pricing/?meter_id=%d&window_start=%s&window_end=%s&resolution=hour',
                            $meterId,
                            $tomorrowStartIso,
                            $tomorrowEndIso
                        ),
                        'response' => $tomorrowPricing,
                        'meta' => $tomorrowPricingResult['meta'],
                    ];
                }

                $sellPricingFetchers = [
                    [
                        'target' => 'today',
                        'title' => 'Ceny sprzedaży - dziś',
                        'endpoint' => sprintf(
                            'GET /api/prosumer-pricing/?window_start=%s&window_end=%s&resolution=hour',
                            $todayStartIso,
                            $todayEndIso
                        ),
                        'key' => $cachePrefix . ':pricing:sell:' . $todayStartIso . ':' . $todayEndIso,
                        'fetch' => static fn() => $client->getPricingSell($todayStartIso, $todayEndIso),
                    ],
                    [
                        'target' => 'tomorrow',
                        'title' => 'Ceny sprzedaży - jutro',
                        'endpoint' => sprintf(
                            'GET /api/prosumer-pricing/?window_start=%s&window_end=%s&resolution=hour',
                            $tomorrowStartIso,
                            $tomorrowEndIso
                        ),
                        'key' => $cachePrefix . ':pricing:sell:' . $tomorrowStartIso . ':' . $tomorrowEndIso,
                        'fetch' => static fn() => $client->getPricingSell($tomorrowStartIso, $tomorrowEndIso),
                    ],
                ];

                foreach ($sellPricingFetchers as $item) {
                    try {
                        $result = api_cached_call($item['key'], $cacheTtlSeconds, $item['fetch'], $forceRefresh);
                        $data = is_array($result['data']) ? $result['data'] : [];
                        if ($item['target'] === 'today') {
                            $todaySellPricing = $data;
                        } else {
                            $tomorrowSellPricing = $data;
                        }
                        if ($showRawApi) {
                            $rawApiEntries[] = [
                                'title' => $item['title'],
                                'endpoint' => $item['endpoint'],
                                'response' => $data,
                                'meta' => $result['meta'],
                            ];
                        }
                    } catch (Throwable $e) {
                        if ($showRawApi) {
                            $rawApiEntries[] = [
                                'title' => $item['title'],
                                'endpoint' => $item['endpoint'],
                                'response' => ['error' => $e->getMessage()],
                                'meta' => [
                                    'from_cache' => false,
                                    'stale' => false,
                                    'age_seconds' => null,
                                    'ttl_seconds' => $cacheTtlSeconds,
                                    'fetched_at' => null,
                                    'fetch_error' => $e->getMessage(),
                                ],
                            ];
                        }
                    }
                }

                $todayUsageResult = api_cached_call(
                    $cachePrefix . ':usage:' . $meterId . ':' . $todayStartIso . ':' . $todayEndIso,
                    $cacheTtlSeconds,
                    static fn() => $client->getPowerUsage($meterId, $todayStartIso, $todayEndIso),
                    $forceRefresh
                );
                $todayUsage = is_array($todayUsageResult['data']) ? $todayUsageResult['data'] : [];
                if ($showRawApi) {
                    $rawApiEntries[] = [
                        'title' => 'Zużycie energii - dziś',
                        'endpoint' => sprintf(
                            'GET /api/meter-data/%d/power-usage/?window_start=%s&window_end=%s&resolution=hour',
                            $meterId,
                            $todayStartIso,
                            $todayEndIso
                        ),
                        'response' => $todayUsage,
                        'meta' => $todayUsageResult['meta'],
                    ];
                }

                $todayCostResult = api_cached_call(
                    $cachePrefix . ':cost:' . $meterId . ':' . $todayStartIso . ':' . $todayEndIso,
                    $cacheTtlSeconds,
                    static fn() => $client->getPowerCost($meterId, $todayStartIso, $todayEndIso),
                    $forceRefresh
                );
                $todayCost = is_array($todayCostResult['data']) ? $todayCostResult['data'] : [];
                if ($showRawApi) {
                    $rawApiEntries[] = [
                        'title' => 'Koszt energii - dziś',
                        'endpoint' => sprintf(
                            'GET /api/meter-data/%d/power-cost/?window_start=%s&window_end=%s&resolution=hour',
                            $meterId,
                            $todayStartIso,
                            $todayEndIso
                        ),
                        'response' => $todayCost,
                        'meta' => $todayCostResult['meta'],
                    ];
                }

                $monthUsageResult = api_cached_call(
                    $cachePrefix . ':usage:' . $meterId . ':' . $monthStartIso . ':' . $monthNowIso,
                    $cacheTtlSeconds,
                    static fn() => $client->getPowerUsage($meterId, $monthStartIso, $monthNowIso),
                    $forceRefresh
                );
                $monthUsage = is_array($monthUsageResult['data']) ? $monthUsageResult['data'] : [];
                if ($showRawApi) {
                    $rawApiEntries[] = [
                        'title' => 'Zużycie energii - miesiąc',
                        'endpoint' => sprintf(
                            'GET /api/meter-data/%d/power-usage/?window_start=%s&window_end=%s&resolution=hour',
                            $meterId,
                            $monthStartIso,
                            $monthNowIso
                        ),
                        'response' => $monthUsage,
                        'meta' => $monthUsageResult['meta'],
                    ];
                }

                $previousMonthUsageResult = api_cached_call(
                    $cachePrefix . ':usage:' . $meterId . ':' . $previousMonthStartIso . ':' . $previousMonthEndIso,
                    $cacheTtlSeconds,
                    static fn() => $client->getPowerUsage($meterId, $previousMonthStartIso, $previousMonthEndIso),
                    $forceRefresh
                );
                $previousMonthUsage = is_array($previousMonthUsageResult['data']) ? $previousMonthUsageResult['data'] : [];

                $monthCostResult = api_cached_call(
                    $cachePrefix . ':cost:' . $meterId . ':' . $monthStartIso . ':' . $monthNowIso,
                    $cacheTtlSeconds,
                    static fn() => $client->getPowerCost($meterId, $monthStartIso, $monthNowIso),
                    $forceRefresh
                );
                $monthCost = is_array($monthCostResult['data']) ? $monthCostResult['data'] : [];
                if ($showRawApi) {
                    $rawApiEntries[] = [
                        'title' => 'Koszt energii - miesiąc',
                        'endpoint' => sprintf(
                            'GET /api/meter-data/%d/power-cost/?window_start=%s&window_end=%s&resolution=hour',
                            $meterId,
                            $monthStartIso,
                            $monthNowIso
                        ),
                        'response' => $monthCost,
                        'meta' => $monthCostResult['meta'],
                    ];
                }

                $previousMonthCostResult = api_cached_call(
                    $cachePrefix . ':cost:' . $meterId . ':' . $previousMonthStartIso . ':' . $previousMonthEndIso,
                    $cacheTtlSeconds,
                    static fn() => $client->getPowerCost($meterId, $previousMonthStartIso, $previousMonthEndIso),
                    $forceRefresh
                );
                $previousMonthCost = is_array($previousMonthCostResult['data']) ? $previousMonthCostResult['data'] : [];

                if ($showRawApi) {
                    $rawFetchers = [
                        [
                            'title' => 'Alerty cenowe',
                            'endpoint' => sprintf('GET /api/full-price-alerts/%d', $meterId),
                            'key' => $cachePrefix . ':alerts:' . $meterId,
                            'fetch' => static fn() => $client->getFullPriceAlerts($meterId),
                        ],
                        [
                            'title' => 'Zużycie energii - jutro',
                            'endpoint' => sprintf(
                                'GET /api/meter-data/%d/power-usage/?window_start=%s&window_end=%s&resolution=hour',
                                $meterId,
                                $tomorrowStartIso,
                                $tomorrowEndIso
                            ),
                            'key' => $cachePrefix . ':usage:' . $meterId . ':' . $tomorrowStartIso . ':' . $tomorrowEndIso,
                            'fetch' => static fn() => $client->getPowerUsage($meterId, $tomorrowStartIso, $tomorrowEndIso),
                        ],
                        [
                            'title' => 'Koszt energii - jutro',
                            'endpoint' => sprintf(
                                'GET /api/meter-data/%d/power-cost/?window_start=%s&window_end=%s&resolution=hour',
                                $meterId,
                                $tomorrowStartIso,
                                $tomorrowEndIso
                            ),
                            'key' => $cachePrefix . ':cost:' . $meterId . ':' . $tomorrowStartIso . ':' . $tomorrowEndIso,
                            'fetch' => static fn() => $client->getPowerCost($meterId, $tomorrowStartIso, $tomorrowEndIso),
                        ],
                    ];

                    foreach ($rawFetchers as $item) {
                        try {
                            $result = api_cached_call($item['key'], $cacheTtlSeconds, $item['fetch'], $forceRefresh);
                            $rawApiEntries[] = [
                                'title' => $item['title'],
                                'endpoint' => $item['endpoint'],
                                'response' => $result['data'],
                                'meta' => $result['meta'],
                            ];
                        } catch (Throwable $e) {
                            $rawApiEntries[] = [
                                'title' => $item['title'],
                                'endpoint' => $item['endpoint'],
                                'response' => ['error' => $e->getMessage()],
                                'meta' => [
                                    'from_cache' => false,
                                    'stale' => false,
                                    'age_seconds' => null,
                                    'ttl_seconds' => $cacheTtlSeconds,
                                    'fetched_at' => null,
                                    'fetch_error' => $e->getMessage(),
                                ],
                            ];
                        }
                    }

                    $integrationRawFetchers = [
                        [
                            'title' => '[Integrations] Unified Metrics - all (hour, dziś)',
                            'endpoint' => sprintf(
                                'GET /integrations/meter-data/unified-metrics/?metrics=meter_values,cost,carbon,pricing&window_start=%s&window_end=%s&resolution=hour',
                                $todayStartIso,
                                $todayEndIso
                            ),
                            'key' => $cachePrefix . ':integrations:unified:all:hour:' . $todayStartIso . ':' . $todayEndIso,
                            'fetch' => static fn() => $client->getIntegrationsUnifiedMetrics(
                                'meter_values,cost,carbon,pricing',
                                $todayStartIso,
                                $todayEndIso,
                                'hour'
                            ),
                        ],
                        [
                            'title' => '[Integrations] Unified Metrics - all (day, miesiąc)',
                            'endpoint' => sprintf(
                                'GET /integrations/meter-data/unified-metrics/?metrics=meter_values,cost,carbon,pricing&window_start=%s&window_end=%s&resolution=day',
                                $monthStartIso,
                                $monthNowIso
                            ),
                            'key' => $cachePrefix . ':integrations:unified:all:day:' . $monthStartIso . ':' . $monthNowIso,
                            'fetch' => static fn() => $client->getIntegrationsUnifiedMetrics(
                                'meter_values,cost,carbon,pricing',
                                $monthStartIso,
                                $monthNowIso,
                                'day'
                            ),
                        ],
                        [
                            'title' => '[Integrations] Unified Metrics - pricing (hour, jutro)',
                            'endpoint' => sprintf(
                                'GET /integrations/meter-data/unified-metrics/?metrics=pricing&window_start=%s&window_end=%s&resolution=hour',
                                $tomorrowStartIso,
                                $tomorrowEndIso
                            ),
                            'key' => $cachePrefix . ':integrations:unified:pricing:hour:' . $tomorrowStartIso . ':' . $tomorrowEndIso,
                            'fetch' => static fn() => $client->getIntegrationsUnifiedMetrics(
                                'pricing',
                                $tomorrowStartIso,
                                $tomorrowEndIso,
                                'hour'
                            ),
                        ],
                        [
                            'title' => '[Integrations] Pricing - dziś',
                            'endpoint' => sprintf(
                                'GET /integrations/pricing/?window_start=%s&window_end=%s&resolution=hour',
                                $todayStartIso,
                                $todayEndIso
                            ),
                            'key' => $cachePrefix . ':integrations:pricing:hour:' . $todayStartIso . ':' . $todayEndIso,
                            'fetch' => static fn() => $client->getIntegrationsPricing($todayStartIso, $todayEndIso, 'hour'),
                        ],
                        [
                            'title' => '[Integrations] Pricing - jutro',
                            'endpoint' => sprintf(
                                'GET /integrations/pricing/?window_start=%s&window_end=%s&resolution=hour',
                                $tomorrowStartIso,
                                $tomorrowEndIso
                            ),
                            'key' => $cachePrefix . ':integrations:pricing:hour:' . $tomorrowStartIso . ':' . $tomorrowEndIso,
                            'fetch' => static fn() => $client->getIntegrationsPricing($tomorrowStartIso, $tomorrowEndIso, 'hour'),
                        ],
                        [
                            'title' => '[Integrations] Prosumer Pricing - dziś',
                            'endpoint' => sprintf(
                                'GET /integrations/prosumer-pricing/?window_start=%s&window_end=%s&resolution=hour',
                                $todayStartIso,
                                $todayEndIso
                            ),
                            'key' => $cachePrefix . ':integrations:prosumer-pricing:hour:' . $todayStartIso . ':' . $todayEndIso,
                            'fetch' => static fn() => $client->getIntegrationsProsumerPricing($todayStartIso, $todayEndIso, 'hour'),
                        ],
                        [
                            'title' => '[Integrations] Prosumer Pricing - jutro',
                            'endpoint' => sprintf(
                                'GET /integrations/prosumer-pricing/?window_start=%s&window_end=%s&resolution=hour',
                                $tomorrowStartIso,
                                $tomorrowEndIso
                            ),
                            'key' => $cachePrefix . ':integrations:prosumer-pricing:hour:' . $tomorrowStartIso . ':' . $tomorrowEndIso,
                            'fetch' => static fn() => $client->getIntegrationsProsumerPricing($tomorrowStartIso, $tomorrowEndIso, 'hour'),
                        ],
                        [
                            'title' => '[Integrations] Meter Power Cost (id) - dziś',
                            'endpoint' => sprintf(
                                'GET /integrations/meter-data/%d/power-cost/?window_start=%s&window_end=%s&resolution=hour',
                                $meterId,
                                $todayStartIso,
                                $todayEndIso
                            ),
                            'key' => $cachePrefix . ':integrations:meter-power-cost:' . $meterId . ':' . $todayStartIso . ':' . $todayEndIso,
                            'fetch' => static fn() => $client->getIntegrationsPowerCostByMeterId($meterId, $todayStartIso, $todayEndIso, 'hour'),
                        ],
                        [
                            'title' => '[Integrations] Energy Usage (legacy, day, miesiąc)',
                            'endpoint' => sprintf(
                                'GET /integrations/meter-data/energy-usage/?window_start=%s&window_end=%s&resolution=day&for_tz=Europe/Warsaw',
                                $monthStartIso,
                                $monthNowIso
                            ),
                            'key' => $cachePrefix . ':integrations:energy-usage:day:' . $monthStartIso . ':' . $monthNowIso,
                            'fetch' => static fn() => $client->getIntegrationsEnergyUsage($monthStartIso, $monthNowIso, 'day'),
                        ],
                        [
                            'title' => '[Integrations] Energy Cost (legacy, day, miesiąc)',
                            'endpoint' => sprintf(
                                'GET /integrations/meter-data/energy-cost/?window_start=%s&window_end=%s&resolution=day&for_tz=Europe/Warsaw',
                                $monthStartIso,
                                $monthNowIso
                            ),
                            'key' => $cachePrefix . ':integrations:energy-cost:day:' . $monthStartIso . ':' . $monthNowIso,
                            'fetch' => static fn() => $client->getIntegrationsEnergyCost($monthStartIso, $monthNowIso, 'day'),
                        ],
                        [
                            'title' => '[Integrations] Carbon Footprint (legacy, day, miesiąc)',
                            'endpoint' => sprintf(
                                'GET /integrations/meter-data/carbon-footprint/?window_start=%s&window_end=%s&resolution=day&for_tz=Europe/Warsaw',
                                $monthStartIso,
                                $monthNowIso
                            ),
                            'key' => $cachePrefix . ':integrations:carbon-footprint:day:' . $monthStartIso . ':' . $monthNowIso,
                            'fetch' => static fn() => $client->getIntegrationsCarbonFootprint($monthStartIso, $monthNowIso, 'day'),
                        ],
                    ];

                    foreach ($integrationRawFetchers as $item) {
                        try {
                            $result = api_cached_call($item['key'], $cacheTtlSeconds, $item['fetch'], $forceRefresh);
                            $rawApiEntries[] = [
                                'title' => $item['title'],
                                'endpoint' => $item['endpoint'],
                                'response' => $result['data'],
                                'meta' => $result['meta'],
                            ];
                        } catch (Throwable $e) {
                            $rawApiEntries[] = [
                                'title' => $item['title'],
                                'endpoint' => $item['endpoint'],
                                'response' => ['error' => $e->getMessage()],
                                'meta' => [
                                    'from_cache' => false,
                                    'stale' => false,
                                    'age_seconds' => null,
                                    'ttl_seconds' => $cacheTtlSeconds,
                                    'fetched_at' => null,
                                    'fetch_error' => $e->getMessage(),
                                ],
                            ];
                        }
                    }
                }

                $frames = $todayUsage['frames'] ?? [];
                if (!empty($frames)) {
                    $latestUsageFrame = end($frames);
                }
            }
        }

        pstryk_save_client($client);
    } catch (Throwable $e) {
        $error = $e->getMessage();
        unset($_SESSION['pstryk_auth']);
    }
}

function h(?string $value): string
{
    return htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8');
}

function pretty_json(mixed $value): string
{
    $encoded = json_encode($value, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($encoded === false) {
        return '{"error":"Nie udało się zserializować JSON."}';
    }
    return $encoded;
}

function url_with_query(array $overrides): string
{
    global $selfUrl;
    $params = $_GET;
    foreach ($overrides as $key => $value) {
        if ($value === null) {
            unset($params[$key]);
        } else {
            $params[$key] = $value;
        }
    }
    $query = http_build_query($params);
    return $selfUrl . ($query !== '' ? ('?' . $query) : '');
}

function cache_meta_label(array $meta): string
{
    $fromCache = !empty($meta['from_cache']);
    $stale = !empty($meta['stale']);
    $age = isset($meta['age_seconds']) ? (int) $meta['age_seconds'] : 0;
    $source = $fromCache ? ($stale ? 'cache (stare)' : 'cache') : 'API (świeże)';
    return sprintf('Źródło: %s, wiek: %ds', $source, $age);
}

function integrations_token_mask(?string $token): string
{
    if ($token === null || $token === '') {
        return 'brak';
    }
    $len = strlen($token);
    if ($len <= 8) {
        return str_repeat('*', $len);
    }
    return substr($token, 0, 4) . str_repeat('*', max(0, $len - 8)) . substr($token, -4);
}

$toggleRawUrl = url_with_query(['raw' => $showRawApi ? '0' : '1', 'refresh_api' => null]);
$refreshApiUrl = url_with_query(['refresh_api' => '1']);
$integrationsTokenMask = integrations_token_mask($client->getIntegrationsApiToken());
$bgModeLabels = [
    'auto' => 'auto',
    'morning' => 'poranek',
    'day' => 'dzień',
    'evening' => 'wieczór',
    'night' => 'noc',
];
$bgModeUrls = [
    'auto' => app_url(selected_background_rel_path($warsawNow, 'auto')) . '?v=' . rawurlencode($assetVersion),
    'morning' => app_url(selected_background_rel_path($warsawNow, 'morning')) . '?v=' . rawurlencode($assetVersion),
    'day' => app_url(selected_background_rel_path($warsawNow, 'day')) . '?v=' . rawurlencode($assetVersion),
    'evening' => app_url(selected_background_rel_path($warsawNow, 'evening')) . '?v=' . rawurlencode($assetVersion),
    'night' => app_url(selected_background_rel_path($warsawNow, 'night')) . '?v=' . rawurlencode($assetVersion),
];
$themeColorByMode = [
    'morning' => '#d8c5b5',
    'day' => '#d9ddd8',
    'evening' => '#d4b29a',
    'night' => '#10151d',
];
$activeBgMode = $bgMode === 'auto' ? (
    str_contains($bgRelPath, 'background-pstryk-dasboard-night.') ? 'night' : (
        str_contains($bgRelPath, 'background-pstryk-dasboard-evening.') ? 'evening' : (
            str_contains($bgRelPath, 'background-pstryk-dasboard-day.') ? 'day' : 'morning'
        )
    )
) : $bgMode;
$themeColor = $themeColorByMode[$activeBgMode] ?? $themeColorByMode['morning'];

function pricing_chart_points(array $pricing): array
{
    $frames = $pricing['frames'] ?? [];
    if (!is_array($frames)) {
        return [];
    }

    return array_map(
        static function (array $frame): array {
        $priceGross = isset($frame['price_gross']) ? (float) $frame['price_gross'] : null;
        $fullPrice = isset($frame['full_price']) ? (float) $frame['full_price'] : null;
        $priceNet = isset($frame['price_net']) ? (float) $frame['price_net'] : null;
        $displayBrutto = $priceGross ?? $fullPrice ?? ($priceNet !== null ? $priceNet * 1.23 : null);
        return [
            'start' => (string) ($frame['start'] ?? ''),
            'end' => (string) ($frame['end'] ?? ''),
            'display_price' => $displayBrutto,
            'is_live' => !empty($frame['is_live']),
        ];
    },
        $frames
    );
}

function usage_frame_value(array $frame): ?float
{
    if (isset($frame['fae_usage'])) {
        return (float) $frame['fae_usage'];
    }
    if (isset($frame['energy_balance'])) {
        return (float) $frame['energy_balance'];
    }
    if (isset($frame['rae'])) {
        return (float) $frame['rae'];
    }

    return null;
}

function cost_frame_value(array $frame): ?float
{
    if (isset($frame['sales_cost_net'])) {
        return (float) $frame['sales_cost_net'];
    }
    if (isset($frame['total_sales_cost_net'])) {
        return (float) $frame['total_sales_cost_net'];
    }
    if (isset($frame['fae_cost'])) {
        return (float) $frame['fae_cost'];
    }
    if (isset($frame['energy_balance_value'])) {
        return (float) $frame['energy_balance_value'];
    }
    if (isset($frame['energy_cost_net'])) {
        return (float) $frame['energy_cost_net'];
    }

    return null;
}

function usage_chart_points(array $usage): array
{
    $frames = $usage['frames'] ?? [];
    if (!is_array($frames)) {
        return [];
    }

    return array_map(
        static function (array $frame): array {
            return [
                'start' => (string) ($frame['start'] ?? ''),
                'end' => (string) ($frame['end'] ?? ''),
                'display_usage' => usage_frame_value($frame),
                'is_live' => !empty($frame['is_live']),
            ];
        },
        $frames
    );
}

function cost_chart_points(array $cost): array
{
    $frames = $cost['frames'] ?? [];
    if (!is_array($frames)) {
        return [];
    }

    $rawValues = array_map(
        static fn(array $frame): ?float => cost_frame_value($frame),
        $frames
    );

    $rawTotal = array_reduce(
        $rawValues,
        static function (float $carry, ?float $value): float {
            return $carry + ($value ?? 0.0);
        },
        0.0
    );

    $targetTotal = null;
    foreach (['total_sales_cost_net', 'total_energy_cost_net', 'fae_total_cost', 'total_energy_balance_value'] as $summaryKey) {
        if (isset($cost[$summaryKey])) {
            $targetTotal = (float) $cost[$summaryKey];
            break;
        }
    }

    $scale = 1.0;
    if ($targetTotal !== null && abs($rawTotal) > 0.000001) {
        $scale = $targetTotal / $rawTotal;
    }

    return array_map(
        static function (array $frame, int $index) use ($rawValues, $scale): array {
            $displayCost = $rawValues[$index];
            if ($displayCost !== null) {
                $displayCost *= $scale;
            }

            return [
                'start' => (string) ($frame['start'] ?? ''),
                'end' => (string) ($frame['end'] ?? ''),
                'display_cost' => $displayCost,
                'is_live' => !empty($frame['is_live']),
            ];
        },
        $frames,
        array_keys($frames)
    );
}

function aggregate_month_chart_points(array $source, callable $extractValue, string $displayKey): array
{
    $frames = $source['frames'] ?? [];
    if (!is_array($frames) || $frames === []) {
        return [];
    }

    $warsaw = new DateTimeZone('Europe/Warsaw');
    $buckets = [];

    foreach ($frames as $frame) {
        $startRaw = isset($frame['start']) ? (string) $frame['start'] : '';
        if ($startRaw === '') {
            continue;
        }

        try {
            $startLocal = (new DateTimeImmutable($startRaw))->setTimezone($warsaw);
        } catch (Exception) {
            continue;
        }

        $dayKey = $startLocal->format('Y-m-d');
        $value = $extractValue($frame);

        if (!isset($buckets[$dayKey])) {
            $dayStartLocal = $startLocal->setTime(0, 0, 0);
            $buckets[$dayKey] = [
                'start' => $dayStartLocal->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:sP'),
                'end' => $dayStartLocal->modify('+1 day')->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:sP'),
                $displayKey => 0.0,
                'is_live' => false,
            ];
        }

        if ($value !== null) {
            $buckets[$dayKey][$displayKey] += $value;
        }
        if (!empty($frame['is_live'])) {
            $buckets[$dayKey]['is_live'] = true;
        }
    }

    ksort($buckets);

    return array_values($buckets);
}

$todayChartPoints = pricing_chart_points($todayPricing);
$tomorrowChartPoints = pricing_chart_points($tomorrowPricing);
$todaySellChartPoints = pricing_chart_points($todaySellPricing);
$tomorrowSellChartPoints = pricing_chart_points($tomorrowSellPricing);
$todayUsageChartPoints = usage_chart_points($todayUsage);
$todayCostChartPoints = cost_chart_points($todayCost);
$monthUsageDailyChartPoints = aggregate_month_chart_points($monthUsage, 'usage_frame_value', 'display_usage');
$monthCostDailyChartPoints = aggregate_month_chart_points($monthCost, 'cost_frame_value', 'display_cost');
$previousMonthUsageDailyChartPoints = aggregate_month_chart_points($previousMonthUsage, 'usage_frame_value', 'display_usage');
$previousMonthCostDailyChartPoints = aggregate_month_chart_points($previousMonthCost, 'cost_frame_value', 'display_cost');
$dashboardDataUrl = url_with_query(['dashboard_data' => '1']);

if ($isDashboardDataRequest) {
    header('Content-Type: application/json; charset=utf-8');
    if (!$client->hasAuth()) {
        http_response_code(401);
        echo json_encode(['ok' => false, 'error' => 'Sesja wygasła. Zaloguj się ponownie.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    echo json_encode([
        'ok' => $error === null,
        'error' => $error,
        'meters' => $meters,
        'selectedMeterId' => isset($selectedMeter['id']) ? (int) $selectedMeter['id'] : null,
        'metrics' => [
            'todayUsage' => (float) ($todayUsage['fae_total_usage'] ?? 0),
            'monthUsage' => (float) ($monthUsage['fae_total_usage'] ?? 0),
            'todayCost' => (float) ($todayCost['total_sales_cost_net'] ?? 0),
            'monthCost' => (float) ($monthCost['total_sales_cost_net'] ?? $monthCost['total_energy_cost_net'] ?? 0),
        ],
        'todayFrames' => $todayChartPoints,
        'tomorrowFrames' => $tomorrowChartPoints,
        'todaySellFrames' => $todaySellChartPoints,
        'tomorrowSellFrames' => $tomorrowSellChartPoints,
        'todayUsageFrames' => $todayUsageChartPoints,
        'todayCostFrames' => $todayCostChartPoints,
        'monthUsageDailyFrames' => $monthUsageDailyChartPoints,
        'monthCostDailyFrames' => $monthCostDailyChartPoints,
        'previousMonthUsageDailyFrames' => $previousMonthUsageDailyChartPoints,
        'previousMonthCostDailyFrames' => $previousMonthCostDailyChartPoints,
        'secondsToPublish' => (int) $secondsToPublish,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG);
    exit;
}
?>
<!DOCTYPE html>
<html lang="pl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-title" content="Pstryk">
    <meta name="theme-color" content="<?= h($themeColor) ?>">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <link rel="manifest" href="<?= h($manifestUrl) ?>">
    <link rel="icon" href="<?= h($faviconIcoUrl) ?>" sizes="any">
    <link rel="shortcut icon" href="<?= h($faviconIcoUrl) ?>">
    <link rel="icon" type="image/svg+xml" href="<?= h($faviconSvgUrl) ?>">
    <link rel="icon" type="image/png" sizes="16x16" href="<?= h($favicon16Url) ?>">
    <link rel="icon" type="image/png" sizes="32x32" href="<?= h($favicon32Url) ?>">
    <link rel="apple-touch-icon" sizes="180x180" href="<?= h($appleTouchIconUrl) ?>">
    <link rel="icon" type="image/png" sizes="192x192" href="<?= h($icon192Url) ?>">
    <link rel="icon" type="image/png" sizes="512x512" href="<?= h($icon512Url) ?>">
    <title>Pstryk Dashboard</title>
    <link rel="stylesheet" href="<?= h($cssUrl) ?>">
</head>
<body class="<?= trim(($client->hasAuth() ? 'auth dashboard-loading' : 'guest') . ($isNightBg ? ' bg-night' : '')) ?>" style="--dashboard-bg: url('<?= h($bgUrl) ?>');">
<div class="container">
    <?php if ($client->hasAuth()): ?>
        <div class="header">
            <a class="brand" href="<?= h($homeUrl) ?>" aria-label="Pstryk Dashboard - strona główna"><img src="<?= h($logoUrl) ?>" alt="Pstryk" class="brand-logo"><span class="brand-suffix">Dashboard</span></a>
            <div class="header-actions">
                <a class="link-btn logout-link top-logout-link" href="<?= h($logoutUrl) ?>">
                    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                        <path d="M16 17l5-5-5-5"></path>
                        <path d="M21 12H9"></path>
                    </svg>
                    <span>wyloguj</span>
                </a>
            <details class="settings-menu">
                <summary class="settings-toggle" aria-label="Ustawienia">
                    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="3.2"></circle>
                        <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a1.9 1.9 0 1 1-2.7 2.7l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2 2 0 1 1-4 0v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a1.9 1.9 0 1 1-2.7-2.7l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a2 2 0 1 1 0-4h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a1.9 1.9 0 1 1 2.7-2.7l.1.1a1 1 0 0 0 1.1.2h.1a1 1 0 0 0 .6-.9V4a2 2 0 1 1 4 0v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a1.9 1.9 0 1 1 2.7 2.7l-.1.1a1 1 0 0 0-.2 1.1v.1a1 1 0 0 0 .9.6H20a2 2 0 1 1 0 4h-.2a1 1 0 0 0-.9.6z"></path>
                    </svg>
                    <span>Ustawienia</span>
                </summary>
                <div class="settings-panel">
                    <div class="settings-panel-head">
                        <div class="settings-panel-title">Ustawienia</div>
                        <button type="button" class="settings-close-btn" data-close-settings="1">zamknij</button>
                    </div>
                    <form method="get" class="toolbar-form">
                        <span class="toolbar-label">Licznik:</span>
                        <select name="meter_id" id="meter_id" onchange="this.form.submit()">
                            <?php if (empty($meters)): ?>
                                <option value="">Ładowanie liczników...</option>
                            <?php endif; ?>
                            <?php foreach ($meters as $meter): ?>
                                <?php $id = (int) ($meter['id'] ?? 0); ?>
                                <option value="<?= $id ?>" <?= ((int) ($selectedMeter['id'] ?? 0) === $id) ? 'selected' : '' ?>>
                                    <?= h(($meter['name'] ?? 'Licznik') . ' (#' . $id . ')') ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                        <a class="link-btn" href="<?= h($refreshApiUrl) ?>">odśwież dane API</a>
                        <a class="link-btn" href="<?= h($toggleRawUrl) ?>">
                            <?= $showRawApi ? 'Ukryj RAW API' : 'Pokaż RAW API' ?>
                        </a>
                    </form>
                    <form method="post" class="toolbar-form integrations-form">
                        <input type="hidden" name="action" value="set_integrations_token">
                        <input
                            type="password"
                            name="integrations_api_token"
                            placeholder="Integrations API key (opcjonalnie)"
                            autocomplete="off"
                        >
                        <button type="submit" class="toolbar-btn">zapisz klucz API</button>
                    </form>
                    <form method="post" class="toolbar-form">
                        <input type="hidden" name="action" value="clear_integrations_token">
                        <button type="submit" class="toolbar-btn">usuń klucz API</button>
                    </form>
                    <div class="toolbar-hint">Integrations API key: <?= h($integrationsTokenMask) ?></div>
                </div>
            </details>
            </div>
        </div>
    <?php endif; ?>

    <?php if ($error): ?>
        <div class="danger"><?= h($error) ?></div>
    <?php endif; ?>

<?php if (!$client->hasAuth()): ?>
        <div class="login-center">
            <div class="card login-card">
                <h2>Logowanie do Pstryk</h2>
                <div class="login-trust">
                    <p>Zaloguj się na swoim koncie Pstryk, aby uzyskać dostęp do Dashboard. Sesja działa do momentu wylogowania albo usunięcia danych przeglądarki. Komunikacja z API Pstryk odbywa się przez szyfrowane połączenie.</p>
                </div>
                <form method="post" class="login-form">
                    <input type="hidden" name="action" value="login">
                    <input id="email" type="email" name="email" placeholder="Email" aria-label="Email" required>
                    <input id="password" type="password" name="password" placeholder="Hasło" aria-label="Hasło" required>

                    <button type="submit">zaloguj</button>
                </form>
            </div>
        </div>
    <?php else: ?>
        <div class="card metrics-panel">
            <div class="metrics">
                <div class="metric metric-action" data-chart-view="today-usage" role="button" tabindex="0" aria-pressed="false">
                    <div class="metric-icon-col">
                        <span class="metric-icon" aria-hidden="true">
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                <defs>
                                    <mask id="cutout-bolt-1">
                                        <rect width="24" height="24" fill="#fff"></rect>
                                        <path d="M13.5 4.5L8.3 13h3.3L10.8 19l4.9-8h-3.1z" fill="#000"></path>
                                    </mask>
                                </defs>
                                <circle cx="12" cy="12" r="10" fill="rgba(255,255,255,0.96)" mask="url(#cutout-bolt-1)"></circle>
                            </svg>
                        </span>
                    </div>
                    <div class="metric-content">
                        <div class="label">zużycie dziś</div>
                        <div class="value is-loading" data-metric-value="todayUsage">...</div>
                    </div>
                </div>
                <div class="metric metric-action" data-chart-view="today-cost" role="button" tabindex="0" aria-pressed="false">
                    <div class="metric-icon-col">
                        <span class="metric-icon" aria-hidden="true">
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                <defs>
                                    <mask id="cutout-wallet-1">
                                        <rect width="24" height="24" fill="#fff"></rect>
                                        <path d="M7.6 8.2h8.8c1 0 1.8.8 1.8 1.8v4c0 1-.8 1.8-1.8 1.8H7.6A1.8 1.8 0 0 1 5.8 14v-4c0-1 .8-1.8 1.8-1.8z" fill="#000"></path>
                                        <rect x="13.9" y="10.1" width="2" height="1.9" rx="0.4" fill="#fff"></rect>
                                    </mask>
                                </defs>
                                <circle cx="12" cy="12" r="10" fill="rgba(255,255,255,0.96)" mask="url(#cutout-wallet-1)"></circle>
                            </svg>
                        </span>
                    </div>
                    <div class="metric-content">
                        <div class="label">Koszt dziś</div>
                        <div class="value is-loading" data-metric-value="todayCost">...</div>
                    </div>
                </div>
                <div class="metric metric-action" data-chart-view="month-usage" role="button" tabindex="0" aria-pressed="false">
                    <div class="metric-icon-col">
                        <span class="metric-icon" aria-hidden="true">
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                <defs>
                                    <mask id="cutout-bolt-2">
                                        <rect width="24" height="24" fill="#fff"></rect>
                                        <path d="M13.5 4.5L8.3 13h3.3L10.8 19l4.9-8h-3.1z" fill="#000"></path>
                                    </mask>
                                </defs>
                                <circle cx="12" cy="12" r="10" fill="rgba(255,255,255,0.96)" mask="url(#cutout-bolt-2)"></circle>
                            </svg>
                        </span>
                    </div>
                    <div class="metric-content">
                        <div class="label">zużycie miesiąc</div>
                        <div class="value is-loading" data-metric-value="monthUsage">...</div>
                    </div>
                </div>
                <div class="metric metric-action" data-chart-view="month-cost" role="button" tabindex="0" aria-pressed="false">
                    <div class="metric-icon-col">
                        <span class="metric-icon" aria-hidden="true">
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                <defs>
                                    <mask id="cutout-wallet-2">
                                        <rect width="24" height="24" fill="#fff"></rect>
                                        <path d="M7.6 8.2h8.8c1 0 1.8.8 1.8 1.8v4c0 1-.8 1.8-1.8 1.8H7.6A1.8 1.8 0 0 1 5.8 14v-4c0-1 .8-1.8 1.8-1.8z" fill="#000"></path>
                                        <rect x="13.9" y="10.1" width="2" height="1.9" rx="0.4" fill="#fff"></rect>
                                    </mask>
                                </defs>
                                <circle cx="12" cy="12" r="10" fill="rgba(255,255,255,0.96)" mask="url(#cutout-wallet-2)"></circle>
                            </svg>
                        </span>
                    </div>
                    <div class="metric-content">
                        <div class="label">Koszt miesiąc</div>
                        <div class="value is-loading" data-metric-value="monthCost">...</div>
                    </div>
                </div>
            </div>

        </div>

        <div class="chart-tile">
            <div class="chart-header">
                <div class="chart-title-group">
                    <h2 id="chartTitle">Ceny energii godzinowe dziś</h2>
                    <span id="chartSummaryBadge" class="chart-summary-badge" hidden></span>
                </div>
                <div class="day-nav">
                    <button id="prevDayBtn" type="button" aria-label="Poprzedni dzień">&larr; dziś</button>
                    <button id="nextDayBtn" type="button" aria-label="Następny dzień">jutro &rarr;</button>
                    <div id="nextDayCountdown" class="countdown"></div>
                </div>
            </div>
            <div class="chart-wrap">
                <div class="chart-loader" id="chartLoader" aria-live="polite">
                    <span class="loader-spinner" aria-hidden="true"></span>
                    <span>Wczytywanie danych...</span>
                </div>
                <canvas id="priceChart"></canvas>
            </div>
            <div id="chartInfo" class="chart-info"></div>
        </div>

        <?php if ($showRawApi): ?>
        <div class="card">
            <h2>RAW API (pełne odpowiedzi)</h2>
                <p class="muted">Poniżej są surowe JSON-y z endpointów. Dane są cache'owane, aby nie przekraczać limitów API.</p>
                <div class="raw-list">
                    <?php foreach ($rawApiEntries as $entry): ?>
                        <details>
                            <summary><?= h((string) ($entry['title'] ?? 'Endpoint')) ?></summary>
                            <div class="raw-meta"><?= h(cache_meta_label((array) ($entry['meta'] ?? []))) ?></div>
                            <div class="raw-endpoint"><?= h((string) ($entry['endpoint'] ?? '')) ?></div>
                            <pre class="raw-json"><?= h(pretty_json($entry['response'] ?? [])) ?></pre>
                        </details>
                    <?php endforeach; ?>
                </div>
        </div>
        <?php endif; ?>
    <?php endif; ?>

    <footer class="footer">
        <?php if ($client->hasAuth()): ?>
        <div class="bg-switcher">
            <form method="post" class="bg-switcher-form">
                <input type="hidden" name="action" value="set_bg_mode">
                <?php foreach ($bgModeLabels as $modeKey => $modeLabel): ?>
                    <button
                        type="submit"
                        name="bg_mode"
                        value="<?= h($modeKey) ?>"
                        data-mode="<?= h($modeKey) ?>"
                        class="bg-switch-btn <?= $bgMode === $modeKey ? 'active' : '' ?>"
                    ><?= h($modeLabel) ?></button>
                <?php endforeach; ?>
            </form>
        </div>
        <div class="chart-mode-switch" aria-label="Widoczne ceny na wykresie">
            <div class="bg-switcher-form">
                <button type="button" class="bg-switch-btn active" data-chart-mode="buy">zakup</button>
                <button type="button" class="bg-switch-btn" data-chart-mode="sell">sprzedaż</button>
                <button type="button" class="bg-switch-btn" data-chart-mode="both">razem</button>
            </div>
        </div>
        <?php endif; ?>

        <div class="footer-right">
            <a class="footer-link" href="https://github.com/hejsiri/pstryk-dashboard" target="_blank" rel="noopener noreferrer">
                <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
                    <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.1.68-.22.68-.48v-1.68c-2.78.6-3.37-1.2-3.37-1.2-.46-1.16-1.11-1.47-1.11-1.47-.9-.62.07-.61.07-.61 1 .07 1.52 1.03 1.52 1.03.88 1.52 2.32 1.08 2.88.82.09-.64.35-1.08.63-1.33-2.22-.25-4.55-1.11-4.55-4.95 0-1.09.39-1.98 1.03-2.68-.11-.25-.45-1.27.1-2.64 0 0 .83-.27 2.73 1.03a9.5 9.5 0 0 1 4.96 0c1.9-1.3 2.73-1.03 2.73-1.03.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.85-2.33 4.7-4.56 4.95.36.31.68.92.68 1.86v2.76c0 .27.18.59.69.48A10 10 0 0 0 12 2z"/>
                </svg>
                <span>zobacz projekt na Github</span>
            </a>
            <div class="footer-counter">Odsłon: <?= h(number_format($visitCount, 0, ',', ' ')) ?></div>
        </div>
    </footer>
</div>
<script>
window.__PSTRYK_DASHBOARD__ = {
    metrics: <?= json_encode([
        'todayUsage' => (float) ($todayUsage['fae_total_usage'] ?? 0),
        'monthUsage' => (float) ($monthUsage['fae_total_usage'] ?? 0),
        'todayCost' => (float) ($todayCost['total_sales_cost_net'] ?? 0),
        'monthCost' => (float) ($monthCost['total_sales_cost_net'] ?? $monthCost['total_energy_cost_net'] ?? 0),
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG) ?>,
    todayFrames: <?= json_encode($todayChartPoints, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG) ?>,
    tomorrowFrames: <?= json_encode($tomorrowChartPoints, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG) ?>,
    todaySellFrames: <?= json_encode($todaySellChartPoints, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG) ?>,
    tomorrowSellFrames: <?= json_encode($tomorrowSellChartPoints, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG) ?>,
    todayUsageFrames: <?= json_encode($todayUsageChartPoints, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG) ?>,
    todayCostFrames: <?= json_encode($todayCostChartPoints, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG) ?>,
    monthUsageDailyFrames: <?= json_encode($monthUsageDailyChartPoints, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG) ?>,
    monthCostDailyFrames: <?= json_encode($monthCostDailyChartPoints, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG) ?>,
    previousMonthUsageDailyFrames: <?= json_encode($previousMonthUsageDailyChartPoints, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG) ?>,
    previousMonthCostDailyFrames: <?= json_encode($previousMonthCostDailyChartPoints, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG) ?>,
    dashboardDataUrl: <?= json_encode($dashboardDataUrl, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG) ?>,
    secondsToPublish: <?= (int) $secondsToPublish ?>,
    bgMode: <?= json_encode($bgMode, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG) ?>,
    bgModeUrls: <?= json_encode($bgModeUrls, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG) ?>,
    themeColorByMode: <?= json_encode($themeColorByMode, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG) ?>
};
</script>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<script src="<?= h($jsUrl) ?>"></script>
</body>
</html>

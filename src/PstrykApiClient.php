<?php

declare(strict_types=1);

namespace PstrykWeb;

use RuntimeException;

final class PstrykApiClient
{
    private string $baseUrl = 'https://api.pstryk.pl';
    private ?string $accessToken = null;
    private ?string $refreshToken = null;
    private ?int $userId = null;
    private ?string $integrationsApiToken = null;
    private ?string $integrationsAuthScheme = null;

    public function __construct(
        ?string $accessToken = null,
        ?string $refreshToken = null,
        ?int $userId = null,
        ?string $integrationsApiToken = null
    )
    {
        $this->accessToken = $accessToken;
        $this->refreshToken = $refreshToken;
        $this->userId = $userId;
        $this->integrationsApiToken = $integrationsApiToken !== null && trim($integrationsApiToken) !== ''
            ? trim($integrationsApiToken)
            : null;
    }

    public function login(string $email, string $password): void
    {
        $response = $this->request(
            'POST',
            '/auth/token/',
            ['email' => $email, 'password' => $password],
            false
        );

        $this->accessToken = $response['access'] ?? null;
        $this->refreshToken = $response['refresh'] ?? null;
        $this->userId = isset($response['user_id']) ? (int) $response['user_id'] : null;

        if (!$this->accessToken || !$this->refreshToken) {
            throw new RuntimeException('Logowanie powiodło się, ale API nie zwróciło tokenów.');
        }
    }

    public function refreshAccessToken(): void
    {
        if (!$this->refreshToken) {
            throw new RuntimeException('Brak refresh tokena. Zaloguj się ponownie.');
        }

        $response = $this->request(
            'POST',
            '/auth/token/refresh/',
            ['refresh' => $this->refreshToken],
            false
        );

        $newAccess = $response['access'] ?? null;
        if (!$newAccess) {
            throw new RuntimeException('API nie zwróciło nowego access tokena.');
        }

        $this->accessToken = (string) $newAccess;
        $this->userId = isset($response['user_id']) ? (int) $response['user_id'] : $this->userId;
    }

    public function getMeters(): array
    {
        return $this->authorizedGet('/api/meter/');
    }

    public function getPricingBuy(int $meterId, string $windowStart, string $windowEnd, string $resolution = 'hour'): array
    {
        return $this->authorizedGet('/api/pricing/', [
            'meter_id' => $meterId,
            'window_start' => $windowStart,
            'window_end' => $windowEnd,
            'resolution' => $resolution,
        ]);
    }

    public function getPricingSell(string $windowStart, string $windowEnd, string $resolution = 'hour'): array
    {
        return $this->authorizedGet('/api/prosumer-pricing/', [
            'window_start' => $windowStart,
            'window_end' => $windowEnd,
            'resolution' => $resolution,
        ]);
    }

    public function getPowerUsage(int $meterId, string $windowStart, string $windowEnd, string $resolution = 'hour'): array
    {
        return $this->authorizedGet(sprintf('/api/meter-data/%d/power-usage/', $meterId), [
            'window_start' => $windowStart,
            'window_end' => $windowEnd,
            'resolution' => $resolution,
        ]);
    }

    public function getPowerCost(int $meterId, string $windowStart, string $windowEnd, string $resolution = 'hour'): array
    {
        return $this->authorizedGet(sprintf('/api/meter-data/%d/power-cost/', $meterId), [
            'window_start' => $windowStart,
            'window_end' => $windowEnd,
            'resolution' => $resolution,
        ]);
    }

    public function getFullPriceAlerts(int $meterId): array
    {
        return $this->authorizedGet(sprintf('/api/full-price-alerts/%d', $meterId));
    }

    public function getIntegrationsUnifiedMetrics(
        string $metrics,
        string $windowStart,
        string $windowEnd,
        string $resolution = 'hour'
    ): array {
        return $this->integrationsGet('/integrations/meter-data/unified-metrics/', [
            'metrics' => $metrics,
            'window_start' => $windowStart,
            'window_end' => $windowEnd,
            'resolution' => $resolution,
        ]);
    }

    public function getIntegrationsPricing(string $windowStart, string $windowEnd, string $resolution = 'hour'): array
    {
        return $this->integrationsGet('/integrations/pricing/', [
            'window_start' => $windowStart,
            'window_end' => $windowEnd,
            'resolution' => $resolution,
        ]);
    }

    public function getIntegrationsProsumerPricing(string $windowStart, string $windowEnd, string $resolution = 'hour'): array
    {
        return $this->integrationsGet('/integrations/prosumer-pricing/', [
            'window_start' => $windowStart,
            'window_end' => $windowEnd,
            'resolution' => $resolution,
        ]);
    }

    public function getIntegrationsPowerCostByMeterId(
        int $meterId,
        string $windowStart,
        string $windowEnd,
        string $resolution = 'hour'
    ): array {
        return $this->integrationsGet(sprintf('/integrations/meter-data/%d/power-cost/', $meterId), [
            'window_start' => $windowStart,
            'window_end' => $windowEnd,
            'resolution' => $resolution,
        ]);
    }

    public function getIntegrationsEnergyUsage(
        string $windowStart,
        string $windowEnd,
        string $resolution = 'day',
        string $forTz = 'Europe/Warsaw'
    ): array {
        return $this->integrationsGet('/integrations/meter-data/energy-usage/', [
            'window_start' => $windowStart,
            'window_end' => $windowEnd,
            'resolution' => $resolution,
            'for_tz' => $forTz,
        ]);
    }

    public function getIntegrationsEnergyCost(
        string $windowStart,
        string $windowEnd,
        string $resolution = 'day',
        string $forTz = 'Europe/Warsaw'
    ): array {
        return $this->integrationsGet('/integrations/meter-data/energy-cost/', [
            'window_start' => $windowStart,
            'window_end' => $windowEnd,
            'resolution' => $resolution,
            'for_tz' => $forTz,
        ]);
    }

    public function getIntegrationsCarbonFootprint(
        string $windowStart,
        string $windowEnd,
        string $resolution = 'day',
        string $forTz = 'Europe/Warsaw'
    ): array {
        return $this->integrationsGet('/integrations/meter-data/carbon-footprint/', [
            'window_start' => $windowStart,
            'window_end' => $windowEnd,
            'resolution' => $resolution,
            'for_tz' => $forTz,
        ]);
    }

    public function toSessionPayload(): array
    {
        return [
            'access_token' => $this->accessToken,
            'refresh_token' => $this->refreshToken,
            'user_id' => $this->userId,
            'integrations_api_token' => $this->integrationsApiToken,
        ];
    }

    public function setIntegrationsApiToken(?string $token): void
    {
        $normalized = $token !== null ? trim($token) : '';
        $this->integrationsApiToken = $normalized !== '' ? $normalized : null;
        $this->integrationsAuthScheme = null;
    }

    public function getIntegrationsApiToken(): ?string
    {
        return $this->integrationsApiToken;
    }

    public function getUserId(): ?int
    {
        return $this->userId;
    }

    public function hasAuth(): bool
    {
        return !empty($this->accessToken) && !empty($this->refreshToken);
    }

    private function authorizedGet(string $path, array $query = []): array
    {
        $response = $this->request('GET', $path, null, true, $query);
        return is_array($response) ? $response : [];
    }

    private function request(string $method, string $path, ?array $payload, bool $authorized, array $query = [], bool $retry = true): array
    {
        $url = rtrim($this->baseUrl, '/') . $path;
        if (!empty($query)) {
            $url .= '?' . http_build_query($query);
        }

        $headers = [
            'Accept: application/json',
            'User-Agent: pstryk-dashboard/1.0 (+https://github.com/hejsiri/pstryk-dashboard)',
        ];
        if ($authorized) {
            if (!$this->accessToken) {
                throw new RuntimeException('Brak access tokena. Zaloguj się.');
            }
            $headers[] = 'Authorization: Bearer ' . $this->accessToken;
        }

        $ch = curl_init($url);
        if ($ch === false) {
            throw new RuntimeException('Nie udało się zainicjować połączenia CURL.');
        }

        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_TIMEOUT => 20,
            CURLOPT_CONNECTTIMEOUT => 10,
        ]);

        if ($payload !== null) {
            $headers[] = 'Content-Type: application/json';
            curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload, JSON_UNESCAPED_UNICODE));
        }

        $raw = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $error = curl_error($ch);
        if ($raw === false) {
            throw new RuntimeException('Błąd sieciowy CURL: ' . $error);
        }

        $decoded = json_decode($raw, true);

        if ($status === 401 && $authorized && $retry) {
            $this->refreshAccessToken();
            return $this->request($method, $path, $payload, $authorized, $query, false);
        }

        if ($status < 200 || $status >= 300) {
            $message = is_array($decoded) ? json_encode($decoded, JSON_UNESCAPED_UNICODE) : trim($raw);
            throw new RuntimeException(sprintf('API %s %s zwróciło HTTP %d: %s', $method, $path, $status, $message));
        }

        if (!is_array($decoded)) {
            return [];
        }

        return $decoded;
    }

    private function integrationsGet(string $path, array $query = []): array
    {
        $authToken = $this->integrationsApiToken ?: $this->accessToken;
        if (!$authToken) {
            throw new RuntimeException('Brak tokena do Integrations API. Zaloguj się lub podaj klucz API.');
        }

        $schemes = $this->integrationsAuthScheme !== null
            ? [$this->integrationsAuthScheme]
            : (
                $this->integrationsApiToken
                    ? ['raw', 'token', 'bearer']
                    : ['bearer', 'token', 'raw']
            );

        $errors = [];

        foreach ($schemes as $scheme) {
            $headerValue = match ($scheme) {
                'bearer' => 'Bearer ' . $authToken,
                'token' => 'Token ' . $authToken,
                'raw' => $authToken,
                default => null,
            };
            if ($headerValue === null) {
                continue;
            }

            try {
                $response = $this->requestWithHeaders(
                    'GET',
                    $path,
                    null,
                    ['Authorization: ' . $headerValue],
                    $query
                );
                $this->integrationsAuthScheme = $scheme;
                return is_array($response) ? $response : [];
            } catch (Throwable $e) {
                if (
                    $scheme === 'bearer'
                    && str_contains($e->getMessage(), 'HTTP 401')
                    && !$this->integrationsApiToken
                    && !empty($this->refreshToken)
                ) {
                    try {
                        $this->refreshAccessToken();
                        $retryResponse = $this->requestWithHeaders(
                            'GET',
                            $path,
                            null,
                            ['Authorization: Bearer ' . $this->accessToken],
                            $query
                        );
                        $this->integrationsAuthScheme = 'bearer';
                        return is_array($retryResponse) ? $retryResponse : [];
                    } catch (Throwable $retryError) {
                        $errors[] = 'bearer-refresh: ' . $retryError->getMessage();
                    }
                }
                $errors[] = sprintf('%s: %s', $scheme, $e->getMessage());
            }
        }

        throw new RuntimeException('Integrations API auth failed. Próbowano: ' . implode(' | ', $errors));
    }

    private function requestWithHeaders(
        string $method,
        string $path,
        ?array $payload,
        array $extraHeaders = [],
        array $query = []
    ): array {
        $url = rtrim($this->baseUrl, '/') . $path;
        if (!empty($query)) {
            $url .= '?' . http_build_query($query);
        }

        $headers = [
            'Accept: application/json',
            'User-Agent: pstryk-dashboard/1.0 (+https://github.com/hejsiri/pstryk-dashboard)',
        ];
        foreach ($extraHeaders as $header) {
            $headers[] = $header;
        }

        $ch = curl_init($url);
        if ($ch === false) {
            throw new RuntimeException('Nie udało się zainicjować połączenia CURL.');
        }

        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_TIMEOUT => 20,
            CURLOPT_CONNECTTIMEOUT => 10,
        ]);

        if ($payload !== null) {
            $headers[] = 'Content-Type: application/json';
            curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload, JSON_UNESCAPED_UNICODE));
        }

        $raw = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $error = curl_error($ch);

        if ($raw === false) {
            throw new RuntimeException('Błąd sieciowy CURL: ' . $error);
        }

        $decoded = json_decode($raw, true);
        if ($status < 200 || $status >= 300) {
            $message = is_array($decoded) ? json_encode($decoded, JSON_UNESCAPED_UNICODE) : trim($raw);
            throw new RuntimeException(sprintf('API %s %s zwróciło HTTP %d: %s', $method, $path, $status, $message));
        }

        return is_array($decoded) ? $decoded : [];
    }
}

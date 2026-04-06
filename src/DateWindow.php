<?php

declare(strict_types=1);

namespace PstrykWeb;

use DateTimeImmutable;
use DateTimeZone;

final class DateWindow
{
    private const APP_TZ = 'Europe/Warsaw';

    public static function localDayUtcWindow(DateTimeImmutable $day): array
    {
        $localTz = new DateTimeZone(self::APP_TZ);
        $utcTz = new DateTimeZone('UTC');

        $startLocal = new DateTimeImmutable($day->format('Y-m-d') . ' 00:00:00', $localTz);
        $endLocal = $startLocal->modify('+1 day');

        return [
            $startLocal->setTimezone($utcTz),
            $endLocal->setTimezone($utcTz),
        ];
    }

    public static function nowLocalDate(): DateTimeImmutable
    {
        return new DateTimeImmutable('now', new DateTimeZone(self::APP_TZ));
    }

    public static function isoUtc(DateTimeImmutable $dt): string
    {
        return $dt->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d\\TH:i:s\\Z');
    }
}

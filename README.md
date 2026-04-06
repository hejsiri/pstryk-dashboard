# Pstryk Dashboard

Lekki dashboard WWW w PHP dla Pstryk. Aplikacja loguje się do API Pstryk, pobiera dane o cenach energii i zużyciu oraz pokazuje je w czytelnym widoku desktop/mobile.

Projekt powstał po to, aby w prosty i czytelny sposób wyświetlać dynamiczne ceny energii Pstryk na ekranie Tesli, ale może sprawdzić się również w wielu innych zastosowaniach.

W pełni funkcjonalne demo projektu znajduje się pod adresem: https://www.hejsiri.pl/pstryk-dashboard/

## Co potrafi

- logowanie do konta Pstryk przez `email + hasło`,
- trwała sesja po stronie serwera,
- obsługa wielu liczników,
- ceny energii na dziś i jutro,
- wykres słupkowy z nawigacją między dniami,
- kafelki z zużyciem i kosztami dla dnia oraz miesiąca,
- sekcja `RAW API`,
- dodatkowa obsługa `Integrations API key`,
- automatyczna zmiana tła zależnie od pory dnia,
- płynne przełączanie teł między porankiem, dniem, wieczorem i nocą.

## Wymagania

- PHP 8.1 lub nowszy
- rozszerzenie `curl`
- serwer WWW z obsługą PHP lub lokalny `php -S`

## Instalacja na hostingu

1. Skopiuj pliki projektu na swój hosting PHP, na przykład przez FTP, SFTP albo Git.
2. Upewnij się, że hosting obsługuje PHP 8.1+ oraz ma włączone rozszerzenie `curl`.
3. Umieść projekt w katalogu domeny lub subdomeny, tak aby plik `index.php` był dostępny z poziomu przeglądarki.
4. Sprawdź, czy katalogi `storage/cache/` oraz `storage/sessions/` mają możliwość zapisu po stronie serwera.
5. Otwórz adres swojej strony i zaloguj się danymi do konta Pstryk.

Jeśli korzystasz z hostingu współdzielonego, w większości przypadków wystarczy po prostu wrzucić cały katalog projektu do `public_html` lub do katalogu przypisanego do wybranej domeny.

## Struktura projektu

- `index.php` - główny widok aplikacji
- `logout.php` - wylogowanie i czyszczenie sesji
- `config/bootstrap.php` - start sesji, helpery i konfiguracja
- `src/PstrykApiClient.php` - klient API Pstryk i Integrations API
- `src/DateWindow.php` - zakresy czasu dla Europe/Warsaw
- `assets/app.css` - style aplikacji
- `assets/app.js` - wykres, przełączanie tła, interakcje UI
- `assets/img/` - logo i tła
- `storage/cache/` - lokalny cache odpowiedzi API
- `storage/sessions/` - sesje logowania po stronie serwera

## Bezpieczeństwo i publikacja

- hasło użytkownika nie jest zapisywane w projekcie,
- do repozytorium nie trafia cache API ani pliki sesji.

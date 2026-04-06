# Pstryk Dashboard

Lekki dashboard WWW w PHP dla Pstryk. Aplikacja loguje sie do API Pstryk, pobiera dane o cenach energii i zuzyciu oraz pokazuje je w czytelnym widoku desktop/mobile.

## Co potrafi

- logowanie do konta Pstryk przez `email + haslo`,
- trwala sesja po stronie serwera,
- obsluga wielu licznikow,
- ceny energii na dzis i jutro,
- wykres slupkowy z nawigacja miedzy dniami,
- kafelki z zuzyciem i kosztami dla dnia oraz miesiaca,
- sekcja `RAW API`,
- dodatkowa obsluga `Integrations API key`,
- automatyczna zmiana tla zalezne od pory dnia.

## Wymagania

- PHP 8.1 lub nowszy
- rozszerzenie `curl`
- serwer WWW z obsluga PHP lub lokalny `php -S`

## Uruchomienie lokalne

```bash
cd /Users/paweltucki/Sites/localhost/pstryk-dashboard
php -S localhost:8090
```

Nastepnie otworz `http://localhost:8090`.

## Struktura projektu

- `index.php` - glowny widok aplikacji
- `logout.php` - wylogowanie i czyszczenie sesji
- `config/bootstrap.php` - start sesji, helpery i konfiguracja
- `src/PstrykApiClient.php` - klient API Pstryk i Integrations API
- `src/DateWindow.php` - zakresy czasu dla Europe/Warsaw
- `assets/app.css` - style aplikacji
- `assets/app.js` - wykres, przelaczanie tla, interakcje UI
- `assets/img/` - logo i tla
- `storage/cache/` - lokalny cache odpowiedzi API
- `storage/sessions/` - sesje logowania po stronie serwera

## Bezpieczenstwo i publikacja

- haslo uzytkownika nie jest zapisywane w projekcie,
- do repozytorium nie trafia cache API ani pliki sesji,
- lokalne pliki systemowe `.DS_Store` sa ignorowane przez `.gitignore`.

## GitHub

Repo jest gotowe do wrzucenia. Przykladowe kroki:

```bash
cd /Users/paweltucki/Sites/localhost/pstryk-dashboard
git init
git add .
git commit -m "Initial release of Pstryk Dashboard"
git branch -M main
git remote add origin git@github.com:hejsiri/pstryk-dashboard.git
git push -u origin main
```

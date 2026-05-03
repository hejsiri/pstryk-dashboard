# Changelog

Wszystkie istotne zmiany w projekcie będą opisywane w tym pliku.

## [Unreleased]

### Added
- interaktywne kafelki dla widoków `zużycie dziś`, `Koszt dziś`, `zużycie miesiąc` i `Koszt miesiąc`,
- godzinowe wykresy zużycia i kosztu dla bieżącego dnia,
- dzienne wykresy zużycia i kosztu dla bieżącego miesiąca,
- dzienne wykresy zużycia i kosztu dla poprzedniego miesiąca,
- loader danych widoczny podczas odświeżania dashboardu,
- obsługa cen sprzedaży energii na wykresach wraz z przełącznikiem widoku,
- odświeżone favicony i link z logo do strony głównej dashboardu.

### Changed
- poprawiono wykres cen dla wartości ujemnych, w tym zakres osi i renderowanie słupków poniżej zera,
- etykiety wartości na wykresach działają jak stałe plakietki po kliknięciu słupka zamiast tooltipów,
- widoki miesięczne pokazują pełny miesiąc, a przyszłe dni są uzupełniane zerowymi słupkami,
- widoki `zużycie miesiąc` i `Koszt miesiąc` mają przełącznik `bieżący / poprzedni miesiąc` w nagłówku wykresu,
- przełącznik widoku wykresu jest zapisywany w `localStorage`,
- układ kafelków został uporządkowany do kolejności: `zużycie dziś`, `Koszt dziś`, `zużycie miesiąc`, `Koszt miesiąc`.

### Fixed
- poprawiono pozycjonowanie etykiet, ich z-index i kierunek `dziubka`,
- poprawiono kolory słupków dla cen ujemnych oraz styl linii i tła dla wykresu sprzedaży,
- poprawiono przypisanie kliknięć kafelków do właściwych widoków,
- poprawiono parsowanie dat miesięcznych w strefie `Europe/Warsaw`,
- ujednolicono sposób liczenia dziennych słupków kosztu z metryką `Koszt miesiąc`.

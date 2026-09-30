# Bug Reporter

Prywatny panel administracyjny do zarządzania zgłoszeniami błędów (bug reports) ze stron internetowych. Node.js + Express + EJS, dane przechowywane w Supabase.

## Opis

Bug Reporter to osobisty system do przyjmowania, przeglądania i obsługi zgłoszeń błędów. Zgłoszenia trafiają do bazy z widgetu umieszczonego na stronach, a panel służy do ich weryfikacji, klasyfikacji i rozliczania — wszystko w jednym miejscu, z dostępem po haśle.

## Funkcjonalności

- 📋 **Lista zgłoszeń** z paginacją (20 na stronę)
- 🔍 **Filtry** po statusie, źródle, typie i priorytecie — szybkie odnajdywanie tego, co wymaga uwagi
- 📊 **Statystyki na żywo** — liczba nowych, w trakcie i rozwiązanych zgłoszeń
- 📸 **Podgląd zrzutów ekranu** z adnotacjami wysłanymi przez zgłaszającego
- ⚙️ **Zmiana statusu i priorytetu** — prosty flow: nowe → w trakcie → rozwiązane
- 📝 **Notatki wewnętrzne** — komentarze widoczne tylko dla adminów
- 👤 **Przypisywanie zgłoszeń** do konkretnych osób
- 🗑️ **Usuwanie zgłoszeń** wraz z automatycznym czyszczeniem zrzutów z Supabase Storage
- 🔐 **Logowanie hasłem** z szyfrowanymi sesjami

## Bezpieczeństwo

- Service Role Key Supabase nigdy nie wychodzi do przeglądarki
- Hasło administratora i wszystkie klucze trzymane wyłącznie w zmiennych środowiskowych
- Plik `.env` wykluczony z repozytorium

⚠️ Projekt prywatny — wyłącznie do użytku właściciela.
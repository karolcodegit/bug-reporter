# Feedback Hub Admin Panel

Panel administracyjny do zarządzania zgłoszeniami feedback z Twoich stron (ceea.org.pl, panel.ceea.org.pl i innych).

## Struktura projektu

```
feedback-hub-node/
├── server.js           # Główny serwer Express
├── package.json        # Zależności
├── .env.example        # Szablon konfiguracji
├── .gitignore
└── views/
    ├── layout.ejs      # Wspólny szablon HTML
    ├── login.ejs       # Strona logowania
    ├── dashboard.ejs   # Lista zgłoszeń
    ├── detail.ejs      # Szczegóły zgłoszenia
    └── error.ejs       # Strona błędu
```

## Wymagania

- Node.js 18+
- Konto Supabase z projektem `feedback-hub`
- Projekt w Supabase musi mieć:
  - Tabelę `feedback_reports` (z pliku `ceea-feedback-schema.sql`)
  - Bucket `feedback-screenshots` w Storage
  - Edge Function `feedback-submit` (do odbierania zgłoszeń)

## Instalacja

### 1. Zainstaluj zależności

```bash
cd feedback-hub-node
npm install
```

### 2. Skonfiguruj zmienne środowiskowe

```bash
cp .env.example .env
```

Edytuj plik `.env`:

```env
# Supabase — dane z Settings → API w Supabase Studio
SUPABASE_URL=https://twój-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # ⛔ Service Role Key (NIE anon key!)

# Hasło dla administratorów (wszyscy 3 admini używają tego samego hasła)
ADMIN_PASSWORD=TwojeMocneHaslo123!

# Sekret do szyfrowania sesji (wpisz losowy ciąg, min. 32 znaki)
SESSION_SECRET=losowy-ciąg-znaków-min-32-znaków-długości

# Port (opcjonalnie)
PORT=3000
```

**Gdzie znaleźć Service Role Key?**
Supabase Studio → Project Settings → API → `service_role` secret (sekcja "Project API keys"). 

⚠️ **UWAGA:** To jest tajny klucz — nigdy nie wysyłaj go do przeglądarki ani nie wrzucaj na GitHub!

### 3. Uruchom serwer

```bash
# Tryb produkcyjny
npm start

# Tryb developerski (automatyczny restart przy zmianach)
npm run dev
```

Otwórz w przeglądarce: **http://localhost:3000**

Zaloguj się hasłem ustawionym w `ADMIN_PASSWORD`.

## Funkcjonalności

- 📋 **Lista zgłoszeń** z paginacją (20 na stronę)
- 🔍 **Filtry** po statusie, źródle, typie i priorytecie
- 📊 **Statystyki** na żywo (ile nowych, w trakcie, rozwiązanych itp.)
- 📸 **Podgląd zrzutów ekranu** z adnotacjami
- ⚙️ **Zmiana statusu** i priorytetu
- 📝 **Notatki wewnętrzne** dla adminów
- 👤 **Przypisywanie** zgłoszeń do osób
- 🗑️ **Usuwanie** zgłoszeń wraz z zrzutami z Storage

## Wdrożenie na serwer (produkcja)

### Opcja A: PM2 (zalecane)

```bash
npm install -g pm2
pm2 start server.js --name feedback-hub
pm2 save
pm2 startup
```

### Opcja B: Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

### Opcja C: Railway / Render / Heroku

Projekt jest gotowy do wdrożenia na większości platform. Pamiętaj tylko o ustawieniu zmiennych środowiskowych w panelu platformy.

## Bezpieczeństwo

- ✅ Logowanie przez sesje (cookie szyfrowane)
- ✅ Service Role Key nigdy nie wychodzi do przeglądarki
- ✅ RLS w Supabase blokuje nieautoryzowany dostęp do danych
- ✅ Hasło admina w zmiennej środowiskowej (nie w kodzie)

## Następne kroki

1. Podłącz widget do `ceea.org.pl` i `panel.ceea.org.pl`
2. Ustaw webhook Slacka w Edge Function
3. Przetestuj cały flow: widget → Supabase → Slack → panel admina

---

Masz pytania? Sprawdź plik `CEEA_INTEGRACJA.md` z głównego pakietu.
# bug-reporter

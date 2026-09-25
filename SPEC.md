# Veyraflow — SPEC.md

> Specyfikacja produktu i systemu. Ten dokument jest **jedynym źródłem prawdy** o projekcie: na jego podstawie można odtworzyć całą aplikację (kod, bazę danych, konfigurację Supabase, Stripe, Resend, Cloudflare R2, Inngest, Modal, Vercel i dostawców AI) w identycznym kształcie.
>
> Stan dokumentu: **wersja 0.6 (2026-09-24) — aplikacja zdeployowana na Vercelu jako projekt `asset-generator` (https://asset-generator-tawny.vercel.app, region `fra1`, auto-deploy z GitHuba `janeknastaly580-lang/2DAssets-ai-generator`), jeszcze bez zmiennych środowiskowych (§0.1, §0.3 pkt 13, §23.3).** Wcześniej (0.5, 2026-09-23): **wszystkie modele generujące podpięte przez fal.ai (`FAL_KEY`, §9.7): Rodin Gen-2.5 i TRELLIS (3D), ElevenLabs Sound Effects v2 (SFX), Lyria 3 Pro (muzyka), ElevenLabs TTS Turbo v2.5 (głos); Meshy i bezpośrednie API ElevenLabs usunięte; parametry modeli spoza UI ustawia LLM tłumacza (`model_params`, §8.3), który nie jest jeszcze podłączony.** Wcześniej (0.4, 2026-09-22): kod MVP napisany, schemat Supabase wdrożony, Resend przełączony na domenę produkcyjną `veyraflow.eu` (nadawca `website@veyraflow.eu`); **generatory Image i Animacje 2D usunięte z produktu (§9.0)**, 3D dostało selektor Engine i do 3 zdjęć wejściowych, TTS bez katalogu głosów, usuwanie konta natychmiastowe; aplikacja działa na `localhost:3000`**. Sekcja 0 opisuje dokładny stan wdrożenia i czynności ręczne. Każda zmiana w projekcie (lokalnie lub w dowolnej usłudze zewnętrznej) musi być odzwierciedlona tutaj.
>
> Język dokumentu: polski. Język interfejsu użytkownika, kodu, identyfikatorów, komunikatów i e-maili: **angielski**.

---

## Spis treści

0. [Stan wdrożenia (2026-09-24)](#0-stan-wdrożenia-2026-09-24)
1. [Cel i zakres produktu](#1-cel-i-zakres-produktu)
2. [Decyzje projektowe (skrót)](#2-decyzje-projektowe-skrót)
3. [Architektura systemu](#3-architektura-systemu)
4. [Stack technologiczny i struktura repozytorium](#4-stack-technologiczny-i-struktura-repozytorium)
5. [Uwierzytelnianie i konta](#5-uwierzytelnianie-i-konta)
6. [Workspace'y (osobiste i zespołowe)](#6-workspacey-osobiste-i-zespołowe)
7. [Projekty gier, style guide, referencje](#7-projekty-gier-style-guide-referencje)
8. [Uniwersalny pipeline generacji](#8-uniwersalny-pipeline-generacji)
9. [Pipeline'y per typ assetu](#9-pipeliney-per-typ-assetu)
10. [Post-processing, formaty i presety eksportu do silników](#10-post-processing-formaty-i-presety-eksportu-do-silników)
11. [Kredyty, plany, Stripe](#11-kredyty-plany-stripe)
12. [Moderacja i bany](#12-moderacja-i-bany)
13. [Przechowywanie plików (Cloudflare R2) i retencja](#13-przechowywanie-plików-cloudflare-r2-i-retencja)
14. [Kolejka zadań (Inngest) i worker (Modal)](#14-kolejka-zadań-inngest-i-worker-modal)
15. [Model danych (Supabase Postgres)](#15-model-danych-supabase-postgres)
16. [API (Route Handlers) i webhooki](#16-api-route-handlers-i-webhooki)
17. [Interfejs użytkownika — strony i komponenty](#17-interfejs-użytkownika--strony-i-komponenty)
18. [Udostępnianie (linki prywatne)](#18-udostępnianie-linki-prywatne)
19. [Panel administracyjny](#19-panel-administracyjny)
20. [E-maile (Resend)](#20-e-maile-resend)
21. [Formalności prawne, stopka, cookies, RODO](#21-formalności-prawne-stopka-cookies-rodo)
22. [Bezpieczeństwo](#22-bezpieczeństwo)
23. [Konfiguracja usług zewnętrznych — instrukcja odtworzenia](#23-konfiguracja-usług-zewnętrznych--instrukcja-odtworzenia)
24. [Zmienne środowiskowe](#24-zmienne-środowiskowe)
25. [Środowisko developerskie, testy, wdrożenie](#25-środowisko-developerskie-testy-wdrożenie)
26. [Roadmapa (poza MVP)](#26-roadmapa-poza-mvp)
27. [Otwarte decyzje / placeholdery do uzupełnienia](#27-otwarte-decyzje--placeholdery-do-uzupełnienia)
28. [Checklista odtworzenia projektu od zera](#28-checklista-odtworzenia-projektu-od-zera)

---

## 0. Stan wdrożenia (2026-09-24)

Sekcja opisuje **faktyczny stan** projektu po pierwszej implementacji. Reszta dokumentu opisuje docelowy kształt; tam, gdzie implementacja różni się od pierwotnego projektu, jest to zaznaczone w odpowiedniej sekcji.

### 0.1 Co jest zrobione

| Obszar | Stan |
|---|---|
| **Kod aplikacji** (Next.js 15.5, React 19, TS 5.9, Tailwind 4, zod 4) | napisany w całości wg §4.2; `pnpm typecheck`, `pnpm test` (44 testy, stan 2026-09-24), `pnpm build`, `pnpm check:public-env`, `pnpm lint` przechodzą. **Test E2E na localhost (2026-09-20, z kluczem service role, tryb mock)**: rejestracja → e-mail `signin` przez Resend → weryfikacja kodem → sesja → projekt ze style guide'em (pixel art, zablokowana paleta) → wycena → joby: image ×2 (pixel-art 32 px, paleta 16 kolorów), sprite_animation (idle+walk, right+left → sheet, atlas 32 klatek, `.tres`, 4 GIF-y, ZIP), model_3d (GLB/GLTF/OBJ), sfx, music (+loop), voice (2 kwestie + ZIP); prompt naruszający politykę → `rejected` bez naliczenia + `moderation_events`; księga: rezerwacja → rozliczenie, saldo 500 → 395 zgodne; pobieranie pojedynczych plików i ZIP projektu (preset Godot, README_GODOT.md, MANIFEST.json); link udostępniania (`/s/<token>`, pobieranie); panel admina (wszystkie zakładki, `translated_prompt` widoczny tylko tam); UI: generator (wycena na żywo, Generate, podgląd wyniku), biblioteka, sprite player, viewer 3D, billing, ustawienia. Konto testowe usunięte po teście |
| **Supabase** | projekt **`2DAssets`**, ref `lhwvkhdsoozvsftwhcif`, region `eu-central-1`, Postgres 17.6. Zaaplikowano 11 migracji z `supabase/migrations/` (nazwy w projekcie: `veyraflow_0001_extensions_enums` … `veyraflow_0011_grants`) + seed `model_pricing` (21 wierszy) i `feature_flags` (9); potem migracja `immediate_account_deletion` (= plik `20260922000012`) i **2026-09-23 `veyraflow_0013_fal_models`** (= plik `20260923000013_fal_models.sql`: cennik pod fal.ai — obecnie **11 wierszy** `model_pricing`, flaga muzyki bez `provider`). Publikacja Realtime zawiera `job_status_feed`. Linter bezpieczeństwa: bez ostrzeżeń poziomu ERROR (jedyne INFO to tabele z RLS bez polityk = celowo tylko service role) |
| **Supabase — test** | wykonano test SQL: trigger `handle_new_user` (profil + workspace + Scratch + balances), `grant_credits` z idempotencją, `reserve_credits` / `settle_job_credits` (kolejność trial → subscription → purchased), `reset_subscription_credits`, sync `job_status_feed`, kaskadowe usunięcie konta — OK. **Uwaga (migracja 0011)**: w tym projekcie role `anon`/`authenticated`/`service_role` nie dostają domyślnie uprawnień DML na nowych tabelach (tylko REFERENCES/TRIGGER/TRUNCATE) — granty są nadawane jawnie, a `alter default privileges for role postgres` obejmuje przyszłe tabele/sekwencje/funkcje dla `service_role`. Przy dodawaniu tabel czytanych przez klienta trzeba dodać `grant … to authenticated` |
| **Resend** | **domena produkcyjna `veyraflow.eu`** — verified (eu-west-1), dodana 2026-09-22; cała wysyłka idzie z `EMAIL_FROM="Veyraflow <website@veyraflow.eu>"`. Starsza domena `comitraapp.pl` nadal jest w koncie, ale nieużywana. 7 opublikowanych szablonów: `signin`, `preset` (oba **przeprojektowane 2026-09-22** — ciemny brandowany layout z dużym kodem, ta sama logika, aliasy, ID, tematy i zmienne), `workspace-invite`, `assets-expiring`, `moderation-warning`, `account-banned`, `data-export-ready`. Szablony `job-completed` i `account-deletion-scheduled` **usunięte z konta przez właściciela 2026-09-22 i nieodtwarzane** — te dwa e-maile są renderowane inline w kodzie (§20.3). Klucz API **`veyraflow-app-sending-eu`** (sending access, ograniczony do `veyraflow.eu`) utworzony przez właściciela i wpisany do `.env.local` jako `RESEND_API_KEY` — **wysyłka potwierdzona testem 2026-09-22 (HTTP 200 dla `signin` i `preset`)**; poprzedni klucz `veyraflow-app-sending` jest ograniczony do `comitraapp.pl` i zwraca 403 przy wysyłce z `veyraflow.eu` (do usunięcia). Alias `account-deleted` renderowany inline zastąpił `account-deletion-scheduled` (§21.5) |
| **Cloudflare R2** | **Włączone** na koncie (2026-09-22). Istnieje **jeden bucket: `plikiveyraflow1`** (location `EEUR`, storage class Standard, jurisdiction default, utworzony 2026-09-22 przez właściciela) — to on jest bucketem aplikacji, wpisany jako `R2_BUCKET` w `.env` (odstępstwo od pierwotnych nazw `veyraflow-assets`/`veyraflow-assets-dev`, §13). **Brakuje tokenu S3**: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` w `.env.local` są puste, bo Cloudflare pokazuje sekret tylko raz w dashboardzie i nie da się go utworzyć przez API MCP — **czynność ręczna właściciela (§0.3 pkt 7)**. Dopóki są puste, storage działa na **sterowniku lokalnym** (`.data/storage/`, §13); po wklejeniu trzech wartości `storage()` przełącza się na R2 bez zmian w kodzie. Weryfikacja: `pnpm r2:check` (§23.2). Do zrobienia ręcznie także CORS (§23.2 pkt 3) i lifecycle dla `downloads/` (§23.2 pkt 4) |
| **Stripe** | brak kluczy — UI billingu pokazuje „Billing is not configured”; kod checkout/portal/webhooków gotowy (§11.6) |
| **Dostawcy AI** | **2026-09-23: `FAL_KEY` wpisany do `.env.local`, `MOCK_PROVIDERS=false` w `.env`** — wszystkie 4 generatory (3D, SFX, muzyka, głos) wołają prawdziwe modele fal.ai (§9.7). `OPENAI_API_KEY` pusty → **LLM tłumacza jeszcze niepodłączony**: tłumacz = identyczność (+ style guide), moderacja = lista słów, `model_params` puste (parametry spoza UI = domyślne wartości dostawcy). Klucz fal zweryfikowany (uwierzytelnienie działa), ale **konto fal.ai ma wyczerpane saldo** (`403 User is locked. Reason: Exhausted balance`) — prawdziwe generacje ruszą po doładowaniu (§0.3 pkt 9). Meshy i bezpośrednie ElevenLabs usunięte z projektu (kod, env, webhook) |
| **Inngest / Modal** | brak kluczy — kolejka działa **inline** w procesie Next.js (`lib/queue/dispatch.ts`, §14.1); worker Modal ma kod w `worker/`, nie jest wdrożony |
| **Vercel** | **2026-09-24: projekt `asset-generator`** (ID `prj_H6G7LFOahjC7fjpNghC1jdOxdzRA`; nazwa „Asset generator” odrzucona przez Vercel — nazwy projektów muszą być małymi literami bez spacji), konto/team `janeknastaly580-langs-projects` (`team_5ghyU9jSaokV9cFz0Ug9VIDZ`), plan **Hobby**. Podpięty pod repo GitHub **`janeknastaly580-lang/2DAssets-ai-generator`** — push na `main` = deploy Production. Framework Next.js, Node **24.x** (`engines.node: ">=22"` → Vercel wybiera najnowszą pasującą wersję), **Fluid compute ON**, region funkcji **`fra1`** (ustawienie projektu + `vercel.json`), `maxDuration = 300` w `/api/inngest`, `/api/jobs`, `/api/downloads`. Domena produkcyjna: **`https://asset-generator-tawny.vercel.app`**. Deployment Protection: domyślne *Standard* (`all_except_custom_domains`). **Zmienne środowiskowe celowo NIE są wpisane (decyzja właściciela 2026-09-24)** — build przechodzi bez nich, ale w runtime: strony zwracają 500 `MIDDLEWARE_INVOCATION_FAILED` (middleware tworzy klienta Supabase z `NEXT_PUBLIC_SUPABASE_URL`/`_ANON_KEY`), endpointy `/api/*` wymagające bazy zwracają 500 `internal_error`, POST-y odrzucane jako `bad_origin` (`APP_URL` domyślnie `localhost`), `/api/inngest` → 401. Dokończenie: §0.3 pkt 13. Pliki `.env`, `.env.local`, `.env.example` pozostają w `.gitignore` i nie ma ich w repozytorium |
| **Google Analytics 4** | **2026-09-24: kod gotowy** (§21.6) — gtag.js ładowany dopiero po zgodzie „Analytics” z banera cookies, ręczne `page_view` z oczyszczonym URL-em, zdarzenia `login`, `sign_up`, `generate_asset`, `begin_checkout`, `download_asset`, `share`; CSP rozszerzany o domeny Google tylko przy ustawionym ID. **Brak `NEXT_PUBLIC_GA_MEASUREMENT_ID`** (właściwość GA4 jeszcze nie istnieje) → wszystko jest no-opem. Uruchomienie: §0.3 pkt 14, §23.9 |
| **Raportowanie błędów** | **2026-09-24: kod gotowy** — Google Cloud Error Reporting zamiast Firebase Crashlytics (Crashlytics nie ma SDK dla weba, §25.4): błędy serwera (`onRequestError`, 500-ki z `handler()`, nieudane joby, kolejka, ZIP, webhook Stripe) i przeglądarki (`/api/client-errors`). **Brak `GCP_PROJECT_ID` / `GCP_ERROR_REPORTING_API_KEY`** → no-op. Uruchomienie: §0.3 pkt 15, §23.10 |
| **Dokumenty prawne** | placeholdery w `docs/legal/*.md` (status `draft`), renderowane na `/terms`, `/privacy`, `/cookies`, `/ai-disclosure`, `/impressum` |

### 0.2 Zmienne środowiskowe — gdzie co wpisać

Cała logika serwerowa (klucze dostawców, service role, Stripe, Resend) żyje w **Next.js** (Route Handlers / Server Actions), nie w Supabase Edge Functions. Dlatego:

- **`.env`** (w `.gitignore` od 2026-09-23 — nie trafia do repozytorium, choć zawiera tylko wartości jawne) — **wyłącznie wartości jawne**: `NEXT_PUBLIC_*` (URL aplikacji, URL Supabase, klucz publishable, `NEXT_PUBLIC_GA_MEASUREMENT_ID` — ID pomiaru GA4 nie jest sekretem, i tak trafia do przeglądarki) oraz serwerowe nie-sekrety (`APP_URL`, `TOS_VERSION`, `SUPPORT_EMAIL`, `TRIAL_CREDITS`, `MOCK_PROVIDERS`, `INNGEST_DEV`, `PROMPT_TRANSLATOR_MODEL`, `MODERATION_MODEL`, `R2_BUCKET`, `R2_ENDPOINT`, `EMAIL_FROM`, `STRIPE_PRICE_*`, `MODAL_WORKER_URL`, `GCP_PROJECT_ID`). Na Vercelu to zwykłe zmienne środowiskowe.
- **`.env.local`** (gitignore) — **wyłącznie sekrety**: `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `AUTH_CODE_PEPPER`, klucze AI, `R2_ACCOUNT_ID`/`R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `INNGEST_*`, `MODAL_WORKER_TOKEN`, `WORKER_WEBHOOK_SECRET`, `FAL_WEBHOOK_SECRET`, `GCP_ERROR_REPORTING_API_KEY` (§25.4; lokalny plik ma jeszcze nieużywaną pozostałość `SENTRY_DSN` — Sentry nie jest używany). Klucze AI to tylko `OPENAI_API_KEY` i `FAL_KEY` (`MESHY_API_KEY`, `ELEVENLABS_API_KEY`, `MESHY_WEBHOOK_SECRET` usunięte 2026-09-23). Plik istnieje z wygenerowanymi `AUTH_CODE_PEPPER`, `WORKER_WEBHOOK_SECRET`, `MODAL_WORKER_TOKEN` i wpisanym `RESEND_API_KEY`. Na Vercelu każda z tych zmiennych ma być oznaczona **„Sensitive”** (Vercel szyfruje i nigdy nie pokazuje wartości). `SUPABASE_SERVICE_ROLE_KEY` wklejony przez właściciela (2026-09-20). Next.js łączy oba pliki; `.env.local` nadpisuje `.env`.
- Żadna z powyższych zmiennych serwerowych nie trafia do bundla przeglądarki — tam idą tylko `NEXT_PUBLIC_*`; pilnuje tego `pnpm check:public-env` (§22).
- **Supabase Secrets (Edge Functions)** — **nie są potrzebne**; projekt nie używa Edge Functions. Jeśli w przyszłości część logiki trafi do Edge Functions, do `supabase secrets set` trafią te same zmienne serwerowe z §24.
- **Vercel** (projekt `asset-generator`, §0.1) — wszystkie zmienne z §24, sekrety oznaczone „Sensitive”. **Stan 2026-09-24: żadna zmienna nie jest wpisana** (decyzja właściciela); instrukcja — §0.3 pkt 13.

### 0.3 Czynności ręczne (właściciel)

1. ~~**Supabase → Project Settings → API Keys**: skopiować `service_role` do `.env.local`~~ — zrobione 2026-09-20 (bez tego klucza signup/generacje zwracają 503 `not_configured`).
2. **Supabase → Authentication → Providers → Email**: `Confirm email` = ON. **Google — NIE włączać** (logowanie Google usunięte z aplikacji 2026-09-24, §5); jeśli provider Google jest włączony w dashboardzie, wyłączyć go (Providers → Google → *Enable Sign in with Google* = OFF).
3. **Supabase → Authentication → URL Configuration**: Site URL `http://localhost:3000` (produkcyjnie `APP_URL`). Redirect URLs **nie są potrzebne** — aplikacja nie używa OAuth ani linków e-mail Supabase (od 2026-09-24 nie ma trasy `/auth/callback`); wpisy `…/auth/callback`, jeśli są, można usunąć.
4. **Supabase → Authentication → Passwords / Security**: min. długość 10, „Leaked password protection” ON; **Sessions**: JWT expiry 3600 s, refresh token rotation ON.
5. **Supabase → Authentication → SMTP (opcjonalnie)**: własne e-maile Supabase nie są używane, ale żeby domyślne (np. zmiana e-maila w przyszłości) szły przez Resend: host `smtp.resend.com`, port 465, user `resend`, password = klucz API Resend, sender `website@veyraflow.eu`.
6. **Admin**: po pierwszej rejestracji `update public.profiles set role = 'admin' where email = '…';` (SQL Editor).
7. **Cloudflare R2** — ~~włączyć R2~~ i ~~utworzyć bucket~~ zrobione 2026-09-22 (bucket `plikiveyraflow1`, EEUR). **Pozostało (sekret widoczny tylko w dashboardzie, nie da się przez API):**
   1. Dashboard → **R2 Object Storage** → **API** (prawy panel) → **Manage API tokens** → **Create API token**: typ *User API token* lub *Account API token*, permission **Object Read & Write**, zakres **Specify bucket(s) → `plikiveyraflow1`**, TTL: forever. Po „Create” strona **raz** pokazuje `Access Key ID`, `Secret Access Key` oraz `Endpoint for S3 clients` w postaci `https://<32-znakowy-hex>.r2.cloudflarestorage.com`.
   2. Wkleić do `.env.local`: `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, a jako `R2_ACCOUNT_ID` — ten `<32-znakowy-hex>` z endpointu (to samo co „Account ID” w R2 → Overview). `R2_ENDPOINT` zostawić puste — `lib/env.ts` wylicza je z `R2_ACCOUNT_ID`.
   3. `pnpm r2:check` — PUT → HEAD → GET → presigned GET → DELETE na kluczu `_healthcheck/<uuid>.txt` plus informacyjna kontrola CORS. Zielony wynik = `storage()` używa R2 (§13).
   4. CORS bucketu i lifecycle `downloads/` wg §23.2 pkt 3–4 (też w dashboardzie).
8. **Stripe** (§23.4): produkty/ceny, Stripe Tax, portal, webhook → klucze i `STRIPE_PRICE_*`. Lokalnie: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`.
9. **Dostawcy AI** (§23.8): ~~`FAL_KEY` + `MOCK_PROVIDERS=false`~~ — zrobione 2026-09-23. **Pozostało: doładować saldo fal.ai** (konto zablokowane: „Exhausted balance”): zalogować się na https://fal.ai kontem, z którego pochodzi `FAL_KEY` → **Dashboard → Billing** (https://fal.ai/dashboard/billing) → **Add credits / Top up** (pełny test wszystkich modeli ≈ 1 USD; Rodin 0,40 USD za model) — klucz się nie zmienia. `OPENAI_API_KEY` dopiero przy podłączaniu LLM tłumacza (osobne zadanie, §8.3).
10. **Inngest** (§23.6) i **Modal** (§23.7) — opcjonalne na localhost; bez nich działa tryb inline.
11. ~~**Resend**: dodać i zweryfikować domenę `veyraflow.eu`~~ — zrobione 2026-09-22 (domena `verified`, `EMAIL_FROM="Veyraflow <website@veyraflow.eu>"`). Klucz API ograniczony do `veyraflow.eu` (`veyraflow-app-sending-eu`) utworzony i wpisany do `.env.local` 2026-09-22; wysyłka zweryfikowana. Pozostało opcjonalnie: usunąć stary klucz `veyraflow-app-sending`.
12. Uzupełnić placeholdery z §27 (dokumenty prawne, ceny pakietów, Impressum).
13. **Vercel — dokończenie wdrożenia** (projekt `asset-generator` istnieje i jest zdeployowany, §0.1; zmienne celowo niewpisane):
    1. https://vercel.com → projekt **asset-generator** → **Settings → Environment Variables**. Dla każdej zmiennej z `.env` i `.env.local` (§24): **Add New** → Key/Value → środowiska *Production* + *Preview* (+ *Development* opcjonalnie). Zmienne z `.env.local` (sekrety) — zaznaczyć **Sensitive**. Można też użyć **Import .env** i wkleić zawartość pliku (sekrety potem oznaczyć jako Sensitive).
    2. Na Vercelu ustawić inaczej niż lokalnie: `APP_URL` i `NEXT_PUBLIC_APP_URL` = `https://asset-generator-tawny.vercel.app` (lub docelowo `https://veyraflow.eu`) — bez tego wszystkie POST-y są odrzucane jako `bad_origin`, a linki w e-mailach prowadzą na localhost.
    3. Bez `R2_ACCOUNT_ID`/`R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY` (pkt 7) uploady i generacje na Vercelu **nie zadziałają** — sterownik lokalny (`.data/storage`) wymaga zapisywalnego, trwałego dysku, którego funkcje Vercela nie mają.
    4. **Deployments** → ostatni deployment → **⋯ → Redeploy** (zmienne `NEXT_PUBLIC_*` są wkompilowywane w build, więc sam zapis zmiennych nie wystarczy).
    5. Supabase → **Authentication → URL Configuration**: Site URL = produkcyjny `APP_URL` (Redirect URLs niepotrzebne — brak OAuth, pkt 3).
    6. R2 CORS (§23.2 pkt 3): dodać origin `https://asset-generator-tawny.vercel.app`.
    7. Plan Hobby jest wyłącznie do użytku niekomercyjnego — przed włączeniem płatności Stripe przejść na **Pro**. Na Hobby kolejka inline (bez Inngest) ma limit 300 s na job; dłuższe generacje (np. Rodin) wymagają Inngest (§23.6).
14. **Google Analytics 4** — utworzyć właściwość i strumień sieciowy, ustawić strumień (wyłączone „Page changes based on browser history events”, „Outbound clicks” i „File downloads”, redakcja danych), wpisać `NEXT_PUBLIC_GA_MEASUREMENT_ID` na Vercelu i zrobić redeploy — pełna instrukcja w §23.9.
15. **Google Cloud Error Reporting** (zamiast Crashlytics) — projekt Google Cloud, włączone Error Reporting API, klucz API ograniczony do tego API, `GCP_PROJECT_ID` + `GCP_ERROR_REPORTING_API_KEY` na Vercelu, redeploy, powiadomienia e-mail — pełna instrukcja w §23.10.

### 0.4 Odstępstwa od pierwotnego projektu (uzasadnione lokalnym uruchomieniem)

- **Storage lokalny** (`lib/storage/local.ts`): gdy brak `R2_*`, pliki lądują w `.data/storage/<key>`, a „presigned URL” to podpisane HMAC (`AUTH_CODE_PEPPER`) linki `/api/files?key&exp&sig` z tym samym TTL co w R2. Semantyka kluczy (§13) niezmieniona.
- **Kolejka inline** (`lib/queue/dispatch.ts`): gdy brak `INNGEST_EVENT_KEY` (i nie ustawiono `INNGEST_DEV=1`), `POST /api/jobs` uruchamia pipeline po wysłaniu odpowiedzi (`after()`), z zachowaniem limitu współbieżności planu i kolejności FIFO per workspace. Funkcje Inngest (§14.1) używają tego samego kodu pipeline'u (`lib/pipelines/run.ts`).
- **Mock providerów** (`MOCK_PROVIDERS=true` lub brak zarówno `FAL_KEY`, jak i `OPENAI_API_KEY`): pipeline'y zwracają lokalnie wygenerowane pliki (sześcian GLB, syntetyczny WAV). Mock działa **per etap**: generacja jest mockowana, gdy brak `FAL_KEY`; tłumacz i moderacja — gdy brak `OPENAI_API_KEY` (tłumacz = identyczność + style guide, `model_params = {}`; moderacja = lista słów). Wszystko poza samym wywołaniem dostawcy (moderacja→tłumaczenie→kredyty→post-processing→upload→assety) działa jak w produkcji.
- **OGG/MP3 i LUFS**: bez workera ffmpeg SFX ma WAV (surowe PCM z fal owinięte w WAV w procesie, §9.4), muzyka i głos — MP3 z fal, mock — WAV; OGG/MP3/WAV komplet + `loudnorm` powstają, gdy skonfigurowany jest worker (`/audio-process`).
- **Konwersje 3D**: bez workera Blender są GLB, GLTF(+bin) i (w mocku) OBJ/MTL; FBX Unity/Unreal wymaga workera.
- **Dodatkowe kolumny/tabele** względem §15 (opisane tam): `profiles.notification_prefs`, `profiles.cookie_consent`, `assets.tags`, `share_links.show_prompt`, `downloads.error`, tabela `job_status_feed`, widok `jobs_public`, RPC `increment_rate_limit`, `record_violation`; `credit_ledger.actor_id` bez FK; trigger `profiles_before_delete`.

---

## 1. Cel i zakres produktu

**Veyraflow** to aplikacja webowa (SaaS) — generator assetów do gier oparty na AI. Użytkownik opisuje, czego potrzebuje, a system generuje gotowy do użycia asset i udostępnia go do pobrania w formatach, które można bezpośrednio zaimportować do silnika gry (Unity, Unreal Engine, Godot).

### 1.1 Typy assetów w MVP (wszystkie od razu)

| Typ | Co obejmuje | Główne wyjście |
|---|---|---|
| **Grafika 2D** | sprite'y, postacie 2D, ikony, elementy UI, tła, tekstury (w tym seamless), tile'e | PNG (alpha), WebP |
| **Animacje 2D** | animowane postacie (idle/walk/run/jump/attack/hit/death/custom) ze sprite sheetem | sprite sheet PNG + atlas JSON + Godot `.tres` + GIF podgląd + ZIP klatek |
| **Modele 3D + postacie 3D** | text→3D, image→3D, tekstury PBR, auto-rigging, animacje 3D, low-poly z limitem trójkątów | GLB, GLTF, FBX, OBJ+MTL + tekstury PNG |
| **Dźwięk** | SFX, muzyka (w tym pętle), głosy postaci (TTS) | WAV, OGG, MP3 |

### 1.2 Kluczowe założenia niepodlegające negocjacji

1. **Klucze API dostawców AI istnieją wyłącznie po stronie backendu.** Przeglądarka nigdy nie rozmawia z fal.ai, OpenAI ani workerem bezpośrednio. Żaden klucz dostawcy nie ma prefiksu `NEXT_PUBLIC_`.
2. **Każda generacja przechodzi przez niewidoczną dla użytkownika warstwę tłumaczenia promptu** (LLM), która **nie dodaje niczego od siebie** — jedynie przekłada intencję użytkownika na formę najlepiej zrozumiałą dla wyspecjalizowanego modelu generującego (szczegóły w §8.3).
3. **Spójność stylu**: assety powstają w kontekście *Projektu gry* z własnym style guide'em i obrazami referencyjnymi.
4. **Pobieranie „pod silnik”**: każdy asset ma presety eksportu Unity / Unreal / Godot.
5. **Bez modeli wideo** (Sora, Kling, Wan itp.) do animacji 2D — za drogie. Animacje 2D robimy szkieletowo (auto-rig + biblioteka ruchów), patrz §9.2.
6. **Monetyzacja**: kredyty + subskrypcje (Pro 15 USD/mies., Studio 45 USD/mies.), pakiety kredytów, trial za 1,29 USD netto (przed VAT) dający ok. +0,08 USD zysku po prowizjach Stripe. Dwa okienka kredytów: **Subscription credits** — co miesiąc **resetują się** do puli planu (1000 Pro / 3200 Studio); **Usage credits** — z pakietów, **nigdy się nie resetują**. Płatności przez Stripe; dane kart nigdy nie trafiają do nas (Stripe Checkout hosted).
7. UI **tylko po angielsku** (bez i18n w MVP).

---

## 2. Decyzje projektowe (skrót)

| Obszar | Decyzja |
|---|---|
| Nazwa | **Veyraflow** (domena produkcyjna: **`veyraflow.eu`**) |
| Frontend + backend | Next.js (App Router, TypeScript, React Server Components, Route Handlers, Server Actions) |
| UI | Tailwind CSS 4 + komponenty w stylu shadcn/ui napisane ręcznie na pakiecie `radix-ui` (`components/ui/*`), dark mode domyślnie, przełącznik na light |
| Baza danych + Auth | Supabase (Postgres + Supabase Auth) — projekt **`2DAssets`** (`lhwvkhdsoozvsftwhcif`, eu-central-1, PG 17), był pusty, dedykowany dla Veyraflow |
| Pliki | Cloudflare R2 (S3-compatible), bucket prywatny, presigned URL; **lokalnie (do czasu włączenia R2) sterownik dyskowy `.data/storage` z podpisanymi linkami** (§0.4, §13) |
| Hosting | Vercel (Preview + Production) |
| Kolejka / długie zadania | Inngest (produkcja); **fallback inline** w procesie Next.js, gdy brak kluczy Inngest (§14.1) |
| Ciężka obróbka (rig 2D, Blender, ffmpeg) | Worker Python na Modal (HTTPS, token) |
| Płatności | Stripe (Checkout, Customer Portal, Webhooks, Stripe Tax) |
| E-maile | Resend (7 szablonów + 2 e-maile renderowane inline w kodzie; nadawca `Veyraflow <website@veyraflow.eu>`, domena `veyraflow.eu` zweryfikowana) |
| Hub modeli AI | **fal.ai — jedyny dostawca modeli generujących** (od 2026-09-23, §9.7), klient `@fal-ai/client`, klucz `FAL_KEY` |
| 3D | Rodin Gen-2.5 (Hyper3D; text-to-3D i image-to-3D) oraz TRELLIS (Microsoft; image-to-3D) — oba przez fal.ai; rigging/animacje — model fal.ai do wyboru (§27 poz. 15) |
| Audio | przez fal.ai: ElevenLabs Sound Effects v2 (SFX), Google Lyria 3 Pro (muzyka), ElevenLabs TTS Turbo v2.5 (głos) |
| Tłumacz promptów | OpenAI, model `gpt-5.6-luna` (nazwa podana przez właściciela; dokładne ID modelu zweryfikować w dokumentacji OpenAI przed implementacją; konfigurowalne przez env). Oprócz promptu ustawia **parametry modeli, których nie ma w UI** (`model_params`, §8.3, §9.7). **Jeszcze niepodłączony** (brak `OPENAI_API_KEY`) |
| Moderacja promptów | tani LLM OpenAI (np. najtańszy aktualny model klasy „nano/mini”; konfigurowalne przez env) |
| Logowanie | wyłącznie e-mail + hasło (rejestracja z 6-cyfrowym kodem); reset hasła 8-cyfrowym kodem. Logowanie Google usunięte 2026-09-24 |
| Sharing | prywatne linki z tokenem do assetu/projektu (bez galerii publicznej) |
| Zespoły | workspace'y zespołowe ze wspólnymi projektami i kredytami (plan Studio) |
| Moderacja wyników | **brak** (polegamy na dostawcach) |
| Admin | pełny panel (użytkownicy, kredyty, joby, koszty, flagi, bany) |
| Formalności | Terms of Service, Privacy Policy, Cookie Policy, AI Disclosure, Impressum/dane firmy, baner cookies (treści dokumentów — placeholdery) |

---

## 3. Architektura systemu

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Przeglądarka (Next.js RSC + Client Components, Supabase JS z anon key)      │
│  - UI generatora, biblioteka, projekty, billing, admin                        │
│  - Realtime: subskrypcja zmian w tabeli `jobs` (status/progress)              │
└───────────────┬──────────────────────────────────────────────────────────────┘
                │ HTTPS (cookies sesji Supabase, CSRF-safe Server Actions / Route Handlers)
┌───────────────▼──────────────────────────────────────────────────────────────┐
│  Vercel — Next.js (server)                                                    │
│  - Route Handlers /api/*  (walidacja zod, autoryzacja, RLS przez user token)  │
│  - Server Actions (formularze)                                                │
│  - Inngest functions (/api/inngest) — kroki pipeline'u generacji             │
│  - Lekki post-processing: sharp (PNG/WebP, cięcie, atlas), zip streaming      │
│  - Wszystkie klucze dostawców AI tylko tutaj (env server-only)               │
└──┬──────────┬──────────┬──────────┬───────────┬───────────┬──────────────────┘
   │          │          │          │           │           │
   ▼          ▼          ▼          ▼           ▼           ▼
Supabase   Cloudflare  Inngest    Stripe     Resend     Dostawcy AI
Postgres   R2 (pliki)  (kolejka)  (płatn.)   (e-mail)   OpenAI (tłumacz + moderacja)
+ Auth                                                    fal.ai (Rodin Gen-2.5, TRELLIS,
+ Realtime                                                ElevenLabs SFX v2 / TTS Turbo v2.5, Lyria 3 Pro)
                                                                 │
                                                                 ▼
                                                   Worker Modal (Python, HTTPS + token)
                                                   - Animated Drawings (auto-rig 2D + klipy ruchu)
                                                   - Blender headless (konwersje 3D, render miniatur)
                                                   - ffmpeg (audio, GIF), kwantyzacja pixel-art
```

Zasady przepływu:

- Przeglądarka **nigdy** nie otrzymuje URL-i dostawców ani kluczy. Jedynymi zewnętrznymi hostami widocznymi w przeglądarce są: domena aplikacji, Supabase (auth/realtime/db przez anon key + RLS), Stripe Checkout/Portal (redirect), Cloudflare R2 (tylko presigned URL do pobrania/uploadu, krótkotrwałe).
- Zapisy do tabel finansowych (`credit_ledger`, `credit_balances`, `jobs`, `assets`) wykonuje wyłącznie backend z **service role** (nigdy klient).
- Długie zadania (generacje) idą przez Inngest; UI dostaje status przez Supabase Realtime na tabeli `jobs`.

---

## 4. Stack technologiczny i struktura repozytorium

### 4.1 Wersje i biblioteki

| Warstwa | Technologia |
|---|---|
| Runtime | Node.js 22 LTS, pnpm |
| Framework | Next.js 15.5 (App Router), React 19.3, TypeScript 5.9 (strict) |
| Stylowanie | Tailwind CSS v4 (`@tailwindcss/postcss`), `tw-animate-css`, `radix-ui` (unified), `class-variance-authority`, lucide-react, `next-themes`, `sonner` (toasty) |
| Formularze / walidacja | zod 4 (te same schematy w `lib/validation/*` na kliencie i serwerze); formularze generatora to kontrolowane komponenty React (react-hook-form zainstalowany, nieużywany w MVP) |
| Stan serwera | TanStack Query (client) + RSC |
| Supabase | `@supabase/supabase-js`, `@supabase/ssr` (cookies), Supabase CLI (migracje) |
| Kolejka | `inngest` SDK v3 (`inngest/next` serve) |
| Modele AI | `@fal-ai/client` 1.10 (tylko serwer: `queue.submit/status/result`, `storage.upload`) — instalacja `pnpm add @fal-ai/client` (dokumentacja fal podaje `npm install --save @fal-ai/client`; w projekcie zawsze pnpm) |
| Płatności | `stripe` SDK |
| E-mail | `resend` SDK (wysyłka szablonów po aliasie) |
| Pliki | `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` (R2) + sterownik lokalny; ZIP przez `jszip` |
| Obrazy | `sharp` 0.35 (resize, trim, PNG/WebP, animowany GIF przez `join`), własny moduł kwantyzacji palety `lib/postprocess/pixelArt.ts` (median-cut + Lab) |
| Atlas | własny packer siatkowy (grid) + eksport JSON (TexturePacker hash/array) + generator `.tres` |
| 3D podgląd w UI | `three` + `@react-three/fiber` + `@react-three/drei` (GLB viewer, turntable, wireframe, klipy). Bez `<Environment preset>` drei — pobiera HDRI z obcego CDN, co blokuje CSP (§22); oświetlenie lokalne |
| Audio w UI | `wavesurfer.js` |
| Analityka | Google Analytics 4 przez gtag.js wstrzykiwany ręcznie (`lib/analytics.ts`, bez paczki npm i bez Firebase SDK), tylko po zgodzie (§21.6) |
| Raportowanie błędów | Google Cloud Error Reporting przez REST API (`fetch` + klucz API, bez SDK) — `lib/errorReporting.ts`, `instrumentation.ts` (§25.4) |
| Testy | Vitest 5 (unit, `tests/*.test.ts`); Playwright/msw — do dodania (§25.2) |
| Lint | ESLint 9 flat config (`next/core-web-vitals`, `next/typescript`), Prettier |
| Worker | Python 3.11, Modal, Animated Drawings (Meta, Apache-2.0), Blender 4.1 headless, ffmpeg, Pillow, numpy — kod w `worker/`, niewdrożony |

### 4.2 Struktura repozytorium (stan faktyczny — jedna aplikacja + worker, bez workspaces pnpm)

```
/
├── SPEC.md                          ← ten dokument
├── README.md                        ← skrót uruchomienia (odsyła do SPEC.md)
├── package.json, pnpm-lock.yaml, tsconfig.json, next.config.ts, postcss.config.mjs,
│   eslint.config.mjs, vitest.config.mts, components.json, .prettierrc, .npmrc
├── .env                             ← wartości JAWNE (gitignore): NEXT_PUBLIC_* + serwerowe nie-sekrety (§0.2)
├── .env.local                       ← SEKRETY (gitignore); na Vercelu = zmienne „Sensitive"
├── .env.example                     ← szablon obu plików (bez wartości; gitignore)
├── .claude/launch.json              ← konfiguracja podglądu dev servera (Claude Code)
├── vercel.json                      ← Vercel: framework nextjs, regions ["fra1"] (§23.3)
├── middleware.ts                    ← odświeżanie sesji Supabase + guardy /app, /admin, ban (§5.2, §5.4)
├── app/
│   ├── layout.tsx, globals.css      ← root layout (Providers: next-themes, TanStack Query, sonner) + CookieBanner + Analytics
│   ├── not-found.tsx, error.tsx, global-error.tsx (error boundaries → raport błędu, §25.4)
│   ├── (marketing)/                 ← layout z SiteHeader/SiteFooter; page.tsx (landing), pricing/, terms/, privacy/,
│   │                                   cookies/, ai-disclosure/, impressum/, contact/
│   ├── (auth)/                      ← login/, signup/, verify/, forgot-password/, reset-password/
│   ├── banned/page.tsx  invite/[token]/page.tsx  s/[token]/page.tsx
│   ├── app/                         ← layout.tsx (AppShell) + page.tsx (dashboard), projects/, projects/[id]/,
│   │                                   generate/[type]/ (model_3d, audio_sfx, audio_music, audio_voice), library/, assets/[id]/, jobs/, billing/, settings/, workspaces/new/
│   ├── admin/                       ← layout.tsx + page.tsx (overview), users/, workspaces/, jobs/, costs/, pricing/, flags/,
│   │                                   moderation/, audit/
│   └── api/                         ← Route Handlers (§16): auth/*, workspaces/*, invites/*, projects/*, jobs/*, assets/*,
│                                       downloads/*, uploads/*, files (lokalny storage), billing/*, share/*, s/[token],
│                                       account, admin/*, webhooks/{stripe,fal,worker}, inngest, client-errors (§25.4)
├── components/
│   ├── ui/                          ← button.tsx, primitives.tsx (Input, Textarea, Label, Badge, Card, Table, Alert, Progress,
│   │                                   Skeleton, Avatar…), overlays.tsx (Dialog, DropdownMenu, Tooltip, Select, Tabs, Switch,
│   │                                   Checkbox, Slider) — na pakiecie `radix-ui`
│   ├── providers.tsx, theme-toggle.tsx, cookie-banner.tsx (ConsentManager), analytics.tsx (GA4 po zgodzie, §21.6), error-reporter.tsx (globalne błędy JS, §25.4), logo.tsx
│   ├── marketing/                   ← site-header, site-footer (§21.1), legal-document (§21.2)
│   ├── auth/                        ← auth-shell, otp-input (6/8 cyfr)
│   ├── app/                         ← app-shell, sidebar (WorkspaceSwitcher + CreditBadge), topbar (⌘K, dzwonek),
│   │                                   tos-modal, asset-card (AssetGrid), job-status (JobStatusBadge), active-jobs,
│   │                                   download-panel, share-dialog
│   ├── generate/                    ← generator.tsx (3 panele), fields.tsx (PromptField, ReferencePicker…),
│   │                                   forms-visual.tsx (3D), forms-audio.tsx (sfx, music, voice)
│   ├── preview/                     ← image-preview, sprite-player, model-viewer(+inner, three.js), audio-player (wavesurfer),
│   │                                   asset-preview (dobór viewera)
│   ├── projects/                    ← project-dialog, style-guide-form (PalettePicker)
│   └── admin/                       ← admin-nav, admin-table
├── hooks/                           ← use-data.ts (TanStack Query), use-job-feed.ts (Realtime + polling)
├── lib/
│   ├── env.ts                       ← dostęp do env + `integrations` (co jest skonfigurowane)
│   ├── api.ts                       ← koperta JSON, ApiError, requireUser/requireAdmin, CSRF (Origin), audit()
│   ├── appContext.ts                ← kontekst dla /app (profil, workspace'y, saldo, ToS)
│   ├── workspace.ts                 ← cookie `vf_ws`, role, read-only
│   ├── plans.ts                     ← plany, pakiety, stałe (§11.3)
│   ├── flags.ts, legal.ts, share.ts, sharePublic.ts, assets.ts, downloads.ts, dataExport.ts, maintenance.ts, webhooks.ts
│   ├── analytics.ts                 ← GA4: enable/disable wg zgody, sanitizeUrl, trackPageView, track (§21.6)
│   ├── errorReporting.ts            ← Google Cloud Error Reporting: reportError / reportErrorLater (§25.4)
│   ├── supabase/                    ← browser.ts, server.ts, admin.ts (service role), middleware.ts, database.types.ts
│   ├── auth/                        ← codes.ts (CSPRNG, SHA-256+pepper, constant-time), ratelimit.ts
│   ├── credits/                     ← pricing.ts (wycena z `model_pricing`), ledger.ts (wrappery RPC)
│   ├── billing/                     ← stripe.ts (checkout/portal), webhook.ts (§11.6)
│   ├── ai/                          ← translator.ts (§8.3), moderation.ts (§12.1), falModels.ts (rejestr modeli fal.ai, §9.7)
│   │   └── providers/               ← types.ts, openai.ts, fal.ts (@fal-ai/client: kolejka + upload), worker.ts
│   ├── pipelines/                   ← run.ts (orkiestrator §8), model3d.ts (+ generate3dOnFal), audio.ts (sfx/music/voice),
│   │                                   finalize.ts (upload + assets), inputs.ts, providerWait.ts, types.ts
│   ├── postprocess/                 ← image.ts (trim/pad/webp/thumb/3x3/palette), pixelArt.ts, atlas.ts (+.tres), glb.ts,
│   │                                   audio.ts (WAV, normalizacja, loop, waveform), enginePresets.ts (README), mockImage.ts
│   ├── storage/                     ← index.ts (wybór sterownika), r2.ts, local.ts, keys.ts
│   ├── email/resend.ts              ← wysyłka: szablony Resend po ID + 2 e-maile renderowane inline (§20.3)
│   ├── queue/dispatch.ts            ← Inngest lub inline
│   ├── client/                      ← api.ts (fetch + upload presign→PUT→complete), constants.ts, reportError.ts (błędy przeglądarki → /api/client-errors)
│   └── validation/                  ← auth.ts, project.ts, jobs.ts, misc.ts (zod 4)
├── inngest/
│   ├── client.ts                    ← katalog eventów
│   └── functions/                   ← generateAsset.ts, maintenance.ts (crony, e-mail, ZIP, eksport, relay webhooków), index.ts
├── supabase/
│   ├── config.toml
│   ├── migrations/                  ← 20260920000001…0011 (schemat §15 + granty), 20260922000012 (wycofane generatory),
│   │                                   20260923000013_fal_models (cennik fal.ai) — wszystkie zaaplikowane w projekcie
│   └── seed.sql                     ← model_pricing, feature_flags
├── worker/                          ← Python (Modal)
│   ├── modal_app.py                 ← endpointy: /rig-animate, /convert-3d, /render-thumbnail, /audio-process, /make-gif, /pixelize, /tasks/{id}
│   ├── animated_drawings/           ← render_clips.py + motions/index.json (biblioteka klipów; pliki BVH do dodania)
│   ├── blender/                     ← convert.py, turntable.py
│   └── requirements.txt
├── instrumentation.ts               ← Next.js onRequestError → Error Reporting (§25.4)
├── scripts/check-public-env.ts      ← test bezpieczeństwa env/bundla (§22)
├── scripts/check-r2.ts              ← round-trip PUT/HEAD/GET/presign/DELETE na R2 (§23.2)
├── tests/                           ← postprocess.test.ts, validation.test.ts, email.test.ts, falModels.test.ts, analytics.test.ts, errorReporting.test.ts, stubs/
└── docs/legal/                      ← terms.md, privacy.md, cookies.md, ai-disclosure.md, impressum.md (placeholdery)
```

---

## 5. Uwierzytelnianie i konta

Supabase Auth jest źródłem tożsamości (`auth.users`). Obsługiwane metody:

1. **E-mail + hasło** (rejestracja z weryfikacją 6-cyfrowym kodem) — jedyna metoda.

Nie ma logowania Google (**usunięte 2026-09-24** decyzją właściciela: przycisk „Continue with Google”, komponent `google-button`, trasa `/auth/callback` i blok `[auth.external.google]` w `supabase/config.toml`), magic linków, GitHuba, Discorda. Aplikacja nie wywołuje `signInWithOAuth`/`exchangeCodeForSession`.

### 5.1 Rejestracja (e-mail + hasło) — 6-cyfrowy kod

Cały przepływ realizuje **nasz backend** (service role), nie wbudowane e-maile Supabase — dzięki temu mamy pełną kontrolę nad długością kodów (6 vs 8) i szablonami Resend.

Konfiguracja Supabase Auth: „Confirm email” = **włączone** (niezweryfikowany użytkownik nie może się zalogować), wbudowane e-maile Supabase nieużywane (nigdy nie wołamy `signUp` z klienta).

1. `/signup`: formularz `email`, `password` (min. 10 znaków, wymóg: litera + cyfra), checkbox **„I accept the Terms of Service and Privacy Policy”** (wymagany), checkbox marketingowy (opcjonalny).
2. `POST /api/auth/signup`:
   - walidacja zod; rate limit (§22);
   - jeśli konto z tym e-mailem istnieje i jest zweryfikowane → odpowiedź generyczna („If this email is new, we sent a code”) — bez ujawniania istnienia konta; jeśli istnieje i **nie** jest zweryfikowane → ponownie wysyłamy kod (aktualizując hasło na podane);
   - w przeciwnym razie `auth.admin.createUser({ email, password, email_confirm: false, user_metadata: { tos_version, marketing_consent } })`;
   - generowanie **6-cyfrowego** kodu (CSPRNG), zapis do `auth_codes` (`purpose='signup'`, `code_hash = sha256(code + pepper)`, `expires_at = now()+10 min`, `max_attempts = 5`);
   - wysyłka Resend: szablon alias **`signin`**, zmienna `CODE` = kod;
   - odpowiedź: przekierowanie na `/verify?email=…`.
3. `/verify`: 6 pól na cyfry (auto-focus, wklejanie), przycisk „Resend code” (cooldown 60 s, max 5 wysyłek/godz./e-mail).
4. `POST /api/auth/verify-signup`: sprawdzenie kodu (constant-time), licznik prób; sukces → `auth.admin.updateUserById(id, { email_confirm: true })`, `auth_codes.consumed_at = now()`. Profil i osobisty workspace powstają już w chwili `createUser` (trigger `handle_new_user`, §15.2). Strona `/signup` trzyma hasło w `sessionStorage` (`vf_pending_signup`) i `/verify` przekazuje je w żądaniu, dzięki czemu backend loguje użytkownika (server-side `signInWithPassword` → cookies) → redirect `/app`; bez hasła (odświeżona strona) → redirect `/login?verified=1`.
5. Błędy: kod niepoprawny (pozostałe próby), wygasł (pokaż „Resend”), za dużo prób (kod unieważniony, trzeba wysłać nowy).

### 5.2 Logowanie

- `/login`: e-mail + hasło → `signInWithPassword` (klient Supabase SSR). Jeśli e-mail niezweryfikowany → komunikat i przycisk „Verify email” (ponowna wysyłka kodu, ten sam mechanizm co w §5.1).
- Pod formularzem nie ma innych metod logowania (brak separatora „or” i przycisku OAuth). Jeśli `tos_accepted_at` jest puste albo `tos_version` jest starsza niż bieżąca `TOS_VERSION`, przy wejściu do `/app` pokazuje się blokujący modal akceptacji regulaminu (`components/app/tos-modal.tsx`, §21.2).
- Sesja: cookies Supabase (`@supabase/ssr`), odświeżanie w middleware.
- „Remember me” nie występuje — sesja Supabase domyślna (refresh token, 30 dni nieaktywności).

### 5.3 „Forgot password” — 8-cyfrowy kod

1. `/forgot-password`: pole e-mail → `POST /api/auth/forgot-password`.
2. Backend: odpowiedź **zawsze** generyczna („If an account exists for this email, we sent a code”). Jeśli konto istnieje: generowanie **8-cyfrowego** kodu, `auth_codes` (`purpose='password_reset'`, TTL 15 min, max 5 prób), Resend szablon alias **`preset`**, zmienna `PRESET` = kod.
3. `/reset-password?email=…`: 8 pól na cyfry + nowe hasło + powtórzenie.
4. `POST /api/auth/reset-password`: weryfikacja kodu → `auth.admin.updateUserById(id, { password })` → unieważnienie wszystkich sesji użytkownika (`auth.admin.signOut(userId, 'global')`) → e-mail nie jest wysyłany (roadmapa: powiadomienie o zmianie hasła) → redirect `/login` z komunikatem.

### 5.4 Konto

- `profiles.role`: `user` | `admin`. Admin nadawany ręcznie w bazie (seed) lub przez innego admina.
- Ustawienia konta (`/app/settings`): display name, avatar (upload do R2, max 2 MB), zmiana hasła (wymaga starego), zmiana e-maila (roadmapa), zgody marketingowe, usunięcie konta (§21.5), eksport danych (§21.5).
- Zbanowany użytkownik: `profiles.banned_at != null` → middleware wylogowuje i pokazuje `/banned` z powodem i kontaktem.

---

## 6. Workspace'y (osobiste i zespołowe)

**Workspace jest jednostką rozliczeniową**: to do niego przypisane są plan, subskrypcja Stripe, kredyty, limity storage, projekty i assety.

- Każdy użytkownik dostaje automatycznie **workspace osobisty** (`type='personal'`, nazwa = display name), którego nie można usunąć ani opuścić.
- **Workspace zespołowy** (`type='team'`) może utworzyć użytkownik, którego workspace osobisty lub inny workspace, gdzie jest ownerem, ma plan **Studio** — w praktyce: tworząc team workspace użytkownik od razu wybiera dla niego plan Studio (checkout). Team workspace bez aktywnej subskrypcji Studio przechodzi w tryb tylko-do-odczytu (przegląd i pobieranie do końca retencji, brak generacji).
- Plan Studio zawiera **5 miejsc** (seats: owner + 4). Dodatkowe miejsca: roadmapa (Stripe quantity).
- Przełącznik workspace'u w sidebarze (lewy górny róg). Aktualny workspace zapisany w cookie `vf_ws` (ustawiane przez `POST /api/workspaces/:id/switch`). Utworzenie team workspace'u (`POST /api/workspaces`) od razu przełącza na niego i prowadzi do checkoutu Studio; do czasu aktywnej subskrypcji workspace jest read-only.

### 6.1 Role i uprawnienia

| Uprawnienie | owner | admin | member | viewer |
|---|---|---|---|---|
| Przeglądać projekty/assety, pobierać | ✓ | ✓ | ✓ | ✓ |
| Generować (zużywać kredyty workspace'u) | ✓ | ✓ | ✓ | ✗ |
| Tworzyć/edytować/usuwać projekty i assety | ✓ | ✓ | ✓ (własne + projekty, do których ma dostęp; usuwanie tylko własnych) | ✗ |
| Tworzyć linki udostępniania | ✓ | ✓ | ✓ | ✗ |
| Zapraszać/usuwać członków, zmieniać role | ✓ | ✓ (nie może dotykać ownera) | ✗ | ✗ |
| Billing (plan, kredyty, faktury, portal Stripe) | ✓ | ✗ | ✗ | ✗ |
| Usunąć workspace / przekazać własność | ✓ | ✗ | ✗ | ✗ |

### 6.2 Zaproszenia

- `POST /api/workspaces/:id/invites` → rekord `workspace_invites` (token losowy 32 B, hash w bazie, TTL 7 dni), e-mail przez Resend (szablon `workspace-invite`, §20).
- Link `/invite/[token]` → jeśli niezalogowany: rejestracja/logowanie z zachowaniem `next`; po zalogowaniu: akceptacja (e-mail konta musi zgadzać się z e-mailem zaproszenia) → `workspace_members`.

---

## 7. Projekty gier, style guide, referencje

**Projekt** grupuje assety jednej gry i wymusza spójność stylu. Każda generacja odbywa się w kontekście projektu (użytkownik może wybrać projekt „Scratch” — automatycznie tworzony w każdym workspace, bez style guide'u).

### 7.1 Pola projektu (`projects`)

- `name`, `description`
- `style_guide` (jsonb):
  ```json
  {
    "art_style": "pixel art | hand-painted | cartoon | anime | flat vector | low-poly 3D | realistic | voxel | custom text",
    "style_notes": "wolny tekst użytkownika, np. 'chunky outlines, 3/4 top-down perspective'",
    "palette": ["#1a1c2c", "#5d275d", "..."],          // opcjonalnie, max 64 kolory
    "palette_locked": false,                            // true → pixel-art pipeline kwantyzuje do tej palety
    "perspective": "side | top-down | isometric | 3/4 | front | any",
    "pixel_grid": 32,                                   // null jeśli nie pixel art; typowe: 16/32/48/64/128
    "mood": "dark fantasy, cozy, sci-fi…",
    "target_engine": "unity | unreal | godot | null",   // domyślny preset eksportu
    "audio_notes": "np. 'chiptune, 8-bit', 'orchestral'",
    "voice_defaults": { "language": "en" }
  }
  ```
- `references` (tabela `project_references`): obrazy referencyjne (upload lub asset z biblioteki) z rodzajem: `style` (ogólny styl), `character` (character sheet konkretnej postaci — używany do image-to-image / image-to-3D / animacji), `palette` (obraz, z którego wyciągamy paletę — ekstrakcja kolorów po stronie serwera).

### 7.2 Jak style guide wpływa na generację

- Style guide i notatki użytkownika są traktowane jako **informacje pochodzące od użytkownika** — warstwa tłumaczenia (§8.3) przekazuje je dalej do modelu razem z promptem, ale **nie dopisuje nic ponad to**.
- `palette_locked` + `pixel_grid` sterują post-processingiem pixel-art (§10.2).
- Referencje projektu (np. `character`) można wybrać w generatorze 3D jako zdjęcia wejściowe — trafiają do Rodina image-to-3D lub TRELLIS-a na fal.ai (§9.3, §9.7); nie są dołączane automatycznie.
- `target_engine` ustawia domyślny preset w panelu pobierania.

---

## 8. Uniwersalny pipeline generacji

Każdy typ assetu przechodzi ten sam szkielet (funkcja Inngest `asset/generate.requested`):

```
[UI] prompt + parametry + projekt
  │
  ▼
1. create job (status=queued) ──► 2. reserve credits (RPC atomowe; brak → failed:insufficient_credits)
  │
  ▼
3. moderate prompt (tani LLM, §12) ──► blocked → status=rejected, zwrot rezerwacji, moderation_event, licznik naruszeń
  │ allowed
  ▼
4. translate prompt (gpt-5.6-luna, §8.3) → structured prompt dla docelowego modelu + model_params (parametry spoza UI)
   (zapis w jobs.translated_prompt — niewidoczny dla użytkownika)
  │
  ▼
5. generate (adapter dostawcy; polling przez step.sleep lub webhook przez step.waitForEvent)
  │
  ▼
6. post-process (Vercel: sharp/atlas/zip; Modal worker: rig/blender/ffmpeg/kwantyzacja)
  │
  ▼
7. upload do R2 + rekordy assets/asset_files (+ miniatura/preview)
  │
  ▼
8. finalize: charge credits (faktyczne), provider_cost_usd, status=completed
   (błąd na dowolnym kroku → status=failed, zwrot rezerwacji, komunikat dla użytkownika)
```

### 8.1 Statusy joba i to, co widzi użytkownik

`queued` → `moderating` → `translating` → `generating` (progress 0–100 jeśli dostawca raportuje) → `post_processing` → `uploading` → `completed` | `failed` | `rejected` | `cancelled`.

UI pokazuje etykiety: „Queued”, „Checking prompt”, „Preparing”, „Generating…”, „Finishing up”, „Done”, „Failed”, „Rejected by content policy”. Krok tłumaczenia jest komunikowany jedynie jako „Preparing” — użytkownik nie widzi przetłumaczonego promptu.

### 8.2 Współbieżność i limity

- Limit współbieżności per workspace wg planu — brak planu/trial: 1, Pro: 2, Studio: 5. Implementacja: funkcja Inngest ma statyczny `concurrency: { key: event.data.workspace_id, limit: 5 }` i przed startem czeka (`step.sleep 30s`, max 60 min), dopóki liczba aktywnych jobów workspace'u ≥ limit planu; scheduler inline (§14.1) stosuje ten sam limit w pętli FIFO.
- Limit zadań w kolejce per workspace: 20.
- Timeout oczekiwania na dostawcę (`submitAndWait`): 3D 30 min (Rodin typowo 2–4 min, TRELLIS ~30 s wg statystyk fal), SFX 10 min na wariant, muzyka 15 min, głos 5 min na kwestię.
- Anulowanie: użytkownik może anulować job w `queued`/`moderating`/`translating` (pełny zwrot) i w `generating` (zwrot, jeśli dostawca nie naliczył — w praktyce: zwrot kredytów przy anulowaniu tylko przed wysłaniem żądania do dostawcy; po wysłaniu anulowanie = przerwanie oczekiwania, kredyty pobrane).

### 8.3 Warstwa tłumaczenia promptu (niewidoczna)

**Cel**: użytkownik pisze naturalnie (po angielsku, po polsku, byle jak). Wyspecjalizowany model generujący (Rodin, Lyria, ElevenLabs…) najlepiej rozumie konkretną formę promptu. LLM-tłumacz przekłada wejście użytkownika na tę formę **bez zmiany treści**.

**Drugie zadanie tłumacza — parametry spoza UI (od 2026-09-23, wersja `1.1.0`).** Użytkownik ustawia ręcznie **wyłącznie** parametry widoczne w formularzu. Pozostałe parametry modelu fal.ai, które zależą od treści zamówienia (np. `TAPose`, `texture_delight`, `bbox_condition` Rodina, siła prowadzenia TRELLIS-a, głos TTS), ustawia tłumacz — na podstawie promptu, style guide'u i ręcznych ustawień użytkownika — i zwraca je w `model_params`. Lista tych parametrów per model (klucz, opis dla LLM, JSON Schema) jest w `lib/ai/falModels.ts` (§9.7) i trafia do tłumacza jako `model_params_spec`. Ustawienia ręczne są nakładane **po** `model_params`, więc LLM nigdy nie nadpisze wyboru użytkownika; każda wartość z `model_params` jest ponownie walidowana (zod) — brak, `null` albo wartość niepoprawna = parametr pominięty = domyślna wartość dostawcy.

**Stan (2026-09-23): LLM tłumacza nie jest podłączony** (`OPENAI_API_KEY` pusty) — działa ścieżka mock: prompt = prompt użytkownika + pola style guide'u (`art_style`, `perspective`, `mood`, `style_notes`) złączone przecinkami (puste pomijane), `model_params = {}`. Kontrakt (wejście, wyjście, JSON Schema, reguły 8+) jest już gotowy, więc podłączenie sprowadza się do wpisania klucza i weryfikacji ID modelu.

**Model**: OpenAI, `PROMPT_TRANSLATOR_MODEL` (domyślnie `gpt-5.6-luna`), `temperature` niska (0–0.2), odpowiedź w JSON (structured output).

**Wejście do tłumacza**: `{ asset_type, target_model, user_prompt, project_style_guide, params, model_params_spec }` — `target_model` to dokładny endpoint fal (`falModelFor`, §9.7), `params` to ręczne ustawienia z formularza, `model_params_spec` to lista `{ key, description, schema }` parametrów do ustawienia. Dodatkowo `translator_notes` (np. limit długości promptu) doklejane do system promptu.

**Wyjście** (zależne od `target_model`, przykład dla obrazu):
```json
{
  "prompt": "…",                  // prompt pozytywny w języku angielskim, sformułowany pod dany model
  "negative_prompt": "…",         // tylko jeśli model wspiera; inaczej null
  "notes_dropped": [],            // MUSI być puste — jeśli tłumacz nie potrafił czegoś przenieść, job kończy się błędem, nie generujemy „po swojemu”
  "model_params": { "TAPose": true, "texture_delight": null }  // wszystkie klucze z model_params_spec; null = domyślna wartość dostawcy
}
```

`prompt` może być pusty (image-to-3D bez opisu — Rodin sam opisuje zdjęcia). JSON Schema structured output budowana dynamicznie (`buildJsonSchema(spec)`): `model_params` ma `additionalProperties: false`, wszystkie klucze w `required`, każdy jako `anyOf: [schemat, {type: "null"}]` (wymóg trybu strict OpenAI).

**System prompt (kanoniczna treść, wersjonowana w `lib/ai/translator.ts`, `TRANSLATOR_PROMPT_VERSION`)**:

> You are a prompt translator between a game developer and a specialized generative model (`{target_model}`, producing `{asset_type}`).
> Your ONLY job is to restate the user's request in the form this model understands best (English, model-appropriate phrasing, ordering and keywords).
> Rules:
> 1. Preserve every piece of information the user provided (subject, style, colors, perspective, mood, size, technical constraints). Do not omit anything.
> 2. Do NOT add anything the user did not ask for: no new objects, no extra style words, no "high quality, 8k, masterpiece" filler, no assumptions about background, lighting or details unless the user or the project style guide stated them.
> 3. The project style guide below was written by the user and counts as user-provided information; merge it with the request, resolving conflicts in favor of the request.
> 4. If the input is in a language other than English, translate it faithfully.
> 5. Convert only the *form*: e.g. "przezroczyste tło" → "transparent background", "make it tiny" → the size parameter, "pixelowy" → "pixel art".
> 6. If the model does not support a negative prompt, fold necessary exclusions into the positive phrasing only if the user asked for exclusions; otherwise leave them out.
> 7. Output strictly the JSON schema provided. `notes_dropped` must be empty; if you cannot preserve some information, put it there instead of inventing.
>
> Reguły doklejane warunkowo i numerowane dalej od 8 (`buildSystemPrompt`):
> - TTS (`mode = params_only`): "This is text-to-speech: the spoken text is the asset itself and is NOT part of your output. Translate only the delivery direction (emotion, pacing, character) into the `prompt` field."
> - gdy `model_params_spec` niepuste: "`model_params`: choose a value for every parameter listed in `model_params_spec` — the user cannot set these in the interface. Base each choice on the user's request, the project style guide and the user's manual settings in `params`; the manual settings are fixed and must never be contradicted. Use null when nothing in the request gives a reason to deviate from the model default."
> - gdy są `translator_notes`: "Model notes: {translator_notes}".

Tłumaczenie jest zapisywane w `jobs.translated_prompt` (widoczne wyłącznie w panelu admina — do debugowania i kalibracji), a oryginalny prompt użytkownika w `jobs.input.prompt` i na karcie assetu.

### 8.4 Adaptery dostawców (`lib/ai/providers/*`)

Wspólny interfejs:
```ts
interface ProviderAdapter<In, Out> {
  id: 'fal' | 'openai' | 'worker' | 'mock';
  submit(input: In): Promise<{ providerJobId: string } | { result: Out }>; // sync lub async
  poll?(providerJobId: string): Promise<{ status: 'pending'|'done'|'error'; progress?: number; result?: Out; error?: string }>;
  estimateCostUsd(input: In): number;      // do provider_cost_usd i kalibracji
}
```
Adapter fal.ai (`lib/ai/providers/fal.ts`) to fabryka `falEndpoint(endpointId)` na oficjalnym kliencie `@fal-ai/client` (`createFalClient({ credentials: FAL_KEY })`), zgodnie z sekcją „Queue” dokumentacji fal: `submit` = `queue.submit(endpoint, { input })` → `request_id` (zapisywany jako `jobs.provider_job_id`), `poll` = `queue.status(endpoint, { requestId })` (`IN_QUEUE` → progress 5, `IN_PROGRESS` → 50) i po `COMPLETED` `queue.result(...)` → `{ requestId, data }`. Adapter jest związany z endpointem, więc nie trzyma stanu w pamięci — wznowiony run dalej odpytuje po samym `request_id`. Błędy sieci, 429 i 5xx w pollingu = „pending” (ponowienie w następnym cyklu, do timeoutu); inne błędy `ApiError` → `ProviderError` z treścią odpowiedzi fal (np. 403 „Exhausted balance”, 422 walidacji); treść z `content_policy`/`nsfw`/`safety` → kod `provider_policy` (§12). `uploadToFal(buf, mime)` = `storage.upload(Blob)` — zdjęcia wejściowe trafiają do storage fal, bo nasze presigned URL-e na lokalnym sterowniku wskazują `localhost` (§9.7). Webhook fal nie jest przekazywany — pipeline odpytuje kolejkę.

**Wybór modelu**: endpoint wybiera kod (`falModelFor(type, input)` w `lib/ai/falModels.ts`, §9.7), nie baza. `model_pricing.provider_model` dokumentuje wiersz cennika; dokładny endpoint joba (np. Rodin text- vs image-to-3D) trafia do `jobs.provider_model` przy wycenie (`estimateJob`).

---

## 9. Pipeline'y per typ assetu

### 9.0 Generatory wycofane (2026-09-22)

Sekcje **§9.1 Grafika 2D (`image`)** i **§9.2 Animacje 2D — sprite sheety (`sprite_animation`)** zostały **usunięte z produktu**. Numeracja pozostałych sekcji jest zachowana, żeby odsyłacze w tym dokumencie i komentarze w kodzie pozostały aktualne.

Co dokładnie zniknęło:

| Warstwa | Zmiana |
|---|---|
| `ASSET_TYPES` (`lib/validation/jobs.ts`) | `["model_3d", "audio_sfx", "audio_music", "audio_voice"]` — bez `image` i `sprite_animation` |
| Schematy wejścia | usunięte `imageInputSchema`, `spriteAnimationInputSchema` oraz stałe `IMAGE_CATEGORIES`, `IMAGE_SIZES`, `IMAGE_QUALITIES`, `PALETTE_SIZES`, `MOTION_CLIPS` i funkcja `defaultTransparent` |
| Pipeline'y | skasowane pliki `lib/pipelines/image.ts` i `lib/pipelines/spriteAnimation.ts`; `runGenerationJob` nie ma już dla nich `case` |
| Wycena | usunięte gałęzie `image` i `sprite_animation` w `lib/credits/pricing.ts` |
| Feature flags | usunięte `pipeline.image.enabled` i `pipeline.sprite_animation.enabled` (zostają 4 wpisy `pipeline.*`) |
| `model_pricing` | usunięte wiersze `image.standard`, `image.hq`, `image.reference`, `image.background_removal`, `image.size_2048_multiplier`, `sprite.clip_first`, `sprite.clip_additional` |
| UI | usunięte formularze `ImageForm` / `AnimationForm`, pozycje „Image" i „Animation" w sidebarze i na dashboardzie, kafelki „2D graphics" i „2D animations" na stronie marketingowej, przycisk „Animate this" na stronie assetu; `/app/generate` przekierowuje teraz na `/app/generate/model_3d` |
| Trasy | `/app/generate/image` i `/app/generate/sprite_animation` zwracają **404** (`ASSET_TYPES` nie zawiera tych wartości) |

**Czego celowo NIE usunięto:**

- Wartości `image` i `sprite_animation` w **enumie `asset_type`** w Postgresie. Postgres nie pozwala usunąć wartości enuma używanej przez kolumnę (`jobs.type`, `assets.type`, `model_pricing.pipeline`), a stare assety mają pozostać czytelne. Zabezpieczenie jest w kodzie: `runGenerationJob` kończy job o wycofanym typie błędem `pipeline_removed`, a `POST /api/jobs` odrzuca taki typ już na poziomie `createJobSchema`.
- Kodu **odczytu** starych assetów: podgląd (`asset-preview.tsx`), ikony w bibliotece, presety eksportu (`enginePresets.ts`) i pobieranie plików nadal obsługują `image` / `sprite_animation`, żeby wcześniej wygenerowane assety dało się oglądać i pobierać.
- Możliwości użycia starego assetu `image` jako **zdjęcia wejściowego do 3D** (`resolveImageInput` nadal akceptuje `asset.type === 'image'`).

> W momencie zmiany baza była pusta (0 wierszy w `jobs` i `assets`), więc żadne dane nie ucierpiały.

### 9.1 Grafika 2D (`image`) — USUNIĘTE

Patrz §9.0. Sekcja nie jest już częścią produktu.

### 9.2 Animacje 2D — sprite sheety (`sprite_animation`) — USUNIĘTE

Patrz §9.0. Sekcja nie jest już częścią produktu. Worker Modal nie potrzebuje już endpointu Animated Drawings ani biblioteki klipów BVH (§14.2).

### 9.3 Modele 3D i postacie 3D (`model_3d`)

Jedyny generator wizualny w produkcie.

**Wejście — prompt i/lub zdjęcia (zmiana 2026-09-22).** Nie ma już przełącznika trybu `text_to_3d` / `image_to_3d`. Formularz ma **zawsze** pole promptu **oraz** możliwość dołączenia zdjęć; wystarczy jedno z dwóch, można podać oba naraz (wtedy prompt kieruje wynikiem). Tryb jest **wyliczany**, nie wybierany:

```ts
model3dMode(input) = input.images.length > 0 ? "image_to_3d" : "text_to_3d"
```

Schemat (`model3dInputSchema`) wymusza `prompt.length > 0 || images.length > 0` przez `.refine()` z komunikatem „Describe the model, attach a photo, or both".

**Limit zdjęć zależny od planu.** Twardy limit w schemacie to `MODEL_MAX_INPUT_IMAGES = 3`, limit efektywny to `PLANS[plan].maxInputImages` (§11.3):

| Plan | Maks. zdjęć na jeden job |
|---|---|
| Free (`none`) | 1 |
| **Trial** | **1** |
| Pro | 3 |
| Studio | 3 |

Przekroczenie limitu planu → `estimateJob` rzuca `plan_limit` (HTTP 403) z komunikatem „Attaching more than one photo requires the Pro or Studio plan". UI (`MultiReferencePicker`) blokuje dodanie kolejnego zdjęcia po osiągnięciu limitu i pokazuje licznik „n / max photos".

**Parametry UI** (kolejność w formularzu):

1. **Prompt** (textarea, ≤ 1500 znaków)
2. **Photos (optional)** — `MultiReferencePicker`: referencje projektu lub upload (PNG/JPG/WebP), miniatury z przyciskiem usunięcia, licznik, multi-upload gdy limit > 1
3. **Engine** — wybór silnika (patrz niżej)
4. **Quality** (`fast` / `standard` / `high`), **Polycount** (1k / 5k / 20k / 100k), **Topology** (`triangle` / `quad`), **Texture resolution** (1K / 2K / 4K — 4K tylko Studio)
5. **Real-world size (m)** — domyślnie 1 m
6. **PBR textures** (on/off)
7. **Auto-rig (humanoid)** + lista klipów animacji (`RIG_ANIMATIONS`: idle, walk, run, jump, attack, death) — podpowiedź: „Rigging & animation clips are coming soon — for now Rodin models the character in a T/A-pose, ready to rig, and the rig isn't charged.”

**Ograniczenia TRELLIS-a w formularzu** (`Model3dForm`, 2026-09-23): przy `engine = trellis` pole zdjęć ma etykietę „Photo (required)”, limit = **1** (`MultiReferencePicker max=1` z `limitNote="TRELLIS uses a single photo"` — licznik „1 / 1 photo — TRELLIS uses a single photo” zamiast podpowiedzi o planach Pro/Studio, ten sam tekst w toaście przy próbie dodania drugiego zdjęcia), podpowiedź „TRELLIS needs exactly one photo. The prompt is not sent to it — it only tunes the generation settings.”), opcje „Quads (Rodin only)” i „4K (Rodin only)” wyłączone, przełącznik „PBR textures” wyłączony z podpowiedzią „TRELLIS always bakes its own textures”. Przełączenie silnika na TRELLIS przycina zdjęcia do pierwszego, ustawia `topology = triangle` i zamienia 4K na 2K. Przycisk Generate jest aktywny tylko przy dokładnie jednym zdjęciu (`isReady`). Te same reguły wymusza schemat (`.refine()` w `model3dInputSchema`): `images.length === 1` („TRELLIS turns exactly one photo into 3D — attach one photo or switch to Rodin”), `topology === 'triangle'`, `texture_resolution !== '4K'`.

**Pole `Engine` (zastąpiło `Category`, 2026-09-22).** Dawne pole „Category" (`character` / `prop` / `weapon` / `vehicle` / `building` / `environment_piece`) zostało **usunięte razem ze stałą `MODEL_CATEGORIES`**. W jego miejscu jest selektor silnika:

| Wartość | Etykieta w UI | Podpis pod polem | Wiersz w `model_pricing` | Kredyty |
|---|---|---|---|---|
| `rodin` (domyślny) | Rodin Gen-2.5 | „Text and/or photos · higher quality, uses more of your credit limit" | `model3d.engine.rodin` | 45 |
| `trellis` | TRELLIS (Microsoft) | „Needs one photo · uses less of your credit limit" | `model3d.engine.trellis` | 25 |

> **Silniki podpięte do fal.ai (2026-09-23).** Rodin: `fal-ai/hyper3d/rodin/v2.5/text-to-3d` (bez zdjęć) lub `fal-ai/hyper3d/rodin/v2.5` (image-to-3D, **wszystkie** dołączone zdjęcia — do 3, model przyjmuje do 5); TRELLIS: `fal-ai/trellis` (dokładnie jedno zdjęcie, prompt nie jest wysyłany). Mapowanie parametrów, wyjścia i koszty — §9.7. Wiersze `model3d.engine.*` mają `provider = 'fal'`.

**Pole `art_style` usunięte (2026-09-22).** Nie ma go ani w formularzu, ani w `model3dInputSchema`, ani w wywołaniu modelu 3D — razem z nim zniknęła funkcja pomocnicza `mapArtStyle()`. Styl opisuje się słowami w promptcie; `style_guide.art_style` projektu nadal trafia do tłumacza promptu (§8.3) i tą drogą wpływa na wynik.

**Pozostałe skutki usunięcia kategorii:**

- `rig` nie jest ograniczony do kategorii `character` — przełącznik „Auto-rig (humanoid)" jest dostępny zawsze. **Stan 2026-09-23**: model rigowania/animacji na fal.ai nie jest jeszcze wybrany (§27 poz. 15), a Meshy został usunięty. Włączony `rig` wymusza w Rodinie `TAPose = true` (postać w pozie T/A, gotowa do rigowania); asset dostaje `metadata.rig_status = 'not_connected'`, `has_rig = false`, bez klipów animacji, a dodatki `model3d.rig_addon` / `model3d.animation_addon` (`provider = 'unbound'`) **nie są naliczane** w wycenie. TRELLIS nie ma opcji T/A-pose.
- `real_world_size_m` ma jedną wartość domyślną **1 m** (wcześniej 1.8 m dla `character`).
- Nazwa assetu: `3D — <pierwsze 40 znaków promptu>` albo `3D from N photo(s)`, gdy prompt jest pusty.

**Dostawcy** (stan faktyczny generacji, 2026-09-23): wyłącznie **fal.ai** (§9.7) — `generate3dOnFal(ctx, photos)` w `lib/pipelines/model3d.ts`:

1. `resolveImageInput` pobiera bajty każdego zdjęcia z naszego storage; `sharp` ustala format (MIME do uploadu) i czy obraz ma realną przezroczystość (`hasAlpha && !stats().isOpaque`),
2. każde zdjęcie → `uploadToFal` (storage fal; nasze presigned URL-e przy lokalnym sterowniku wskazują `localhost`),
3. `buildRodinInput` / `buildTrellisInput` (§9.7) → `submitAndWait` (poll co 10 s, timeout 30 min, progress 12→72 %),
4. z wyniku: `model_mesh` (GLB) → plik `glb main`; `textures[]` → `texture_png` (nazwa mapy z `file_name`: `diffuse`/`base_color`/`albedo` → `albedo`, reszta znormalizowana `[a-z0-9_]`, konwersja do PNG przez sharp, gdy trzeba); miniatura = obraz z `model_meshes[]` (preview render Rodina image-to-3D, `preview_render: true`), inaczej pierwsze zdjęcie, a przy text-to-3D placeholder z etykietą „3D”.

**Post-processing** (worker Modal, Blender headless):

- pobranie plików od dostawcy → normalizacja skali (`real_world_size_m`, domyślnie 1 m), origin na podłożu (pivot bottom-center), oś Y-up (GLB/GLTF)
- konwersje: GLB → GLTF (separate) → FBX (Unity: Y-up, m; Unreal: Z-up, cm — dwa warianty) → OBJ+MTL; tekstury wyodrębnione do PNG (`albedo`, `normal`, `roughness`, `metallic`, `ao`, jeśli obecne)
- rig i animacje: przeniesione w GLB/FBX (skeleton + clips), nazwy klipów zgodne z wyborem
- miniatura: render turntable (8 klatek) → PNG (front) + GIF; podgląd 3D w UI z pliku GLB (three.js)

**Wynik**: asset `type='model_3d'`, `metadata`: `mode` (wyliczony), `engine`, `model` (endpoint fal lub `mock`), `provider_params` (parametry faktycznie wysłane do fal — z UI i od LLM — bez URL-i zdjęć), `t_a_pose`, `seed` (zwrócony przez Rodina), `input_image_count`, `quality`, `target_polycount`, `topology`, `pbr`, `texture_resolution`, `tri_count` (mock), `has_rig` (obecnie zawsze `false`), `rig_status` (`'not_connected'` przy włączonym rig, inaczej `null`), `animations[]` (puste), `texture_maps[]`, `real_world_size_m`; pliki: `glb` (`main`), `gltf` + `bin` (`main`, rozdzielone z GLB przez `splitGlb`), `fbx` (variant / `engine_preset` `unity` i `unreal` — tylko z workerem Blender), `obj` + `mtl` (mock) lub `zip` variant `obj` (worker), `texture_png` (variant = nazwa mapy), `zip` (`all`).

**Tryb mock**: sześcian GLB o wymiarach z `real_world_size_m` (pivot bottom-center, Y-up) + OBJ/MTL; przy włączonym `rig` proporcje są smuklejsze (imitacja postaci). Miniatura to placeholder.

### 9.4 SFX (`audio_sfx`)

- Dostawca: **ElevenLabs Sound Effects v2 przez fal.ai** — `fal-ai/elevenlabs/sound-effects/v2` (§9.7); każdy wariant (`count`) to osobne zlecenie w kolejce fal (poll co 2 s, timeout 10 min).
- Parametry: prompt (≤ 450 znaków), `duration_s` (auto | 0.5–**10** s; model przyjmuje do 22 s), `loop` (on → prosimy o loopowalny dźwięk i dodatkowo robimy crossfade pętli w post-processingu), `prompt_influence` (0–1, domyślnie 0.3), `count` (1–4 warianty).
- **Maksymalny czas trwania to 10 s (zmiana 2026-09-22; wcześniej 30 s).** Wartość jest jedną stałą `SFX_MAX_DURATION_S = 10` w `lib/validation/jobs.ts`, z której korzystają jednocześnie: walidacja `sfxInputSchema` (`z.number().min(0.5).max(SFX_MAX_DURATION_S)`), atrybut `max` pola „Duration (s)" w formularzu, przycinanie wartości wpisanej ręcznie (`Math.min`) oraz podpowiedź pod polem („Empty = auto · max 10 s"). Wysłanie dłuższej wartości przez API kończy się `validation_error` (HTTP 400).
- Format od dostawcy: `output_format = pcm_44100` (16-bit, mono) — pipeline owija surowe PCM w WAV (`decodePcm16` → `encodeWav`); jeśli fal odda już WAV, jest dekodowany (`decodeWav`), a jeśli MP3 (`content_type`/`file_name`/nagłówek `ID3`) — przechodzi jako MP3. Dzięki PCM trim, normalizacja, crossfade pętli i waveform działają bez workera.
- Post-processing (w procesie; OGG/MP3 z workera ffmpeg, gdy skonfigurowany): normalizacja szczytowa do −1 dBFS, trim ciszy (start/koniec, próg −60 dB), WAV 16-bit 44.1 kHz mono/stereo (zachowane źródło), OGG Vorbis q5, MP3 192 kbps; dla `loop`: crossfade 30 ms na styku.
- Wynik: asset `type='audio_sfx'`, `metadata`: `duration_s`, `sample_rate`, `channels`, `loop`, `prompt_influence`, `variant`, `model`; pliki `wav` (+ `ogg`, `mp3` z workerem); waveform PNG jako miniatura.

### 9.5 Muzyka (`audio_music`)

- Dostawca: **Google Lyria 3 Pro przez fal.ai** — `fal-ai/lyria3/pro` (§9.7; pełne utwory do 3 min, MP3 44,1 kHz / 192 kbps, wokal lub instrumental, SynthID). **Selektor „Engine” usunięty (2026-09-23)** razem z polem `provider` w `musicInputSchema` (stare joby z tym polem nadal się parsują — zod pomija nieznany klucz); ElevenLabs Music i Stable Audio nie są już używane.
- Parametry UI: prompt (gatunek, tempo, instrumenty, nastrój — z `style_guide.audio_notes`), `duration_s` (15/30/60/120/180, podpowiedź „Approximate — Lyria composes to the requested length”), `instrumental` (domyślnie on), `loopable`, `bpm` (opcjonalne), `key` (opcjonalne).
- **Lyria przyjmuje tylko prompt** (bez parametru długości, bez negative prompt), więc pola formularza są doklejane do przetłumaczonego promptu jako stałe zdanie ograniczeń (`musicConstraints`, zawsze, deterministycznie): „Length: about {d} seconds.”, „Tempo: {bpm} BPM.”, „Key: {key}.”, „Instrumental only — no vocals, no lyrics.” (gdy `instrumental`), „Let the ending lead seamlessly back into the opening so the track can loop.” (gdy `loopable`). **Długość utworu jest przybliżona.** Tłumacz dostaje notatkę, by tych ograniczeń nie powtarzał.
- Post-processing: wersja `loop` = crossfade 500 ms (wymaga PCM — bez workera wariant `loop` to kopia MP3); z workerem loudness normalization do −14 LUFS (EBU R128, `loudnorm`), WAV 16-bit 44.1 kHz stereo, OGG q6, MP3 192 kbps.
- Wynik: asset `type='audio_music'`, `metadata`: `duration_s` (gdy znane PCM), `requested_duration_s`, `instrumental`, `loopable`, `bpm`, `key`, `lyrics` (tekst zwrócony przez Lyrię albo `null`), `model`; pliki `mp3` (bez workera) lub `wav`, `ogg`, `mp3` (+ warianty `loop`).

### 9.6 Głosy / TTS (`audio_voice`)

- Dostawca: **ElevenLabs TTS Turbo v2.5 przez fal.ai** — `fal-ai/elevenlabs/tts/turbo-v2.5` (§9.7); jedna kwestia = jedno zlecenie (poll co 1,5 s, timeout 5 min). **Select „Model” (Multilingual v2 / Expressive v3) usunięty 2026-09-23** razem z polem `model` w `voiceInputSchema` i wierszem cennika `voice.expressive.per_100_chars`.

**Katalog głosów usunięty (2026-09-22).** Formularz nie ma już listy głosów ani filtrów (płeć / wiek / akcent), nie ma też odtwarzacza próbek. Usunięte zostały:

| Element | Stan |
|---|---|
| Pole `voice_id` w `voiceInputSchema` | usunięte |
| Selektor głosów + filtry + `AudioPlayer` z podglądem w `VoiceForm` | usunięte |
| Endpoint `GET /api/voices` | usunięty (cały katalog `app/api/voices/`) |
| Tabela `voice_cache` | **usunięta z bazy** (`drop table`, migracja `20260922000012`) |
| Funkcja `refreshVoiceCache()` w `lib/maintenance.ts` | usunięta |
| Cron Inngest `refresh-voice-cache` (codziennie 04:00 UTC) | usunięty |
| Zadanie `voices` w `POST /api/admin/maintenance` | usunięte (zostają `retention`, `expire_credits`, `violations`) |
| Helper `listElevenVoices()` + typ `ElevenVoice` w adapterze ElevenLabs | usunięte |
| `style_guide.voice_defaults.voice_id` | usunięte (zostaje samo `language`) |

> **Głos wybiera LLM tłumacza (2026-09-23).** Endpoint przyjmuje nazwę głosu z 21 presetów ElevenLabs (`TTS_VOICES` w `lib/ai/falModels.ts`, każdy z opisem płci/wieku/akcentu/barwy dla LLM): Rachel (domyślny), Aria, Sarah, Laura, Charlotte, Alice, Matilda, Jessica, Lily, River, Roger, Charlie, George, Callum, Liam, Will, Eric, Chris, Brian, Daniel, Bill. Użytkownik nie wybiera głosu — opisuje go w polu `Instructions`, a tłumacz ustawia `model_params.voice`. Dopóki LLM nie jest podłączony, używany jest głos domyślny dostawcy **Rachel** (`TTS_DEFAULT_VOICE`; to ten sam głos co dawny `DEFAULT_TTS_VOICE_ID = 21m00Tcm4TlvDq8ikWAM`, który usunięto), więc `Instructions` do tego czasu nie wpływają na brzmienie.

**Pole `Instructions` (obowiązkowe, 2026-09-22).** Dawne pole „Delivery direction (optional)" (`direction`) zostało przemianowane na **`Instructions`** i jest **wymagane**:

- schemat: `instructions: z.string().trim().min(1).max(300)` — bez `.optional()`, bez `.nullable()`; puste pole to `validation_error` (HTTP 400),
- UI: `Field label="Instructions"` z podpowiedzią „Required. Voice, emotion, pacing, character — translated for the model; the spoken text is never changed", placeholder „tired old wizard, slow and raspy, deep male voice",
- przycisk **Generate** jest nieaktywny, dopóki `text` **i** `instructions` nie są wypełnione (`isReady` w `generator.tsx`),
- treść `instructions` trafia do moderacji razem z tekstem kwestii (`moderationTextFor`) oraz do tłumacza promptu w trybie `params_only`,
- zapisywana jest w `assets.metadata.instructions` (obok przetłumaczonej wersji w `metadata.direction`).

**Pole `Language` — lista wyboru (2026-09-22).** Dawne wolne pole tekstowe (wpisywało się np. `en`) zastąpił **select** ze wszystkimi głównymi językami. Lista jest jednym źródłem prawdy — stała `VOICE_LANGUAGES` w `lib/validation/jobs.ts` (kod ISO + etykieta), z której powstaje zarówno `z.enum(VOICE_LANGUAGE_CODES)` w schemacie, jak i opcje selecta:

`en` English · `es` Spanish · `fr` French · `de` German · `it` Italian · `pt` Portuguese · `pl` Polish · `nl` Dutch · `sv` Swedish · `da` Danish · `fi` Finnish · `no` Norwegian · `cs` Czech · `sk` Slovak · `hu` Hungarian · `ro` Romanian · `bg` Bulgarian · `hr` Croatian · `el` Greek · `tr` Turkish · `uk` Ukrainian · `ru` Russian · `ar` Arabic · `hi` Hindi · `ta` Tamil · `zh` Chinese · `ja` Japanese · `ko` Korean · `id` Indonesian · `ms` Malay · `fil` Filipino · `vi` Vietnamese

(32 pozycje = dokładnie 32 języki ElevenLabs Turbo v2.5; wysyłane jako `language_code`). Domyślnie `en`, chyba że projekt ma `style_guide.voice_defaults.language`. Kod spoza listy jest odrzucany przez `z.enum`.

**Pozostałe parametry**: tekst (≤ 5000 znaków; wiele linii = wiele kwestii → batch: każda linia osobny plik + ZIP), `stability`, `similarity_boost`, `style` (0–1) i `speed` — **zakres 0.7–1.2** (`VOICE_SPEED_MIN/MAX`, zakres modelu Turbo v2.5; wcześniej 0.5–2), wszystkie przekazywane do modelu bez zmian.

- W tym pipeline'ie tłumacz promptu **nie zmienia tekstu kwestii** (tekst jest treścią assetu) — tłumaczy jedynie `instructions`. Zapis w SPEC: `translator.mode = 'params_only'` dla TTS.
- Post-processing: trim ciszy, normalizacja −3 dBFS peak, WAV 16-bit 44.1 kHz mono, OGG, MP3.
- Wynik: asset `type='audio_voice'`; pliki `mp3` (bez workera) lub `wav`, `ogg`, `mp3` (z workerem), `zip` (batch), `metadata.lines[]`, `metadata.instructions`, `metadata.direction` (przetłumaczone instrukcje), `metadata.language`, `metadata.voice` (nazwa głosu), `metadata.model`.

### 9.7 Modele fal.ai — rejestr, parametry, wyjścia (2026-09-23)

Wszystkie modele generujące działają na **fal.ai** przez jeden klucz `FAL_KEY` (`.env.local`) i klienta `@fal-ai/client` (§8.4). Źródło prawdy o parametrach i wyjściach: publiczne schematy OpenAPI `https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=<endpoint>` (te same, które pokazuje dokumentacja modelu na fal.ai: sekcje „Calling the API”, „Queue”, „Files”, „Schema”). Dokumentacja fal podaje `npm install --save @fal-ai/client` i `export FAL_KEY=…` — w projekcie pakiet jest w `package.json` (instalacja `pnpm add @fal-ai/client`), a klucz czyta `lib/env.ts` z `.env.local` (nigdy `NEXT_PUBLIC_`).

**Rejestr** `lib/ai/falModels.ts` (czysty moduł, bez `server-only`, testowany w `tests/falModels.test.ts`):

| Stała `FAL_MODELS` | Endpoint | Kiedy |
|---|---|---|
| `rodinText` | `fal-ai/hyper3d/rodin/v2.5/text-to-3d` | 3D, silnik `rodin`, bez zdjęć |
| `rodinImage` | `fal-ai/hyper3d/rodin/v2.5` | 3D, silnik `rodin`, 1–3 zdjęcia |
| `trellis` | `fal-ai/trellis` | 3D, silnik `trellis` (dokładnie 1 zdjęcie) |
| `sfx` | `fal-ai/elevenlabs/sound-effects/v2` | `audio_sfx` |
| `music` | `fal-ai/lyria3/pro` | `audio_music` |
| `tts` | `fal-ai/elevenlabs/tts/turbo-v2.5` | `audio_voice` |

`falModelFor(type, input)` → `{ endpoint, llmParams, translatorNotes }` — używane przez wycenę (`jobs.provider_model`), `run.ts` (tłumacz dostaje `target_model`, `model_params_spec = llmParamsForTranslator(spec)` i `translator_notes`) i pipeline'y. **Każdy parametr modelu ma jedno z trzech źródeł:**

1. **UI** — ręczne ustawienia z formularza, mapowane deterministycznie w `build*Input` i nakładane jako ostatnie (wygrywają z LLM).
2. **LLM** — parametry, których nie ma w UI; ustawia je tłumacz (§8.3) w `model_params`. `resolveLlmParams(spec, model_params)` przepuszcza tylko klucze z listy modelu z wartością poprawną wg zod; reszta jest pomijana → wartość domyślna dostawcy (tak działa wszystko, dopóki LLM nie jest podłączony).
3. **Stałe** — wymagania techniczne pipeline'u (formaty plików, URL-e zdjęć, podgląd); nie zależą od treści zamówienia, więc nie są oddawane LLM.

**Rodin Gen-2.5** (`buildRodinInput`) — koszt 0,40 USD / generacja:

| Źródło | Parametr fal | Wartość |
|---|---|---|
| UI | `prompt` | przetłumaczony prompt, obcięty do **1024** znaków (limit modelu; w image-to-3D może być pusty) |
| UI | `tier` | `quality`: `fast` → `Gen-2.5-Low`, `standard` → `Gen-2.5-Medium`, `high` → `Gen-2.5-High` |
| UI | `quality_mesh_option` | najbliższa opcja do `target_polycount` w danej topologii (remis → lżejsza). Triangle: 1k/5k → `2K Triangle`, 20k → `20K Triangle`, 100k → `50K Triangle`; Quad: 1k/5k → `4K Quad`, 20k → `18K Quad`, 100k → `100K Quad`. Tiery High przyjmują ≥ 20K trójkątów, więc `high` + `2K Triangle` obniża tier do `Gen-2.5-Medium` (budżet poly wygrywa) |
| UI | `material` | `pbr` on → `PBR`, off → `Shaded` |
| UI | `hd_texture` | `quality === 'high'` |
| UI | `addons` | `{ high_pack: true }` gdy `texture_resolution === '4K'` (tekstury 4K). 1K i 2K → domyślne 2K dostawcy (Rodin nie ma opcji 1K — §27 poz. 19) |
| UI | `TAPose` | `true`, gdy włączony `rig` (nadpisuje LLM) |
| UI | `image_urls` | wszystkie zdjęcia (do 3; model przyjmuje 5) po `uploadToFal` — tylko image-to-3D |
| LLM | `TAPose` | postać humanoidalna do rigowania w neutralnej pozie T/A |
| LLM | `enable_creative_mode` | prośba o stylizowaną / swobodną interpretację |
| LLM | `texture_delight` | usunięcie wypalonego światła z tekstur (asset oświetlany przez silnik) vs styl ręcznie malowany |
| LLM | `texture_mode` | `legacy` / `extreme-low` / `low` / `medium` / `high` — zgodnie z Quality, `null` = wybór dostawcy per tier |
| LLM | `bbox_condition` | proporcje `{ width, height, length }` (liczby całkowite 1–2048) tylko, gdy użytkownik je podał |
| Stałe | `geometry_file_format` | `glb` |
| Stałe | `use_original_alpha` | image-to-3D: `true`, gdy któreś zdjęcie ma realną przezroczystość (sharp) |
| Stałe | `preview_render` | image-to-3D: `true` (miniatura assetu) |
| — | `seed`, `is_micro` | nie wysyłane (losowy seed; `is_micro` działa tylko z tierem Extreme-High, którego nie używamy) |

Wyjście: `model_mesh` (GLB), `textures[]` (obrazy map), `model_meshes[]` (dodatkowe pliki, w tym render podglądu), `seed`.

**TRELLIS** (`buildTrellisInput`) — 0,02 USD / generacja:

| Źródło | Parametr fal | Wartość |
|---|---|---|
| UI | `image_url` | jedyne zdjęcie po `uploadToFal` (prompt nie jest wysyłany) |
| UI | `ss_sampling_steps`, `slat_sampling_steps` | `quality`: `fast` → 12 (domyślne), `standard` → 20, `high` → 30 |
| UI | `mesh_simplify` | `target_polycount`: 1k → 0.98, 5k → 0.97, 20k → 0.95 (domyślne), 100k → 0.90 |
| UI | `texture_size` | `1K` → 1024, `2K` → 2048 (4K zablokowane) |
| LLM | `ss_guidance_strength` | 0–10 (domyślnie 7,5): wierność kształtu względem zdjęcia |
| LLM | `slat_guidance_strength` | 0–10 (domyślnie 3): wierność detalu/tekstury |
| — | `seed` | nie wysyłany |

Wyjście: `model_mesh` (GLB z teksturą), `timings`. Miniatura = zdjęcie wejściowe.

**ElevenLabs Sound Effects v2** (`buildSfxInput`) — 0,002 USD / s: UI → `text` (prompt ≤ 450), `duration_seconds` (pomijane przy „auto”), `loop`, `prompt_influence`; stałe → `output_format = pcm_44100` (`SFX_SAMPLE_RATE = 44100`). LLM: brak parametrów. Wyjście: `audio` (plik).

**Lyria 3 Pro** (`buildMusicInput`) — 0,08 USD / utwór: `prompt` = przetłumaczony prompt + `musicConstraints(ui)` (≤ 5000 znaków łącznie). Nie wysyłamy `negative_prompt` (niewspierany) ani `image_url` (formularz muzyki nie ma obrazu). LLM: brak parametrów. Wyjście: `audio` (MP3), `lyrics`.

**ElevenLabs TTS Turbo v2.5** (`buildTtsInput`) — 0,05 USD / 1000 znaków: UI → `text` (jedna kwestia, bez zmian), `language_code`, `stability`, `similarity_boost`, `style`, `speed` (przycięte do 0.7–1.2); LLM → `voice` (jeden z 21 presetów, §9.6), `apply_text_normalization` (`auto`/`on`/`off` — liczby, daty, skróty); nie wysyłamy `timestamps`, `previous_text`, `next_text` (każda kwestia to samodzielny plik). Wyjście: `audio` (MP3).

**Koszt dostawcy** joba (`jobs.provider_cost_usd`) liczy `estimateFalCostUsd(endpoint, input)` wg cen z listy fal (sprawdzone 2026-09-23 przez `get_pricing`): Rodin 0,40, TRELLIS 0,02, SFX 0,002 × `duration_seconds` (5 s przy „auto”), Lyria 0,08, TTS 0,05 × znaki / 1000.

**Stan weryfikacji (2026-09-23):** typecheck, lint i testy jednostkowe (mapowanie UI → parametry, pierwszeństwo UI nad LLM, odrzucanie błędnych wartości LLM, routing endpointów, reguły TRELLIS, kontrakt tłumacza) przechodzą. Test na żywo wywołuje prawdziwe funkcje pipeline'ów (`runSfxPipeline`, `runVoicePipeline`, `runMusicPipeline`, `runModel3dPipeline`, `generate3dOnFal` ze zdjęciem) i dochodzi do `queue.submit` — fal odpowiada `403 User is locked. Reason: Exhausted balance`, więc **pełna generacja czeka na doładowanie konta fal.ai** (§0.3 pkt 9, §27 poz. 16).

## 10. Post-processing, formaty i presety eksportu do silników

### 10.1 Usuwanie tła
- Model `fal-ai/birefnet` (lub rembg) → maska → PNG RGBA. Następnie `sharp.trim()` z tolerancją alfa 8, opcjonalny `pad_to_pow2` (256/512/1024) z wyśrodkowaniem i zachowaniem `pivot` w metadanych (`metadata.pivot = { x, y }` znormalizowany 0–1, domyślnie bottom-center dla sprite/character, center dla icon/ui).

### 10.2 Pixel-art pipeline (lokalnie, bez kosztów dostawcy)
1. Generacja w rozdzielczości ≥ 512 (model daje „pixel-art-like”, ale z antyaliasingiem).
2. Downscale do `pixel_grid` (dłuższy bok) metodą `nearest` po wcześniejszym lekkim `median` (usuwa szum), alternatywnie `box`.
3. Kwantyzacja palety: jeśli `palette_locked` → mapowanie do palety projektu (najbliższy kolor w przestrzeni Lab); w przeciwnym razie median-cut do `palette_size` kolorów; alfa binaryzowana (próg 128) — brak półprzezroczystości.
4. Zapis: PNG 1× (właściwy asset), PNG 4× nearest (podgląd w UI, nie w eksporcie domyślnym), zapis użytej palety w `metadata.palette[]` (dla spójności kolejnych generacji w projekcie — jeśli projekt nie ma palety, proponujemy „Save as project palette”).

### 10.3 Sprite sheet i atlasy
- Packer siatkowy: klatki tej samej wielkości, kolumny = `min(frames, floor(4096 / frame_w))`, padding 2 px, bez rotacji, bez trim (dla stabilnego pivota) — opcja `trim: true` z zapisem `spriteSourceSize` w atlasie.
- **JSON (TexturePacker „hash”)**: `frames: { "walk_000": { frame, rotated:false, trimmed, spriteSourceSize, sourceSize, pivot } }`, `meta: { image, size, scale, app: "Veyraflow", version }`, dodatkowo `animations: { "walk": ["walk_000", …] }` i `fps` per klip.
- **Godot**: plik `.tres` typu `SpriteFrames` z animacjami (nazwa, fps, loop, `AtlasTexture` region per klatka) + `import` hint (Texture: Filter Nearest dla pixel art) — instrukcja w panelu pobierania.
- **Unity**: sprite sheet PNG + JSON hash (import przez darmowe narzędzia typu TexturePacker Importer lub własny edytor-script; w ZIP dołączamy `README_UNITY.md` z krokami: Texture Type=Sprite, Sprite Mode=Multiple, Pixels Per Unit = pixel_grid, Filter Mode=Point dla pixel art). Roadmapa: generowanie `.meta` ze sprite'ami pociętymi.
- **Unreal**: sprite sheet PNG + JSON (Paper2D: import przez „Paper2D Sprite Sheet” z pliku JSON w formacie TexturePacker — właśnie dlatego trzymamy format hash) + `README_UNREAL.md`.
- GIF podgląd: worker (ffmpeg palettegen/paletteuse), 256 px.

### 10.4 Formaty 3D i presety
| Preset | Format główny | Osie / skala | Dodatki |
|---|---|---|---|
| Unity | FBX (+GLB) | Y-up, metry, skala 1 | tekstury PNG, `README_UNITY.md` (materiał URP/HDRP: mapy) |
| Unreal | FBX | Z-up, centymetry (×100) | tekstury PNG, `README_UNREAL.md` (Import Uniform Scale=1, tekstury normal → flip green wg potrzeby — flaga `normal_map_convention: 'opengl' | 'directx'`, generujemy obie) |
| Godot | GLB | Y-up, metry | `README_GODOT.md` (import scene, materiały wbudowane) |
| Generic | GLB, GLTF, OBJ+MTL | Y-up, metry | ZIP wszystkiego |

### 10.5 Formaty audio i presety
| Preset | Formaty | Uwagi |
|---|---|---|
| Unity | WAV (16-bit 44.1 kHz), OGG | `README`: Load Type (Decompress on Load dla SFX, Streaming dla muzyki) |
| Unreal | WAV 16-bit 44.1 kHz | UE importuje tylko WAV; OGG i MP3 pomijane w ZIP presetu |
| Godot | OGG, WAV | `README`: loop flags w imporcie |
| Generic | WAV, OGG, MP3 | |

### 10.6 Pobieranie
- Pojedynczy plik: `GET /api/assets/:id/download?file=:fileId` → presigned URL R2 (TTL 15 min, `Content-Disposition: attachment; filename="<slug>_<variant>.<ext>"`).
- ZIP assetu / zaznaczonych assetów / całego projektu z wybranym presetem silnika: `POST /api/downloads` → job Inngest `download/zip.requested` → streamowany archiver na Vercel (≤ 200 MB łącznie) lub worker (większe) → plik ZIP w R2 (`downloads/…`, TTL 24 h, sprzątany) → link + powiadomienie w UI (toast + wpis w „Downloads”).
- Struktura ZIP projektu: `/<project-slug>/<asset-type>/<asset-slug>/<pliki>` + `MANIFEST.json` (lista assetów, licencja, informacja o generacji AI, wersja).

---

## 11. Kredyty, plany, Stripe

### 11.1 Definicja kredytu

**1 kredyt = 0,01 USD orientacyjnego kosztu u dostawców (cost basis).** Ceny w tabeli kosztów odzwierciedlają realny koszt dostawcy (zaokrąglony w górę), a marża powstaje na cenie sprzedaży kredytów.

Trial za **1,29 USD netto** (cena przed VAT; VAT doliczany przez Stripe Tax) daje **86 kredytów** (0,86 USD kosztu dostawców) i ma wychodzić na ok. **+0,08 USD** po prowizjach Stripe. Wyliczenie (wszystkie ceny w Stripe: `tax_behavior: exclusive`):

| Scenariusz | Prowizja Stripe | Wynik |
|---|---|---|
| bez VAT, karta spoza UE (2,9 % + 0,30 USD) | 0,337 USD | **+0,093 USD** |
| VAT PL 23 % doliczony, prowizja od kwoty brutto | 0,346 USD | **+0,084 USD** |
| karta UE (1,5 % + ~0,27 USD), bez VAT | 0,289 USD | **+0,141 USD** |

Liczba kredytów triala jest stałą `TRIAL_CREDITS = 86` w konfiguracji planów (i w metadata ceny Stripe) — do korekty, jeśli zmienią się prowizje lub koszty dostawców.

Kalibracja: rzeczywisty koszt każdego joba trafia do `jobs.provider_cost_usd`; panel admina pokazuje „kredyty pobrane vs koszt realny” per pipeline i pozwala edytować `model_pricing.credits`.

### 11.2 Tabela kosztów (wartości startowe, edytowalne w `model_pricing`)

| Pipeline / operacja | Kredyty | Uwagi |
|---|---|---|
| 3D — silnik **Rodin Gen-2.5** (`model3d.engine.rodin`) | 45 | pozycja bazowa joba 3D; wyższa jakość |
| 3D — silnik **TRELLIS (Microsoft)** (`model3d.engine.trellis`) | 25 | pozycja bazowa joba 3D; tańsza |
| 3D High (tekstury HD / 4K) (`model3d.high_addon`) | +20 | **tylko Rodin**: przy `quality='high'` (`hd_texture`) lub `texture_resolution='4K'` (HighPack) |
| Auto-rig (`model3d.rig_addon`) | +15 | `provider = 'unbound'` (model fal.ai do wyboru) → **obecnie nie naliczane** |
| Animacja 3D — per klip (`model3d.animation_addon`) | +10 | jw. — nie naliczane, dopóki `unbound` |
| SFX — za wariant (`sfx.variant`) | 5 | ElevenLabs Sound Effects v2 (fal) |
| Muzyka Lyria 3 Pro 30 s / 60 s / 120 s / 180 s (`music.lyria3.{30,60,120,180}s`) | 35 / 60 / 110 / 150 | wg **żądanej** długości; 15 s liczone jak 30 s |
| TTS — per 100 znaków, min 3 (`voice.per_100_chars`) | 3 | ElevenLabs TTS Turbo v2.5 (fal); ~30 kredytów / 1000 znaków |

Koszt joba = suma pozycji × `count`. UI pokazuje **koszt przed uruchomieniem** („This will use 12 credits”) i saldo.

> **Zmiana 2026-09-22:** wiersze `image.*` i `sprite.*` zostały usunięte razem z generatorami (§9.0). Wiersze `model3d.fast`, `model3d.standard` i `model3d.image` zastąpiła para `model3d.engine.rodin` / `model3d.engine.trellis` — **pozycję bazową joba 3D wybiera teraz silnik, a nie `quality` ani tryb**. Liczba dołączonych zdjęć nie zmienia ceny (limituje ją plan, §9.3). W bazie jest po zmianie **13 wierszy** `model_pricing`.

> **Zmiana 2026-09-23 (migracja `20260923000013_fal_models.sql`):** wszystkie wiersze mają `provider = 'fal'` i endpoint fal w `provider_model` (poza `model3d.rig_addon` / `model3d.animation_addon` — `provider = 'unbound'`, `provider_model = 'fal-rigging-tbd'` / `'fal-animation-tbd'`; `estimateJob` nie nalicza dodatku, którego `provider = 'unbound'`). Usunięte: `music.eleven.{30,60,120,180}s`, `music.standard`, `voice.expressive.per_100_chars`; dodane: `music.lyria3.{30,60,120,180}s`. Kredyty bez zmian; `est_provider_cost_usd` = ceny fal (Rodin 0,40; TRELLIS 0,02; high addon 0 — brak osobnej ceny; SFX 0,02 = 10 s; Lyria 0,08; TTS 0,005 / 100 znaków). Flaga `pipeline.music.enabled` ma pusty `payload`. W bazie jest teraz **11 wierszy** `model_pricing`.

### 11.3 Plany

| | **No plan** (konto bez zakupu) | **Trial** (jednorazowo) | **Pro** | **Studio** |
|---|---|---|---|---|
| Cena | 0 | **1,29 USD** jednorazowo | **15 USD / mies.** | **45 USD / mies.** |
| Kredyty | 0 | **86** (ważne 30 dni) | **1000 / mies.** | **3200 / mies.** |
| Odnowienie | — | — | co miesiąc: **reset do 1000** (każda opłacona faktura cyklu Stripe) | co miesiąc: **reset do 3200** |
| Niewykorzystane kredyty subskrypcyjne | — | — | **przepadają** przy resecie (nie kumulują się) | przepadają |
| Współbieżne joby | 1 | 1 | 2 | 5 |
| Storage | 0,5 GB | 2 GB | 25 GB | 100 GB |
| Retencja plików | 30 dni | 30 dni | aktywna + 90 dni | aktywna + 90 dni |
| **Zdjęcia wejściowe do 3D** (`maxInputImages`, §9.3) | 1 | **1** | **3** | **3** |
| Tekstury 3D 4K | — | — | ✗ | ✓ |
| Workspace'y zespołowe | ✗ | ✗ | ✗ | ✓ (5 miejsc) |
| Pakiety kredytów (dokupowane) | ✓ | ✓ | ✓ | ✓ |

Uwaga do marż: Pro = 1000 kr. ≈ 10 USD kosztu → ~33% marży brutto; Studio = 3200 kr. ≈ 32 USD → ~29%. Wartości do korekty przez właściciela (§27).

### 11.4 Pakiety kredytów (jednorazowe, bezterminowe)

| Pakiet | Kredyty | Cena |
|---|---|---|
| Pack S | 1000 | **X** (placeholder; sugestia 19 USD / 79 PLN) |
| Pack L | 10 000 | **Y** (placeholder; sugestia 149 USD / 599 PLN) |

W UI użytkownik widzi **dwa okienka**:
- **Subscription credits** — `X / 1000` (Pro) lub `X / 3200` (Studio), „resets in N days”; co miesiąc, przy opłaceniu faktury cyklu, saldo jest **ustawiane na nowo na pełną pulę planu** (niewykorzystane przepadają);
- **Usage credits** — kredyty z pakietów; **nigdy się nie resetują** i nie wygasają. Kredyty z triala są pokazywane w tym samym okienku jako osobna linia „86 trial credits · expire in N days” (jedyny wyjątek od bezterminowości — 30 dni).

Wewnętrznie `credit_balances` trzyma trzy kubełki: `trial` (30 dni), `subscription` (reset miesięczny), `purchased` (= usage credits, bezterminowe).

**Kolejność zużycia**: najpierw `trial` (wygasa najszybciej), potem `subscription` (przepada przy resecie), na końcu `purchased`.

### 11.5 Trial — zasady
- Cena **1,29 USD**, **86 kredytów**, ważne **30 dni** od zakupu.
- Dostępny **raz na konto**: przed utworzeniem sesji Checkout backend sprawdza `profiles.trial_used_at` (ustawiane w webhooku po opłaceniu); przycisk „Start trial” znika po użyciu. Dodatkowo blokada po `stripe_customer_id` (jeden klient Stripe = jeden trial) — oba warunki w kodzie, bez żadnych danych karty.
- **Żadne dane karty nie przechodzą przez naszą aplikację ani bazę**: płatność wyłącznie przez hostowany Stripe Checkout (`mode: 'payment'`, price `STRIPE_PRICE_TRIAL`); przechowujemy tylko `stripe_customer_id`, id sesji/zdarzenia i `trial_used_at`. Nie zapisujemy fingerprintu karty, ostatnich cyfr ani nazwiska z karty. Ewentualne reguły antyfraudowe (np. powtarzające się karty) konfigurowane są po stronie Stripe Radar i działają na danych, które ma tylko Stripe.
- Nie wymaga subskrypcji, nie przechodzi automatycznie w plan płatny.

### 11.6 Integracja Stripe

- **Produkty/ceny** (ID w env): `trial` (one-time 1,29 USD), `pro_monthly`, `studio_monthly`, `pack_1000`, `pack_10000`. Ceny w USD z dodatkową walutą PLN (Stripe multi-currency prices; prezentacja waluty wg kraju klienta wykrytego przez Stripe Checkout). Wszystkie ceny `tax_behavior: exclusive` (VAT doliczany na górze — założenie wyliczenia triala w §11.1).
- **Stripe Tax** włączony (VAT UE / Polska), adres zbierany w Checkout, `automatic_tax: { enabled: true }`, `tax_id_collection` dla firm.
- **Dane kart**: wyłącznie hostowany Stripe Checkout i Customer Portal (redirect na domenę Stripe). Nie używamy Stripe Elements ani własnych formularzy kart; aplikacja nie ma dostępu do numerów kart i nie zapisuje żadnych szczegółów metody płatności (zakres PCI: SAQ A).
- **Checkout Session** tworzona serwerowo (`POST /api/billing/checkout`), `client_reference_id = workspace_id`, `metadata: { workspace_id, user_id, kind }`, `customer` (tworzony i zapisany w `workspaces.stripe_customer_id`), `success_url=/app/billing?status=success&session_id=…`, `cancel_url=/app/billing`.
- **Customer Portal** (`POST /api/billing/portal`) do zmiany planu (Pro ↔ Studio, proration włączone), aktualizacji karty, anulowania (na koniec okresu), faktur.
- **Webhook** `POST /api/webhooks/stripe` (weryfikacja podpisu, idempotencja przez `stripe_events`):
  - `checkout.session.completed` (`mode=payment`): przyznanie kredytów pakietu (`pack_purchase`, kubełek `purchased`, bezterminowo) lub triala (`trial_purchase`, kubełek `trial`, `trial_expires_at = now() + 30 dni`, `profiles.trial_used_at = now()`).
  - `checkout.session.completed` (`mode=subscription`): zapis `stripe_subscription_id`, plan, status.
  - `invoice.paid` (subskrypcja, `billing_reason` in `subscription_create`, `subscription_cycle`, `subscription_update`): **reset kubełka `subscription` do pełnej puli planu** (`subscription_available = 1000 | 3200`, niewykorzystane przepadają — wpis `expiry` z ujemną deltą, potem `subscription_grant` z dodatnią), `subscription_expires_at = current_period_end + 3 dni` (bufor na Stripe Smart Retries). Przy upgrade Pro → Studio w trakcie okresu (proration): saldo podnoszone o różnicę (3200 − 1000 = 2200) bez resetu; przy downgrade nic nie odejmujemy do końca okresu. Idempotencja po `invoice.id`.
  - `customer.subscription.updated`: synchronizacja planu/statusu (`active`, `past_due`, `canceled`, `unpaid`), `cancel_at_period_end`.
  - `customer.subscription.deleted`: plan → `none`, kubełek `subscription` = 0 (wpis `expiry`), start okresu łaski retencji plików (90 dni). Usage credits (`purchased`) pozostają nietknięte.
  - `invoice.payment_failed`: status `past_due` → baner w UI, generacje z kubełka subskrypcyjnego zablokowane po 7 dniach (Stripe Smart Retries).
- Faktury/paragony wysyła Stripe (e-mail klienta). My nie wysyłamy własnych potwierdzeń w MVP.

### 11.7 Księga kredytów — reguły implementacyjne
- Wszystkie zmiany przez funkcje SQL (`SECURITY DEFINER`, wołane z service role): `reserve_credits(workspace_id, job_id, amount)`, `settle_job_credits(job_id, actual_amount)`, `release_reservation(job_id)`, `grant_credits(workspace_id, bucket, amount, kind, ref, expires_at)`, `reset_subscription_credits(workspace_id, amount, expires_at)` (reset miesięczny), `expire_credits(workspace_id, bucket)` (dla `trial` po 30 dniach i dla `subscription`, gdy minie `subscription_expires_at` bez opłaconej faktury).
- Rezerwacja blokuje kredyty (`credit_balances.reserved`), rozliczenie przenosi z rezerwacji do zużycia w kolejności kubełków `trial → subscription → purchased`; nadwyżka rezerwacji wraca.
- `credit_ledger` jest append-only (trigger blokujący UPDATE/DELETE); `credit_balances` to materializacja (kolumny `trial_available`, `trial_expires_at`, `subscription_available`, `subscription_expires_at`, `purchased_available`, `reserved`).
- Saldo w UI (sidebar, skrót): „740 / 1000 · +240 usage”; pełny widok w Billing: okienko **Subscription credits** „740 / 1000 · resets in 12 days” i okienko **Usage credits** „240” (+ linia „86 trial credits · expire in 27 days”, jeśli dotyczy).

---

## 12. Moderacja i bany

### 12.1 Filtr promptu (tani LLM)
- Model: `MODERATION_MODEL` (OpenAI, najtańszy aktualny model klasy nano/mini), `temperature 0`, JSON `{ "verdict": "allow" | "block", "category": "sexual_nudity" | "extreme_violence" | "drugs_extreme" | "csam" | "hate_extreme" | "other", "reason": "krótko" }`.
- **Instrukcja (kanoniczna, wersjonowana `MODERATION_PROMPT_VERSION`)**:
  > You are a content filter for a game asset generator. Decide whether the user's request may be sent to the generative models.
  > BLOCK always: nudity, sexual content, sexualized characters, requests to undress or make characters "sexy/nude/lingerie", any sexual content involving minors (also report category `csam`).
  > BLOCK only in truly drastic cases: graphic gore intended to shock (realistic mutilation, torture as the main subject), explicit drug-use instructions or glorification, real-world hate symbols or targeted hateful content against real groups, real persons in defamatory scenes.
  > ALLOW normal game content: fantasy/sci-fi combat, weapons, blood splatter effects, monsters, skeletons, zombies, potions, "poison", bars/taverns, horror atmosphere, villains, war games, stylized violence.
  > When unsure whether something is "drastic", allow it. Output JSON only.
- Odrzucony prompt: job `rejected`, kredyty zwrócone, komunikat w UI („Your prompt was rejected by our content policy: <category>. Credits were not charged.”), wpis w `moderation_events`.
- Dodatkowo polegamy na filtrach dostawców: błąd „content policy” od dostawcy → job `failed` z kategorią `provider_policy`, kredyty zwrócone, także liczony jako naruszenie.

### 12.2 Naruszenia i bany
- `profiles.violations_month` (licznik) + `violations_reset_at` (pierwszy dzień następnego miesiąca UTC).
- Progi (konfigurowalne w `feature_flags.moderation_thresholds`, domyślnie `{ "warn_at": 3, "ban_at": 12 }`): **3 blokady w miesiącu → ostrzeżenie** (e-mail `moderation-warning` + baner w aplikacji z licznikiem „3 of 12”); **12 blokad w miesiącu → automatyczny ban** (`banned_at`, `ban_reason='auto:moderation'`), sesje unieważnione, brak zwrotu za niewykorzystane kredyty (zgodnie z ToS — do ujęcia w regulaminie). Licznik zeruje się 1. dnia miesiąca (UTC).
- Admin może odbanować / zbanować ręcznie z powodem; kategoria `csam` → natychmiastowy ban i wpis do `audit_log` niezależnie od licznika.
- **Brak filtra wyników** (obrazów/audio) — decyzja świadoma.

---

## 13. Przechowywanie plików (Cloudflare R2) i retencja

- Jeden bucket prywatny. **Stan faktyczny (2026-09-23): `plikiveyraflow1`** (region `EEUR`, utworzony ręcznie 2026-09-22) — używany zarówno lokalnie, jak i docelowo w produkcji, dopóki właściciel nie zdecyduje o rozdzieleniu środowisk. Pierwotnie planowane nazwy `veyraflow-assets` (prod) / `veyraflow-assets-dev` (dev/preview) **nie są utworzone**; bucketów R2 nie da się przemianować, więc rozdzielenie środowisk = utworzenie drugiego bucketu i zmiana `R2_BUCKET` w środowisku Vercel Preview/Production. Brak publicznego dostępu; wszystko przez presigned URL (GET 15 min, PUT 10 min) generowane na serwerze.
- **Sterownik lokalny** (`lib/storage/local.ts`, aktywny gdy brak `R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`/`R2_ENDPOINT`): te same klucze, pliki w `.data/storage/<key>` (gitignore), „presigned” GET/PUT = `GET|PUT /api/files?key=&exp=&sig=` z HMAC-SHA256 (`AUTH_CODE_PEPPER`) i TTL; `Content-Disposition` przez `dl=`/`inline=`. Wybór sterownika: `lib/storage/index.ts` → `storage()`.
- Podglądy w UI używają linków inline z TTL 60 min (`lib/assets.ts: withPreviewUrls / filesWithUrls`).
- Schemat kluczy:
  ```
  ws/{workspace_id}/proj/{project_id}/asset/{asset_id}/{variant}.{ext}        # pliki assetów
  ws/{workspace_id}/proj/{project_id}/asset/{asset_id}/preview/{name}         # miniatury, gif, waveform
  ws/{workspace_id}/refs/{reference_id}.{ext}                                 # referencje projektu
  ws/{workspace_id}/uploads/{upload_id}.{ext}                                 # uploady tymczasowe (24 h)
  downloads/{workspace_id}/{download_id}.zip                                  # ZIPy (24 h)
  users/{user_id}/avatar.{ext}
  ```
- Upload z przeglądarki (referencje, obrazy do image-to-3D, avatar): `POST /api/uploads/presign` (walidacja typu i rozmiaru → presigned PUT z `Content-Length` limit) → klient PUT → `POST /api/uploads/complete` (HEAD w R2, zapis metadanych, sprawdzenie magic bytes przez serwer po pobraniu nagłówka pliku).
- CORS bucketu: `PUT, GET` z `APP_URL` (+ `*.vercel.app` dla preview).
- **Quota**: `workspaces.storage_used_bytes` aktualizowane przy każdym zapisie/usunięciu (RPC); przekroczenie → generacja zablokowana z komunikatem, można zwolnić miejsce.
- **Retencja** (`assets.expires_at` ustawiane przy tworzeniu i przeliczane przy zmianie planu): brak planu/trial → 30 dni od utworzenia; Pro/Studio → `null` dopóki subskrypcja aktywna; po `customer.subscription.deleted` → `now() + 90 dni` dla wszystkich assetów workspace'u. Funkcja Inngest `retention/cleanup` (cron codziennie 03:00 UTC): 7 dni przed wygaśnięciem e-mail (szablon `assets-expiring`), po terminie: soft delete (`deleted_at`) → po kolejnych 7 dniach usunięcie z R2 i rekordów.
- Usuwanie assetu przez użytkownika: soft delete → kosz („Trash”, 14 dni, możliwość przywrócenia) → hard delete w R2.

---

## 14. Kolejka zadań (Inngest) i worker (Modal)

### 14.1 Inngest
- Endpoint `POST/GET/PUT /api/inngest` (serve), klucze `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`.
- **Dispatcher** `lib/queue/dispatch.ts`: gdy `INNGEST_EVENT_KEY` jest ustawiony (lub `INNGEST_DEV=1` przy lokalnym `npx inngest-cli dev`), `inngest.send(...)`; w przeciwnym razie (lub gdy `send` się nie powiedzie) praca wykonuje się **inline** po odpowiedzi HTTP (`after()` z `next/server`): `runInlineQueue(workspaceId)` przetwarza joby `queued` FIFO z limitem współbieżności planu; ZIP-y i eksport danych analogicznie. Kod pipeline'u jest wspólny (`lib/pipelines/run.ts`).
- Funkcje:
  | Funkcja | Trigger | Opis |
  |---|---|---|
  | `generate-asset` | `asset/generate.requested` | pipeline §8: `step.run('slot-check-N')` + `step.sleep('30s')` do zwolnienia slotu planu, potem `step.run('run-pipeline')` → `runGenerationJob(jobId)` (pipeline sam odpytuje dostawców, zapisuje `provider_job_id` i wznawia się po restarcie). `cancelOn: asset/generate.cancelled` |
  | `provider-webhook-relay` | `provider/webhook.received` | normalizuje webhooki fal/worker do `provider/job.completed` (obserwowalność; pipeline'y i tak odpytują dostawcę) |
  | `build-download-zip` | `download/zip.requested` | ZIP wg presetu |
  | `retention-cleanup` | cron `0 3 * * *` | §13 |
  | `expire-credits` | cron `*/30 * * * *` | wygaszanie kubełka `trial` po `trial_expires_at` (30 dni) oraz kubełka `subscription` po `subscription_expires_at` (zabezpieczenie: brak opłaconej faktury cyklu po 3-dniowym buforze, np. `past_due`); wpis `expiry` w księdze |
  | `reset-violation-counters` | cron `0 0 1 * *` | §12.2 |
  | `send-email` | `email/send.requested` | wysyłka przez Resend z retry |
  | `data-export` | `account/export.requested` | eksport RODO (§21.5) |

  Wszystkie zadania cykliczne można uruchomić ręcznie z panelu admina (Flags → Maintenance tasks, `POST /api/admin/maintenance`).
- Retry: 3 próby z backoffem dla kroków sieciowych; kroki idempotentne (provider job id zapisywany po `submit`, ponowne uruchomienie nie tworzy drugiego zlecenia).
- Vercel: funkcje Inngest wykonują się jako Route Handler — `maxDuration = 300` (Vercel Pro/Fluid compute); ciężkie/długie operacje delegowane do workera.

### 14.2 Worker Modal (Python)
- Aplikacja Modal `veyraflow-worker`, web endpoints chronione nagłówkiem `Authorization: Bearer ${MODAL_WORKER_TOKEN}`; wejście/wyjście przez presigned URL R2 (worker pobiera z R2 i zapisuje do R2 — nie przez Vercel).
- Endpointy:
  | Endpoint | Zadanie | Zasoby |
  |---|---|---|
  | `POST /rig-animate` | Animated Drawings: `{ image_url, clips[], fps, frame_size, mirror }` → ZIP klatek | CPU (2 vCPU, 4 GB), render headless (OSMesa/EGL); GPU opcjonalnie dla detekcji pozy |
  | `POST /convert-3d` | Blender: konwersje GLB→FBX (Unity/Unreal)/OBJ, normalizacja, tekstury | CPU 4 vCPU |
  | `POST /render-thumbnail` | Blender/pyrender: turntable PNG+GIF | CPU |
  | `POST /audio-process` | ffmpeg: normalizacja, trim, loop, konwersje | CPU |
  | `POST /make-gif` | ffmpeg palettegen | CPU |
  | `POST /pixelize` | (opcjonalnie) kwantyzacja palet dużych paczek klatek — jeśli Node/sharp za wolne | CPU |
- Wywołania asynchroniczne: worker zwraca `202 { task_id }`, kończy pracę i woła `POST {APP_URL}/api/webhooks/worker` (HMAC `WORKER_WEBHOOK_SECRET`) → event `provider/job.completed`.
- Obraz Dockera workera: Python 3.11, `animated-drawings` (git), `torch` CPU, `blender` 4.x (pobierany do obrazu), `ffmpeg`, `Pillow`, `numpy`, `boto3`.
- Biblioteka klipów ruchu: pliki BVH w `worker/animated_drawings/motions/` (klipy z repozytorium Animated Drawings + własne, licencje zgodne z Apache-2.0/CC0; lista w `motions/index.json`: `{ id, name, loop, default_fps, frames }`).

---

## 15. Model danych (Supabase Postgres)

Wszystkie tabele w schemacie `public`, RLS **włączone na każdej**. Klient (anon key + JWT użytkownika) ma wyłącznie prawa odczytu ograniczone przynależnością do workspace'u (oraz zapis w wąskich przypadkach: `profiles` własny, `projects` w workspace'ach z rolą ≥ member). Wszystkie zapisy finansowe i jobów: tylko service role.

### 15.1 Tabele

```sql
-- Rozszerzenia
create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- Enumy
create type user_role as enum ('user','admin');
create type workspace_type as enum ('personal','team');
create type plan_tier as enum ('none','trial','pro','studio');
create type subscription_status as enum ('none','active','past_due','canceled','unpaid','incomplete');
create type member_role as enum ('owner','admin','member','viewer');
create type auth_code_purpose as enum ('signup','password_reset');
create type asset_type as enum ('image','sprite_animation','model_3d','audio_sfx','audio_music','audio_voice');
create type asset_status as enum ('processing','ready','failed');
create type job_status as enum ('queued','moderating','translating','generating','post_processing','uploading','completed','failed','rejected','cancelled');
create type credit_bucket as enum ('trial','subscription','purchased');
create type ledger_kind as enum ('subscription_grant','pack_purchase','trial_purchase','reservation','settlement','release','refund','admin_adjustment','expiry');
create type reference_kind as enum ('style','character','palette');
create type share_target as enum ('asset','project');
create type moderation_verdict as enum ('allow','block');

-- profiles: 1:1 z auth.users
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email citext not null unique,
  display_name text,
  avatar_key text,
  role user_role not null default 'user',
  tos_accepted_at timestamptz,
  tos_version text,
  marketing_consent boolean not null default false,
  notification_prefs jsonb not null default '{"job_completed": false, "assets_expiring": true}',  -- Settings → Notifications
  cookie_consent jsonb,                    -- kopia zgody cookies dla zalogowanych (§21.3)
  trial_used_at timestamptz,
  violations_month int not null default 0,
  violations_reset_at timestamptz,
  banned_at timestamptz,
  ban_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table auth_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  email citext not null,
  purpose auth_code_purpose not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  max_attempts int not null default 5,
  consumed_at timestamptz,
  ip inet,
  created_at timestamptz not null default now()
);
create index on auth_codes (email, purpose, created_at desc);

create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  type workspace_type not null,
  owner_id uuid not null references profiles(id) on delete cascade,   -- kaskada wymagana przez usuwanie konta
  plan plan_tier not null default 'none',
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  subscription_status subscription_status not null default 'none',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  seats int not null default 1,
  storage_used_bytes bigint not null default 0,
  storage_quota_bytes bigint not null default 536870912,  -- 0.5 GB
  retention_days int,                                     -- null = bezterminowo (aktywny plan)
  grace_until timestamptz,                                -- koniec okresu łaski po wygaśnięciu planu
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table workspace_members (
  workspace_id uuid references workspaces(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  role member_role not null,
  invited_by uuid references profiles(id),
  joined_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  email citext not null,
  role member_role not null default 'member',
  token_hash text not null unique,
  invited_by uuid not null references profiles(id),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create table credit_balances (
  workspace_id uuid primary key references workspaces(id) on delete cascade,
  trial_available int not null default 0,
  trial_expires_at timestamptz,            -- 30 dni od zakupu triala
  subscription_available int not null default 0,   -- "Subscription credits": reset co miesiąc do puli planu
  subscription_expires_at timestamptz,     -- current_period_end + 3 dni; po tej dacie bez faktury → 0
  purchased_available int not null default 0,      -- "Usage credits": pakiety, nigdy nie resetowane
  reserved int not null default 0,
  updated_at timestamptz not null default now(),
  check (trial_available >= 0 and subscription_available >= 0 and purchased_available >= 0 and reserved >= 0)
);

create table credit_ledger (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  kind ledger_kind not null,
  bucket credit_bucket,
  delta int not null,                     -- +/- kredyty
  job_id uuid,
  stripe_event_id text,                   -- także idempotencja (session.id / invoice.id / 'refund:<job>')
  actor_id uuid,                          -- kto (bez FK: anonimizowane jawnie przy usuwaniu konta)
  description text,
  created_at timestamptz not null default now()
);
create index on credit_ledger (workspace_id, created_at desc);
create index on credit_ledger (stripe_event_id) where stripe_event_id is not null;
-- trigger credit_ledger_immutable: zakaz UPDATE/DELETE (append-only); wyjątki: UPDATE zerujący tylko actor_id
-- (anonimizacja) oraz kaskada przy `set_config('app.allow_ledger_delete','on')` (usuwanie workspace'u/konta)

create table projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  style_guide jsonb not null default '{}',
  is_scratch boolean not null default false,
  cover_asset_id uuid,
  created_by uuid references profiles(id),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, slug)
);

create table project_references (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  kind reference_kind not null,
  label text,
  r2_key text not null,
  asset_id uuid,                          -- jeśli referencja pochodzi z biblioteki
  extracted_palette jsonb,                -- dla kind='palette'
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  user_id uuid not null references profiles(id),
  type asset_type not null,
  status job_status not null default 'queued',
  progress int not null default 0,
  input jsonb not null,                   -- prompt użytkownika + parametry (bez sekretów)
  translated_prompt jsonb,                -- wynik warstwy tłumaczenia (ukryty przed użytkownikiem)
  translator_model text, translator_prompt_version text,
  moderation_model text, moderation_prompt_version text,
  provider text, provider_model text, provider_job_id text,
  provider_cost_usd numeric(10,4),
  credits_estimated int not null,
  credits_reserved int not null default 0,
  credits_charged int,
  error_code text, error_message text,
  inngest_run_id text,
  result_asset_ids uuid[] not null default '{}',
  started_at timestamptz, finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on jobs (workspace_id, created_at desc);
create index on jobs (status) where status not in ('completed','failed','rejected','cancelled');
create index on jobs (provider_job_id) where provider_job_id is not null;

-- Wąska projekcja jobów dla Realtime (bez translated_prompt / provider_*), utrzymywana triggerem (§15.3)
create table job_status_feed (
  job_id uuid primary key references jobs(id) on delete cascade,
  workspace_id uuid not null,
  user_id uuid not null,
  type asset_type not null,
  status job_status not null,
  progress int not null default 0,
  error_code text,
  result_asset_ids uuid[] not null default '{}',
  updated_at timestamptz not null default now()
);
create index on job_status_feed (workspace_id, updated_at desc);
-- Realtime: publikacja supabase_realtime zawiera job_status_feed (filtr po workspace_id w kliencie + RLS)

create table assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  type asset_type not null,
  name text not null,
  slug text not null,
  status asset_status not null default 'processing',
  source_job_id uuid references jobs(id) on delete set null,
  parent_asset_id uuid references assets(id) on delete set null,   -- pochodne (np. animacja z obrazu)
  prompt text,                                                       -- oryginalny prompt użytkownika
  metadata jsonb not null default '{}',
  tags text[] not null default '{}',                                 -- tagi użytkownika (Library)
  preview_key text,                                                  -- miniatura (PNG/WebP)
  animated_preview_key text,                                         -- GIF
  size_bytes bigint not null default 0,
  created_by uuid references profiles(id),
  expires_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on assets (workspace_id, project_id, created_at desc) where deleted_at is null;
create index on assets (expires_at) where deleted_at is null;

create table asset_files (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references assets(id) on delete cascade,
  format text not null,                   -- png|webp|gif|json_atlas|tres|glb|gltf|fbx|obj|mtl|wav|ogg|mp3|zip|texture_png|bvh…
  variant text,                           -- np. 'sheet', 'frames', 'unity', 'unreal', 'loop', 'albedo', 'x4'
  engine_preset text,                     -- null|unity|unreal|godot|generic
  r2_key text not null,
  size_bytes bigint not null,
  checksum_sha256 text,
  created_at timestamptz not null default now()
);
create index on asset_files (asset_id);

create table moderation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  workspace_id uuid references workspaces(id) on delete set null,
  job_id uuid references jobs(id) on delete set null,
  source text not null,                   -- 'prompt_filter' | 'provider_policy'
  verdict moderation_verdict not null,
  category text, reason text,
  prompt_excerpt text,
  model text,
  created_at timestamptz not null default now()
);

create table share_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  target_type share_target not null,
  target_id uuid not null,
  token_hash text not null unique,
  allow_download boolean not null default false,
  show_prompt boolean not null default false,     -- §18 opcja pokazania promptu
  expires_at timestamptz,
  revoked_at timestamptz,
  view_count int not null default 0,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create table model_pricing (
  id text primary key,                    -- np. 'model3d.engine.rodin', 'sfx.variant', 'music.lyria3.60s'
  pipeline asset_type not null,
  provider text not null,
  provider_model text not null,
  credits int not null,
  est_provider_cost_usd numeric(10,4) not null,
  enabled boolean not null default true,
  params jsonb not null default '{}',     -- domyślne parametry wywołania
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);

create table feature_flags (
  key text primary key,
  enabled boolean not null default false,
  payload jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

create table stripe_events (
  id text primary key,                    -- evt_…
  type text not null,
  processed_at timestamptz,
  payload jsonb not null,
  error text,
  received_at timestamptz not null default now()
);

create table uploads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references profiles(id),
  r2_key text not null,
  mime text not null, size_bytes bigint not null,
  completed boolean not null default false,
  expires_at timestamptz not null default now() + interval '24 hours',
  created_at timestamptz not null default now()
);

create table downloads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references profiles(id),
  spec jsonb not null,                    -- co pakujemy + preset
  status text not null default 'queued',  -- queued|building|ready|failed
  r2_key text, size_bytes bigint,
  error text,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table rate_limits (
  key text primary key,                   -- np. 'signup:ip:1.2.3.4', 'code:email:x@y'
  count int not null default 0,
  window_start timestamptz not null default now()   -- okno stałe (fixed window) — RPC increment_rate_limit
);

create table audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references profiles(id),
  action text not null,                   -- 'admin.credits.adjust', 'admin.user.ban', 'workspace.member.remove', …
  target_type text, target_id text,
  payload jsonb,
  ip inet,
  created_at timestamptz not null default now()
);
```

### 15.2 Triggery i funkcje (stan w bazie; źródło: `supabase/migrations/20260920000003_functions_triggers.sql` + 0006–0011)
- `handle_new_user()` (trigger `after insert on auth.users`): tworzy `profiles` (display_name z `user_metadata.display_name|full_name|name` lub części e-maila; `tos_accepted_at`/`tos_version`/`marketing_consent` z `user_metadata`), workspace osobisty (`slug = 'u-' || 8 znaków id`), `workspace_members(owner)`, `credit_balances`, projekt „Scratch” (`is_scratch=true`).
- `handle_user_email_change()` (trigger `after update of email on auth.users`) — synchronizuje `profiles.email`.
- `set_updated_at()` na tabelach z `updated_at`.
- `credit_ledger_immutable()` — append-only z wyjątkami opisanymi przy tabeli.
- `profiles_restrict_self_update()` — użytkownik (auth.uid() = id, nie admin) może zmienić tylko `display_name`, `avatar_key`, `marketing_consent`, `notification_prefs`, `cookie_consent`.
- `assets_restrict_client_update()` — z klienta zmienialne tylko `name`, `tags`, `project_id`, `deleted_at`.
- `sync_job_status_feed()` (trigger `after insert or update of status, progress, error_code, result_asset_ids on jobs`) — upsert do `job_status_feed`.
- `profiles_before_delete()` (trigger `before delete on profiles`, security definer): ustawia `app.allow_ledger_delete=on`, usuwa workspace'y, których profil jest ownerem (kaskady), anonimizuje `credit_ledger.actor_id`, `audit_log.actor_id`, czyści `moderation_events.prompt_excerpt`. Dzięki temu `auth.admin.deleteUser()` usuwa konto deterministycznie (mieszanka CASCADE/SET NULL w jednym DELETE powodowała błędy FK).
- Pomocnicze do RLS: `member_role_rank(member_role)`, `is_member(ws uuid, min_role member_role default 'viewer')`, `is_admin()` (security definer, execute tylko dla `authenticated`).
- `available_credits(credit_balances)` — saldo z uwzględnieniem wygaśnięć kubełków.
- RPC (`security definer`, **execute odebrane `anon`/`authenticated` — tylko service role**):
  `reserve_credits(p_workspace, p_job, p_amount) → boolean`, `release_reservation(p_job)`, `settle_job_credits(p_job, p_actual) → int` (kolejność trial → subscription → purchased), `grant_credits(p_workspace, p_bucket, p_amount, p_kind, p_ref, p_expires_at, p_actor, p_description) → boolean` (idempotencja po `(stripe_event_id, kind)`), `reset_subscription_credits(p_workspace, p_amount, p_expires_at, p_ref) → boolean` (wpis `expiry` + `subscription_grant`), `expire_credits(p_workspace, p_bucket) → int`, `set_subscription_expiry(p_workspace, p_expires_at)`, `adjust_storage(p_workspace, p_delta) → bigint`, `increment_rate_limit(p_key, p_window_seconds, p_limit) → boolean`, `record_violation(p_user) → int` (licznik miesięczny z resetem 1. dnia miesiąca UTC).
- RPC dla klienta (`security invoker`): `my_workspaces()`, `workspace_balance(p_workspace)` (tylko członek).
- Rozszerzenia: `pgcrypto`, `citext` (w schemacie `extensions`).

### 15.3 RLS — zasady
- Funkcja pomocnicza `is_member(ws uuid, min_role member_role default 'viewer') returns boolean` (sprawdza `workspace_members` dla `auth.uid()`).
- `profiles`: select/update własnego wiersza (update ograniczony triggerem do pól nie-wrażliwych: `display_name`, `avatar_key`, `marketing_consent`); admin (`role='admin'`) select wszystkich.
- `workspaces`, `credit_balances`, `credit_ledger`, `projects`, `project_references`, `assets`, `asset_files`, `jobs`, `downloads`, `share_links`: select gdy `is_member(workspace_id)`; insert/update `projects`/`project_references` gdy `is_member(workspace_id,'member')`; `assets.update` (nazwa, soft delete) gdy member; reszta zapisów tylko service role.
- **Embedy PostgREST**: relacje `projects`↔`assets` (`assets.project_id` oraz `projects.cover_asset_id`) i `workspace_members`→`profiles` (`user_id`, `invited_by`) są niejednoznaczne — w zapytaniach trzeba podawać nazwę FK: `assets!assets_project_id_fkey(...)`, `projects!assets_project_id_fkey(...)`, `profiles!workspace_members_user_id_fkey(...)`, `profiles!workspaces_owner_id_fkey(...)`.
- `jobs.translated_prompt`: dla roli `authenticated` `SELECT` na `jobs` jest ograniczony **grantem kolumnowym** (bez `translated_prompt`, `translator_*`, `moderation_*`, `provider_*`, `provider_cost_usd`, `inngest_run_id`); dodatkowo widok `jobs_public` (`security_invoker`) z tymi samymi kolumnami — API i UI czytają z niego. Realtime publikuje tabelę `job_status_feed` (trigger), z RLS `is_member(workspace_id)`; klient subskrybuje `postgres_changes` z filtrem `workspace_id=eq.<id>` i ma fallback polling co 4 s, gdy są aktywne joby (`hooks/use-job-feed.ts`).
- `profiles`: dodatkowo select wierszy współczłonków wspólnych workspace'ów (do list członków).
- `model_pricing`, `feature_flags`: select dla wszystkich zalogowanych (potrzebne do wyceny w UI), zapis tylko admin (service role z panelu).
- `auth_codes`, `stripe_events`, `rate_limits`, `audit_log`, `moderation_events`, `uploads`: brak dostępu z klienta.

---

## 16. API (Route Handlers) i webhooki

Wszystkie odpowiedzi JSON `{ ok: true, data } | { ok: false, error: { code, message } }`. Walidacja zod, autoryzacja przez sesję Supabase (cookies) + sprawdzenie roli w workspace. Endpointy mutujące wymagają nagłówka `Origin` zgodnego z `APP_URL` (ochrona CSRF) — Server Actions używane dla prostych formularzy.

### 16.1 Auth
| Metoda | Ścieżka | Opis |
|---|---|---|
| POST | `/api/auth/signup` | §5.1 |
| POST | `/api/auth/verify-signup` | kod 6-cyfrowy |
| POST | `/api/auth/resend-code` | `{ email, purpose }` cooldown 60 s |
| POST | `/api/auth/forgot-password` | §5.3 |
| POST | `/api/auth/reset-password` | kod 8-cyfrowy + hasło |
| POST | `/api/auth/logout` | |

Wszystkie mutujące handlery wymagają zgodnego nagłówka `Origin` (`lib/api.ts: requireSameOrigin`) — brak nagłówka (klient nie-przeglądarkowy) jest akceptowany, obcy origin → 403.

### 16.2 Workspace, projekty, referencje
| Metoda | Ścieżka |
|---|---|
| GET/POST | `/api/workspaces` (lista / utwórz team) |
| POST | `/api/workspaces/:id/switch` (ustawia cookie `vf_ws`) |
| PATCH/DELETE | `/api/workspaces/:id` |
| GET/POST | `/api/workspaces/:id/members`, DELETE `/api/workspaces/:id/members/:userId`, PATCH (rola) |
| POST | `/api/workspaces/:id/invites`, DELETE `/api/workspaces/:id/invites/:inviteId`, POST `/api/invites/:token/accept` |
| GET/POST | `/api/projects` (per aktualny workspace), GET/PATCH/DELETE `/api/projects/:id` |
| POST/DELETE | `/api/projects/:id/references` (z uploadu lub assetu), `/api/projects/:id/references/:refId` |
| POST | `/api/projects/:id/palette/extract` (z referencji `palette`) |

### 16.3 Generacja, joby, assety
| Metoda | Ścieżka | Opis |
|---|---|---|
| POST | `/api/jobs` | `{ type, project_id, input }` → wycena, walidacja planu (rozdzielczość, 4K, workspace read-only), insert job, `inngest.send('asset/generate.requested')` |
| GET | `/api/jobs?workspace=…&status=…` | lista |
| GET | `/api/jobs/:id` | szczegóły (bez `translated_prompt`) |
| POST | `/api/jobs/:id/cancel` | |
| POST | `/api/jobs/estimate` | wycena bez tworzenia joba (UI „This will use N credits”) |
| GET | `/api/assets?project=…&type=…&q=…&cursor=…` | biblioteka (paginacja kursorowa) |
| GET/PATCH/DELETE | `/api/assets/:id` | rename, tags, soft delete, restore (`POST /api/assets/:id/restore`) |
| GET | `/api/assets/:id/download?file=…` | presigned GET |
| POST | `/api/downloads` | ZIP wg presetu (`{ asset_ids | project_id, engine_preset }`) |
| GET | `/api/downloads/:id` | status + link |
| POST | `/api/uploads/presign`, `/api/uploads/complete` | |
| GET/PUT | `/api/files?key=&exp=&sig=` | **tylko sterownik lokalny storage** (§13): podpisane GET/PUT, 404 gdy R2 skonfigurowane |
| GET/PATCH/POST | `/api/account` | profil (`display_name`, `marketing_consent`, `notification_prefs`); akcje: `change_password`, `accept_tos`, `cookie_consent`, `sign_out_everywhere`, `request_export`, **`delete_account`** (wymaga pola `email` zgodnego z adresem konta — §21.5) (§5.4, §21) |

### 16.4 Billing
| Metoda | Ścieżka |
|---|---|
| POST | `/api/billing/checkout` `{ workspace_id, kind: 'trial'|'pro'|'studio'|'pack_1000'|'pack_10000' }` |
| POST | `/api/billing/portal` |
| GET | `/api/billing/summary` (plan, saldo, okres, ostatnie wpisy księgi) |

### 16.5 Udostępnianie
| Metoda | Ścieżka |
|---|---|
| POST | `/api/share` `{ target_type, target_id, allow_download, expires_in_days }` → zwraca pełny URL raz |
| GET/DELETE | `/api/share/:id` (lista własnych / odwołanie) |
| GET | `/api/s/:token` (publiczny; dane podglądu + presigned URL jeśli `allow_download`) |

### 16.6 Admin (guard `role='admin'`, wszystko logowane do `audit_log`)
`/api/admin/overview`, `/api/admin/users` (GET z paginacją/szukaniem), `/api/admin/users/:id` (GET szczegóły; PATCH: `ban`/`ban_reason`, `role`, `sign_out`; DELETE — usunięcie RODO), `/api/admin/users/:id/credits` (POST `{ workspace_id, amount, reason }` → `admin_adjustment` w kubełku `purchased`), `/api/admin/workspaces` (GET), `/api/admin/workspaces/:id` (PATCH `{ plan, reason }` — ręczna zmiana planu, np. komplementarny Studio), `/api/admin/jobs`, `/api/admin/jobs/:id` (pełne szczegóły z `translated_prompt`), `/api/admin/jobs/:id/retry` (POST `{ mode: 'retry'|'refund', reason }`), `/api/admin/costs?from&to[&format=csv]`, `/api/admin/pricing` (GET/PUT), `/api/admin/flags` (GET/PUT upsert), `/api/admin/moderation`, `/api/admin/audit`, `/api/admin/maintenance` (POST `{ task }` — ręczne uruchomienie zadań cyklicznych; dostępne zadania po zmianach z 2026-09-22: `retention`, `expire_credits`, `violations`).

### 16.7 Webhooki (przychodzące)
| Ścieżka | Źródło | Weryfikacja |
|---|---|---|
| `/api/webhooks/stripe` | Stripe | podpis `STRIPE_WEBHOOK_SECRET` |
| `/api/webhooks/fal` | fal.ai queue webhooks | sekret w URL `?secret=FAL_WEBHOOK_SECRET` (gdy ustawiony); podpis ED25519 fal — do dodania przy wdrożeniu. Obecnie pipeline'y nie przekazują `webhookUrl` (odpytują kolejkę), trasa zostaje na przyszłość |
| `/api/webhooks/worker` | Modal worker | HMAC-SHA256 surowego body w nagłówku `X-Veyraflow-Signature` (`WORKER_WEBHOOK_SECRET`) |
| `/api/inngest` | Inngest | signing key |

Każdy webhook dostawcy jedynie emituje event Inngest `provider/webhook.received` (bez logiki) → dalej `provider-webhook-relay`.

### 16.8 Diagnostyka
| Metoda | Ścieżka | Opis |
|---|---|---|
| POST | `/api/client-errors` | błąd z przeglądarki → Google Cloud Error Reporting (§25.4); `Origin` wymagany zgodny, 20/min/IP, zawsze 204 |

---

## 17. Interfejs użytkownika — strony i komponenty

### 17.1 Zasady ogólne
- Dark mode domyślnie (paleta shadcn „zinc” z akcentem — kolor marki: placeholder `#7C5CFF` fiolet; do ustalenia), light mode przez przełącznik; `next-themes`, klasa na `<html>`.
- Responsywność: desktop-first (narzędzie pracy), ale wszystko działa na tablecie; na telefonie generator w układzie jednokolumnowym.
- Dostępność: focus rings, aria-labels, kontrast AA.
- Stan ładowania: skeletony; błędy: toasty (sonner) + inline.
- Nazwy w UI po angielsku; brak i18n.

### 17.2 Strony publiczne (`(marketing)`)
- **`/` Landing**: hero („Generate game-ready assets with AI”), 4 kafle typów assetów z przykładami (statyczne obrazy w `public/`), sekcja „Export for Unity, Unreal, Godot”, „How it works” (3 kroki), pricing teaser, FAQ, CTA. Stopka wg §21.
- **`/pricing`**: tabela planów (§11.3), pakiety, trial, FAQ o kredytach; przyciski prowadzą do rejestracji lub checkoutu.
- **`/terms`, `/privacy`, `/cookies`, `/ai-disclosure`, `/impressum`**: layout dokumentu (nagłówek, data „Last updated”, treść z `docs/legal/*.md` renderowana przez MDX) — **treści to placeholdery** („This document will be published before launch.”).
- **`/contact`**: e-mail kontaktowy (placeholder `support@…`), bez formularza w MVP.
- **`/s/[token]`**: strona udostępnionego assetu/projektu (§18).
- **`/banned`**, **`/invite/[token]`**.

### 17.3 Auth (`(auth)`)
Karty wyśrodkowane: `/login`, `/signup`, `/verify`, `/forgot-password`, `/reset-password`. Pola kodów jako komponent `OtpInput` (6 lub 8 cyfr). Bez przycisków OAuth (Google usunięte 2026-09-24). Linki między stronami. Komunikaty generyczne wg §5.

### 17.4 Aplikacja (`/app`, layout z sidebar)
Sidebar (lewy): przełącznik workspace'u, nawigacja: **Dashboard**, **Projects**, **Generate** (submenu: Image, Animation, 3D Model, SFX, Music, Voice), **Library**, **Jobs**, **Billing**, **Settings**; na dole: saldo kredytów (pasek + liczba, klik → Billing), avatar/menu (Settings, Sign out, Admin jeśli admin).
Topbar: breadcrumb, wyszukiwarka biblioteki (⌘K), przełącznik motywu, dzwonek (ukończone joby, ostrzeżenia).

- **Dashboard `/app`**: karty „Recent assets”, „Active jobs” (live), „Credits” (saldo, reset), „Quick generate” (2 przyciski: 3D Model, Sound), „Projects” (ostatnie), baner statusu płatności (past_due) i retencji (dla planu none).
- **Projects `/app/projects`**: siatka kart (okładka, nazwa, liczba assetów, styl); `+ New project` → modal (nazwa, opis, art style, perspektywa, pixel grid, paleta (color picker + wklejanie hexów + „extract from image”), notes, target engine, audio notes).
  - **`/app/projects/[id]`**: zakładki *Assets* (filtry typ/status/tag, siatka), *Style guide* (edycja), *References* (upload/z biblioteki, oznaczanie kind), *Settings* (rename, archive, delete, share link).
- **Generate `/app/generate/[type]`** — trójpanelowy:
  - lewy panel (parametry): wybór projektu (top), prompt (textarea z licznikiem), parametry wg §9, „Advanced” (seed itd.), pasek „Cost: N credits · Balance: M”, przycisk **Generate** (disabled przy braku kredytów / roli viewer / read-only workspace, z tooltipem);
  - środek (podgląd): `ModelViewer` (three.js: orbit, wireframe, odtwarzanie animacji, mapy PBR toggle) i `AudioPlayer` (waveform, loop toggle). `ImagePreview` i `SpriteSheetPlayer` zostały w kodzie wyłącznie do oglądania starych assetów (§9.0);
  - prawy panel (wyniki): historia jobów tego typu w projekcie (live status, miniatury, „Download”, „Delete”).
  - **3D**: prompt **i/lub** do 3 zdjęć (limit wg planu), selektor **Engine** (Rodin Gen-2.5 / TRELLIS), parametry siatki i tekstur, auto-rig z listą klipów; po zakończeniu przyciski „Rig”, „Add animation” (kolejne joby na tym samym assecie — tworzą nowe wersje `parent_asset_id`). Szczegóły w §9.3.
  - **Voice**: edytor linii (każda linia = kwestia), **obowiązkowe pole `Instructions`**, `Language` jako lista wyboru; **bez wyboru głosu** (§9.6).
- **Library `/app/library`**: wszystkie assety workspace'u; filtry (typ, projekt, data, tag, status), sortowanie, zaznaczanie wielu → „Download ZIP (preset)”, „Move to project”, „Delete”; widok *Trash*.
  - **`/app/assets/[id]`**: duży podgląd, metadane (rozmiar, klatki, fps, tri count, czas trwania, paleta), oryginalny prompt, **panel „Download”** z wyborem presetu (Unity/Unreal/Godot/Generic) i listą plików (format, rozmiar, przycisk), sekcja „Derived assets”, „Share”, „Use as reference”.
- **Jobs `/app/jobs`**: tabela (typ, projekt, status live, koszt, czas, akcje: cancel/retry-as-new/open asset), filtr statusu, szczegóły błędu w drawerze.
- **Billing `/app/billing`**: aktualny plan i okres; dwa okienka kredytów — **Subscription credits** (`X / pula planu`, pasek postępu, „resets in N days”) i **Usage credits** (kredyty z pakietów, bez daty; pod spodem linia z kredytami triala i datą ich wygaśnięcia, jeśli są); przyciski „Upgrade/Change plan” (Checkout/Portal), „Buy credits” (2 pakiety), „Start trial — $1.29” (tylko jeśli `trial_used_at` puste), historia księgi (tabela z paginacją), „Manage subscription” (Portal), usage wykres kredytów 30 dni. Wszystkie płatności to redirect do Stripe — strona nie zawiera pól karty.
- **Settings `/app/settings`**: zakładki *Profile*, *Security* (zmiana hasła, aktywne sesje — sign out everywhere), *Workspace* (nazwa, członkowie, zaproszenia, role — dla team), *Notifications* (e-maile: job completed, expiring assets, marketing), *Data & privacy* (eksport danych, **natychmiastowe usunięcie konta potwierdzane wpisaniem własnego adresu e-mail** — §21.5, zgody cookies — otwiera menedżera zgód).
- **Admin `/admin`** (§19).

### 17.5 Komponenty kluczowe (lista do implementacji)
`WorkspaceSwitcher`, `CreditBadge`, `CostEstimate`, `PromptField`, `StylePresetPicker`, `PalettePicker`, `ReferencePicker`, `OtpInput`, `JobStatusBadge` (realtime), `JobList`, `ImagePreview`, `PixelPreview`, `SeamlessPreview`, `SpriteSheetPlayer`, `ModelViewer`, `AudioPlayer`, `DownloadPanel` (preset + pliki + README), `AssetCard`, `AssetGrid`, `ShareDialog`, `CookieBanner`, `ConsentManager`, `LegalDocument`, `PlanCard`, `LedgerTable`, `AdminTable*`.

---

## 18. Udostępnianie (linki prywatne)

- Tworzenie w `ShareDialog`: cel (asset / projekt), `allow_download` (domyślnie off), wygaśnięcie (7/30/90 dni/nigdy). Token 32 B base64url, w bazie tylko SHA-256; URL `APP_URL/s/<token>` pokazywany raz (kopiuj).
- Strona `/s/[token]`: bez logowania; nagłówek Veyraflow, podgląd (obraz / sprite player / 3D viewer / audio), metadane nietechniczne, oryginalny prompt (opcja `show_prompt` — domyślnie off), przycisk pobierania (jeśli włączone → presigned URL 15 min), dla projektu: siatka assetów (paginacja). Noindex (`robots: noindex`), brak listowania.
- Rate limit na `/api/s/:token`: 60/min/IP. `view_count` inkrementowany. Odwołanie natychmiastowe (`revoked_at`).
- Wygasłe/odwołane → strona 404 „This link is no longer available”.

---

## 19. Panel administracyjny

Dostęp: `profiles.role='admin'` (middleware + guard w Route Handlers). Layout osobny (`/admin`), nawigacja: Overview, Users, Workspaces, Jobs, Costs, Pricing, Flags, Moderation, Audit log.

- **Overview**: liczby (użytkownicy, aktywne subskrypcje, joby 24 h wg statusu, kredyty zużyte 24 h/30 dni, koszt dostawców 24 h/30 dni, marża brutto szacowana), wykresy 30 dni.
- **Users**: tabela (e-mail, rola, plan workspace'u osobistego, kredyty, naruszenia, ban, data), wyszukiwanie; szczegóły: workspace'y, księga, joby, moderation events; akcje: **dodaj/odejmij kredyty** (z powodem → `admin_adjustment`), ban/unban (powód), nadaj/odbierz admin, wymuś wylogowanie, usuń konto (RODO).
- **Workspaces**: plan, status Stripe (link do Stripe Dashboard), storage, członkowie; ręczna zmiana planu (np. komplementarny Studio) z wpisem audytu.
- **Jobs**: pełna tabela, filtry (status/provider/typ/workspace), szczegóły: `input`, **`translated_prompt`**, odpowiedź dostawcy (skrót), błąd, koszt vs kredyty; „Retry” (nowy job na koszt systemu — `admin_adjustment` rekompensata), „Refund credits”.
- **Costs**: agregaty per pipeline/provider/model: liczba jobów, kredyty pobrane, koszt USD, koszt/job, kredyty/job, „margin at cost basis”; eksport CSV.
- **Pricing**: edycja `model_pricing` (kredyty, model, enabled, params) — zmiany natychmiastowe, z audytem.
- **Flags**: `feature_flags` (np. `pipeline.model3d.enabled`, `pipeline.sfx.enabled`, `pipeline.music.enabled`, `pipeline.voice.enabled`, `moderation_thresholds`, `maintenance_mode`, `signup_enabled`).
- **Moderation**: lista `moderation_events`, filtr kategorii, szybki ban.
- **Audit log**: wszystkie akcje adminów i wrażliwe akcje użytkowników.

---

## 20. E-maile (Resend)

### 20.1 Stan konta Resend (zaktualizowany 2026-09-22)

**Domeny w koncie (obie `verified`, region `eu-west-1`, sending enabled):**

| Domena | ID | Status | Rola |
|---|---|---|---|
| **`veyraflow.eu`** | `3b245fb4-7e83-4c59-97b1-627a1326b678` | verified (dodana 2026-09-22) | **domena produkcyjna — cała wysyłka aplikacji** |
| `comitraapp.pl` | `08a0eadf-0c4a-43af-aaad-dc96ffe50658` | verified | pozostałość po wcześniejszej konfiguracji; **nieużywana przez Veyraflow** |

**Adres nadawcy: `EMAIL_FROM="Veyraflow <website@veyraflow.eu>"`** — wpisany w `.env`, `.env.example` oraz jako wartość domyślna w `lib/env.ts`. Wszystkie e-maile aplikacji (kody `signin`/`preset` i pozostałe) wychodzą z tego adresu. Adres `support@veyraflow.eu` (`SUPPORT_EMAIL`) jest adresem kontaktowym w treści e-maili, nie nadawcą.

**Szablony opublikowane w koncie (7):**

| Nazwa | Alias | ID | Zmienne | Temat |
|---|---|---|---|---|
| `SIGNIN` (nazwa od „sign in”) | `signin` | `ad5b3d0d-f857-46b4-a686-c28b0c0922d7` | `CODE` (string, fallback „Problems with code genration”) | Verification |
| `PRESET` | `preset` | `ef77dfd1-10aa-4155-8991-1db794a03851` | `PRESET` (string, fallback „Problems with code generation”) | Password reset |
| `WORKSPACE_INVITE` | `workspace-invite` | `472fe15b-54f1-4324-a3f1-53f27ca5a788` | `INVITER_NAME`, `WORKSPACE_NAME`, `INVITE_URL` | You've been invited to a Veyraflow workspace |
| `ASSETS_EXPIRING` | `assets-expiring` | `9efcb43e-3330-4ceb-8292-ec8f718f840d` | `COUNT`, `EXPIRES_AT`, `LIBRARY_URL` | Some of your Veyraflow assets expire soon |
| `MODERATION_WARNING` | `moderation-warning` | `111f76ff-d1db-434b-a2a7-c9f6b0334c41` | `COUNT`, `LIMIT` | Content policy warning |
| `ACCOUNT_BANNED` | `account-banned` | `e0841686-2fa9-4072-bee8-90df24220102` | `REASON`, `CONTACT_EMAIL` | Your Veyraflow account has been suspended |
| `DATA_EXPORT_READY` | `data-export-ready` | `bd66db68-46c1-4138-b9a4-b6cdc9d5eaac` | `DOWNLOAD_URL` | Your Veyraflow data export is ready |

**Szablony usunięte z konta Resend (2026-09-22, przez właściciela — NIE odtwarzać):**

| Nazwa | Alias | ID (nieaktualne) |
|---|---|---|
| `JOB_COMPLETED` | `job-completed` | `2d891fa1-3441-4c1d-9575-52d6ea9f8377` |
| `ACCOUNT_DELETION_SCHEDULED` | `account-deletion-scheduled` | `b2b28b69-622f-4b8b-bb13-53e5406fe080` |

Alias `account-deletion-scheduled` **nie jest już używany w ogóle** — razem z usunięciem 14-dniowej karencji (§21.5) zastąpił go renderowany inline `account-deleted`.

Odpowiadające im e-maile **nadal są wysyłane** — ich HTML powstaje w kodzie i idzie jako `html`/`text`, bez szablonu Resend (§20.3). Przy odtwarzaniu projektu od zera tych dwóch szablonów **nie tworzy się** w Resend.

**Klucze API w koncie:**

| Nazwa | Uprawnienia | Ograniczenie domeny | Status |
|---|---|---|---|
| `veyraflow-app-sending-eu` | sending access | `veyraflow.eu` | **używany przez aplikację** (`RESEND_API_KEY` w `.env.local`); utworzony 2026-09-22 |
| `veyraflow-app-sending` | sending access | `comitraapp.pl` | nieaktualny — nie może wysyłać z `veyraflow.eu` (HTTP 403 „This API key is not authorized to send emails from veyraflow.eu”); do usunięcia |
| `SECRET_CLAUDE_ACCESS_KEY`, `RESEND_SENDING_ACCESS_KEY` | wcześniejsze | — | nieużywane przez aplikację |

> **Ważne przy odtwarzaniu projektu:** ograniczenie klucza do domeny ustawia się **wyłącznie przy tworzeniu** i nie da się go później zmienić (`update-api-key` pozwala zmienić tylko nazwę). Klucz musi więc od razu być ograniczony do `veyraflow.eu` albo mieć pełny dostęp — inaczej każda wysyłka kończy się `403`.

### 20.2 Kiedy który e-mail

| Alias | Źródło treści | Zmienne | Kiedy |
|---|---|---|---|
| `signin` | szablon Resend | `CODE` | 6-cyfrowy kod weryfikacyjny przy rejestracji (§5.1), TTL 10 min |
| `preset` | szablon Resend | `PRESET` | 8-cyfrowy kod resetu hasła (§5.3), TTL 15 min |
| `workspace-invite` | szablon Resend | `INVITER_NAME`, `WORKSPACE_NAME`, `INVITE_URL` | zaproszenie do zespołu |
| `assets-expiring` | szablon Resend | `COUNT`, `EXPIRES_AT`, `LIBRARY_URL` | 7 dni przed wygaśnięciem |
| `moderation-warning` | szablon Resend | `COUNT`, `LIMIT` | po 3 naruszeniach |
| `account-banned` | szablon Resend | `REASON`, `CONTACT_EMAIL` | ban |
| `data-export-ready` | szablon Resend | `DOWNLOAD_URL` | eksport RODO |
| `job-completed` | **inline w kodzie** | `ASSET_NAME`, `ASSET_URL` | opcjonalne powiadomienie (wyłączone domyślnie, ustawienie użytkownika) |
| `account-deleted` | **inline w kodzie** | — (brak zmiennych) | natychmiast po usunięciu konta przez użytkownika (§21.5) |

E-maile transakcyjne nie wymagają zgody marketingowej; e-maile marketingowe (roadmapa) tylko przy `marketing_consent=true` (Resend Audiences/Topics — nieużywane w MVP).

### 20.3 Wysyłka w kodzie (`lib/email/resend.ts`)

Jedno wejście dla całej aplikacji: `sendTemplateEmail({ to, alias, variables })`. Typ `TemplateAlias` to suma dwóch zbiorów:

- **`ResendTemplateAlias`** (7 aliasów z tabeli w §20.1) — wysyłka szablonem: `resend.emails.send({ from: EMAIL_FROM, to, template: { id: TEMPLATE_IDS[alias], variables } })`. SDK `resend@6` przyjmuje w `template.id` ID albo alias; kod mapuje alias→ID (stała `TEMPLATE_IDS`) dla jednoznaczności.
- **`InlineAlias`** (`job-completed`, `account-deleted`) — szablonów w Resend nie ma, więc moduł sam składa `subject`, `html` i `text` i wysyła je bezpośrednio (`resend.emails.send({ from, to, subject, html, text })`).

Renderer inline (`renderLayout` / `renderText`) odtwarza ten sam układ co szablony w Resend: ciemne tło `#0b0b0f`, karta `#15151c` z paskiem akcentu `#7C5CFF` u góry, wordmark „Veyraflow.”, nadtytuł (eyebrow), nagłówek 24 px, akapity 15 px, opcjonalny przycisk CTA `#7C5CFF` z zapasowym linkiem tekstowym, separator i stopka. Definicje treści leżą w mapie `INLINE_EMAILS`:

| Alias | Temat | Nagłówek | CTA |
|---|---|---|---|
| `job-completed` | Your asset is ready | Your asset is ready | „Open asset” → `ASSET_URL` |
| `account-deleted` | Your Veyraflow account has been deleted | Your account has been deleted | — (bez CTA) |

**Bezpieczeństwo renderera inline** (§22): każda wartość wstawiana do HTML przechodzi przez `esc()` (`&`, `<`, `>`, `"`), więc nazwa assetu pochodząca od użytkownika nie może wstrzyknąć znaczników; adresy URL przechodzą przez `safeUrl()`, które przepuszcza wyłącznie `http(s)://`, a wszystko inne (np. `javascript:`) degraduje do `APP_URL`. Pokrywają to testy w `tests/email.test.ts`.

Bez `RESEND_API_KEY` (lokalny dev) treść — w tym kody — trafia do konsoli serwera jako `[email:dev] to=… template=… vars=…` i nic nie jest wysyłane. Retry przez funkcję Inngest `send-email`; w trybie inline (§14.1) wysyłka jest bezpośrednia, a wywołania w `lib/pipelines/run.ts` i `app/api/account/route.ts` są opakowane w `.catch()`, żeby błąd poczty nie przerwał operacji biznesowej.

---

## 21. Formalności prawne, stopka, cookies, RODO

### 21.1 Stopka (na każdej stronie publicznej i w aplikacji jako kompaktowa wersja)
Układ 4 kolumn (desktop) / akordeon (mobile):
- **Product**: Pricing, Generate (link do app), Changelog (placeholder, roadmapa), Status (placeholder).
- **Legal**: **Terms of Service** (`/terms`), **Privacy Policy** (`/privacy`), **Cookie Policy** (`/cookies`), **AI Disclosure** (`/ai-disclosure`), **Impressum / Company details** (`/impressum`), „Cookie settings” (otwiera menedżera zgód).
- **Company**: Contact (`/contact`), e-mail supportu (placeholder), nazwa i adres operatora (placeholder z `/impressum`).
- **Social**: placeholdery (X/Twitter, Discord) — ukryte, dopóki brak URL.
- Dolna linia: `© {rok} Veyraflow. All rights reserved.` + odznaka **„Assets are generated with AI”** (link do `/ai-disclosure`) + przełącznik motywu.

### 21.2 Dokumenty — miejsce, bez treści
- Pliki `docs/legal/terms.md`, `privacy.md`, `cookies.md`, `ai-disclosure.md`, `impressum.md` — każdy z frontmatterem `{ title, version, last_updated, status: 'draft' }` i treścią placeholder.
- `profiles.tos_version` przechowuje wersję zaakceptowaną; zmiana `version` w `terms.md` (env/const `TOS_VERSION`) wymusza ponowną akceptację modalem przy wejściu do `/app`.
- AI Disclosure ma zawierać (do napisania później): informację, że assety generowane są modelami AI dostawców trzecich, o ograniczeniach praw autorskich do treści AI w różnych jurysdykcjach, o zakazie generowania treści naruszających prawa osób trzecich, o przetwarzaniu promptów i zdjęć przez dostawców (OpenAI, fal.ai — w tym modele ElevenLabs, Google Lyria, Hyper3D Rodin, Microsoft TRELLIS) i o tym, że treści nie są używane do trenowania przez nas.
- Licencja na wygenerowane assety: część Terms of Service (do napisania), nie osobna strona.

### 21.3 Baner cookies i zgody
- `CookieBanner` przy pierwszej wizycie (dół ekranu): „Necessary only” / „Accept all” / „Customize”. Domyślnie wybór najbardziej prywatny.
- Kategorie: **necessary** (sesja, `vf_ws`, zgody), **analytics** (**Google Analytics 4** — cookies `_ga`, `_ga_<ID strumienia>`, ładowane dopiero po zgodzie, §21.6; teksty banera i menedżera nazywają Google Analytics wprost), **marketing** (brak w MVP; kategoria istnieje).
- Zgoda zapisana w cookie `vf_consent` (JSON `{ v: 1, necessary: true, analytics: bool, marketing: bool, ts }`, 12 miesięcy) i dla zalogowanych dodatkowo w `profiles.cookie_consent` (przez `POST /api/account { action: 'cookie_consent' }`; roadmapa: tabela `consents` z historią). Menedżer zgód (`components/cookie-banner.tsx`, event `vf:consent-open`) dostępny ze stopki i z Settings → Data & privacy. Każdy zapis zgody emituje event `vf:consent` (`detail` = obiekt zgody), na który reaguje `components/analytics.tsx` (§21.6).
- Stripe (Checkout/Portal) jest na domenie Stripe — informacja w Cookie Policy.

### 21.4 Zgody przy rejestracji
- Wymagany checkbox: „I accept the Terms of Service and Privacy Policy” (linki). Zapis `tos_accepted_at`, `tos_version`.
- Opcjonalny: „Send me product updates” → `marketing_consent`.
- Wymóg wieku (do ujęcia w ToS): 16+ (do potwierdzenia przez właściciela).

### 21.5 Prawa użytkownika (RODO)
- **Eksport danych** (`Settings → Data & privacy → Export`): job Inngest generuje ZIP z JSON (profil, workspace'y, projekty, assety-metadane, księga, joby bez `translated_prompt`) + lista linków do plików (presigned, 24 h) → e-mail `data-export-ready`.
- **Usunięcie konta — natychmiastowe, potwierdzane e-mailem (zmiana 2026-09-22).** Nie ma już harmonogramu ani 14-dniowego okresu karencji. Przebieg:

  1. `Settings → Data & privacy → Delete account`. Karta pokazuje ostrzeżenie „This cannot be undone" i pole tekstowe z etykietą **„Type `<adres e-mail konta>` to confirm"**.
  2. Przycisk **„Delete my account permanently"** jest nieaktywny, dopóki wpisany tekst nie zgadza się (bez uwzględniania wielkości liter) z adresem zalogowanego konta.
  3. `POST /api/account` z `{ action: "delete_account", email }`. Serwer **ponownie** porównuje `email` z adresem z sesji — niezgodność to `email_mismatch` (HTTP 400). Warunek z UI nie jest jedynym zabezpieczeniem.
  4. Blokada: właściciel workspace'u zespołowego musi wcześniej przekazać własność lub usunąć workspace → `owns_team` (HTTP 400).
  5. Wpis do `audit_log` (`account.deletion.execute`), e-mail **`account-deleted`** (§20.3 — renderowany inline), a następnie w tym samym żądaniu: usunięcie plików z R2 (prefiksy `ws/<id>/` każdego workspace'u użytkownika i `users/<id>/`) i `auth.admin.deleteUser` → kaskadowe usunięcie profilu, workspace'ów, projektów, assetów i księgi.
  6. Odpowiedź `{ deleted: true, next: "/" }` → klient przekierowuje na stronę główną.

  Anonimizacja `audit_log` / `moderation_events` (user_id → null, treść zachowana 90 dni do celów bezpieczeństwa) i anulowanie subskrypcji w Stripe (`cancel_at_period_end=false`, natychmiast) działają jak wcześniej — wykonuje je trigger `profiles_before_delete` i kaskada.

  **Co zniknęło razem z harmonogramem:** akcje `request_deletion` i `cancel_deletion` w `POST /api/account`, kolumna `profiles.deletion_requested_at` (usunięta z tabeli i z listy chronionych kolumn w triggerze `profiles_restrict_self_update`), funkcja `processAccountDeletions()` w `lib/maintenance.ts`, jej krok w cronie Inngest `retention-cleanup`, zadanie `deletions` w `POST /api/admin/maintenance` oraz e-mail `account-deletion-scheduled` (zastąpiony przez `account-deleted`).

- Retencja logów: Vercel/Inngest wg ich ustawień; nasze `audit_log` 12 miesięcy.
- Podmioty przetwarzające (do wpisania w Privacy Policy): Supabase (EU, Frankfurt), Cloudflare R2 (bucket `plikiveyraflow1`, **location hint `EEUR`** = Europa Wschodnia, ale **`jurisdiction: default`** — location hint to preferencja umiejscowienia, a nie prawna gwarancja przechowywania wyłącznie w UE; twardą gwarancję daje dopiero bucket utworzony z `jurisdiction: eu`, czego nie da się później zmienić — patrz §27 poz. 9b), Vercel, Inngest, Stripe, Resend (EU), OpenAI, fal.ai (uruchamia modele Hyper3D Rodin, Microsoft TRELLIS, ElevenLabs i Google Lyria — dane wejściowe, w tym zdjęcia, trafiają do storage fal), Modal, **Google Ireland Ltd. — Google Analytics 4** (tylko po zgodzie: identyfikator cookie, oczyszczone adresy stron, zdarzenia z §21.6, przybliżona lokalizacja z IP — GA4 nie zapisuje adresów IP; możliwy transfer do USA w ramach EU-US Data Privacy Framework), **Google Cloud — Error Reporting** (dane diagnostyczne błędów bez IP/e-maili/promptów, pseudonimowy ID użytkownika, retencja 30 dni, prawnie uzasadniony interes; §25.4).

### 21.6 Google Analytics 4 (od 2026-09-24)

- **Pliki**: `lib/analytics.ts` (logika), `components/analytics.tsx` (montowany w `app/layout.tsx` obok `CookieBanner`), test `tests/analytics.test.ts`.
- **Włączenie**: tylko gdy `NEXT_PUBLIC_GA_MEASUREMENT_ID` (np. `G-XXXXXXXXXX`) jest ustawione w buildzie **i** cookie `vf_consent` ma `analytics: true`. Bez ID wszystkie funkcje są no-opem, a CSP nie zawiera domen Google.
- **Ładowanie**: po zgodzie `enableAnalytics()` tworzy `window.dataLayer`/`gtag`, wysyła `consent default` (`ad_storage`, `ad_user_data`, `ad_personalization` = `denied`, `analytics_storage` = `granted`), `gtag('set', { page_location, page_referrer })` z oczyszczonym URL-em, `config` z `send_page_view: false`, `allow_google_signals: false`, `allow_ad_personalization_signals: false`, i wstrzykuje `https://www.googletagmanager.com/gtag/js?id=<ID>`. Zgoda udzielona w trakcie wizyty włącza GA od razu (event `vf:consent`), bez przeładowania.
- **Wycofanie zgody** (`disableAnalytics()`): `consent update analytics_storage=denied`, `window['ga-disable-<ID>'] = true`, usunięcie cookies `_ga`, `_ga_*`, `_gid` na hoście i domenach nadrzędnych. Skrypt zostaje w pamięci do przeładowania, ale nic nie wysyła.
- **Page views**: wyłącznie ręczne — `trackPageView()` przy każdej zmianie `usePathname()` (z opóźnieniem 50 ms, żeby `document.title` był już nowej strony), deduplikowane po oczyszczonym URL-u; `page_referrer` = poprzednia oczyszczona strona (pierwsza: `document.referrer`, oczyszczony, jeśli z naszego originu). Wymaga wyłączenia w GA4 „Page changes based on browser history events” (§23.9), inaczej GA liczyłby podwójnie i wysyłał surowe URL-e.
- **Oczyszczanie URL-i** (`sanitizeUrl`): segment ścieżki będący UUID-em albo ciągiem ≥ 20 znaków `[A-Za-z0-9_-]` → `[id]` (tokeny `/s/<token>`, `/invite/<token>`, ID assetów/projektów); query string usuwany w całości (e-maile w `/verify?email=`, `/reset-password?email=`, `next=`) z wyjątkiem `utm_source|medium|campaign|term|content`; hash usuwany. `gtag('set')` sprawia, że także automatyczne zdarzenia (`user_engagement`, `scroll`) niosą oczyszczony URL.
- **Zdarzenia** (`track(name, params)` — tylko enumy/liczby, nigdy PII, prompty ani URL-e z tokenami):

| Zdarzenie | Gdzie | Parametry |
|---|---|---|
| `page_view` | `components/analytics.tsx` | `page_location`, `page_referrer`, `page_title` |
| `login` | `/login` po udanym `signInWithPassword` | `method: "email"` |
| `sign_up` | `/verify` po udanej weryfikacji kodu | `method: "email"` |
| `generate_asset` | generator po utworzeniu joba | `asset_type`, `credits` (zarezerwowane) |
| `begin_checkout` | `/app/billing` przed przekierowaniem do Stripe | `checkout_kind` (`trial`/`pro`/`studio`/`pack_*`) |
| `download_asset` | panel pobierania | `asset_type`, `download_kind` (`file`/`zip`), `engine_preset` (ZIP) |
| `share` | dialog udostępniania po utworzeniu linku | `method: "link"`, `content_type` (`asset`/`project`) |

- **Bez `user_id`** i bez danych konta — GA widzi tylko pseudonimowy identyfikator cookie. `purchase` (Measurement Protocol z webhooka Stripe) nie jest zaimplementowany (roadmapa; wymaga `GA_API_SECRET` i przekazania `client_id` do metadanych sesji Checkout).
- **CSP** (`next.config.ts`, tylko przy ustawionym ID): `script-src https://*.googletagmanager.com`; `img-src https://*.google-analytics.com https://*.googletagmanager.com`; `connect-src https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com` (lista z dokumentacji Google dla gtag.js bez Google Signals).
- **Weryfikacja (2026-09-24, localhost, testowe ID)**: bez zgody brak skryptu, `dataLayer` i cookies `_ga`; po „Accept all” żądania `region1.google-analytics.com/g/collect` z `dl=http://localhost:3000/pricing`, potem `/verify` (bez `?email=`) i `/s/[id]`; po „Necessary only” cookies usunięte, a kolejne nawigacje nic nie wysyłają.

---

## 22. Bezpieczeństwo

- **Sekrety**: tylko env po stronie serwera; test CI: skrypt `scripts/check-public-env.ts` failuje build, jeśli jakakolwiek zmienna `NEXT_PUBLIC_*` zawiera `KEY`/`SECRET`/`TOKEN` (poza dozwoloną listą: `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`) oraz grep w bundlu klienta po nazwach dostawców (w tym `clouderrorreporting.googleapis.com`).
- **RLS** na wszystkim; klient nigdy nie używa service role; service role tylko w `lib/supabase/admin.ts` importowanym wyłącznie w kodzie serwerowym (`server-only`).
- **Kody weryfikacyjne**: CSPRNG, hash SHA-256 z pepperem (`AUTH_CODE_PEPPER`), porównanie stałoczasowe, TTL (10/15 min), max 5 prób, po wykorzystaniu `consumed_at`; jeden aktywny kod per (email, purpose) — nowy unieważnia stary.
- **Rate limiting** (tabela `rate_limits`, okno przesuwne, klucze per IP i per e-mail): signup 5/h/IP, kody 5/h/e-mail i 20/h/IP, login 10/15 min/IP+e-mail, `/api/jobs` 60/h/user, `/api/s/:token` 60/min/IP, uploady 30/h/user, `/api/client-errors` 20/min/IP.
- **Brak enumeracji kont**: identyczne odpowiedzi i czasy (sztuczne opóźnienie) dla signup/forgot.
- **Hasła**: obsługa przez Supabase (bcrypt); polityka min. 10 znaków; sprawdzanie w HaveIBeenPwned (Supabase „leaked password protection” włączone).
- **Sesje**: cookies `HttpOnly`, `Secure`, `SameSite=Lax`; unieważnianie globalne przy resecie hasła i banie.
- **CSRF**: Route Handlers mutujące sprawdzają `Origin`; Server Actions mają wbudowaną ochronę.
- **Nagłówki**: CSP (`default-src 'self'`; `img-src 'self' data: blob: https://*.r2.cloudflarestorage.com <R2 domain>`; `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com <R2>`; `frame-src https://js.stripe.com https://checkout.stripe.com`; `script-src 'self' 'nonce-…' https://js.stripe.com`; przy ustawionym `NEXT_PUBLIC_GA_MEASUREMENT_ID` dodatkowo domeny Google Analytics wg §21.6), HSTS, `X-Content-Type-Options`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`.
- **Uploady**: whitelist MIME + magic bytes, limity (obrazy 10 MB, avatar 2 MB), nazwy plików generowane serwerowo, brak wykonywalnych typów; obrazy re-enkodowane przez sharp przed użyciem (usuwa metadane/EXIF).
- **Webhooki**: weryfikacja podpisów, idempotencja (`stripe_events`, `provider_job_id`), odrzucanie zdarzeń starszych niż 5 min gdzie możliwe.
- **Worker**: bearer token + HMAC odpowiedzi; worker nie ma dostępu do bazy, tylko do presigned URL.
- **Prompt injection do LLM**: prompt użytkownika przekazywany jako dane w polu użytkownika, nigdy w system prompcie; output tłumacza walidowany schematem; tłumacz nie ma narzędzi.
- **Logowanie**: bez promptów w logach Vercel (tylko id joba); PII minimalizowane; błędy → Google Cloud Error Reporting (§25.4) z oczyszczonymi URL-ami, bez IP i e-maili. Sentry nie jest używany.
- **Zależności**: `pnpm audit` w CI, Dependabot.

---

## 23. Konfiguracja usług zewnętrznych — instrukcja odtworzenia

### 23.1 Supabase (stan: projekt istnieje, schemat wdrożony)

**Projekt**: `2DAssets`, ref **`lhwvkhdsoozvsftwhcif`**, org `Akwarium-dziennik`, region `eu-central-1`, Postgres 17.6. URL `https://lhwvkhdsoozvsftwhcif.supabase.co`, publishable key `sb_publishable_Wzbt23q74NoYtMDucWSVww_Zlvy4emW` (w `.env.local`); legacy anon JWT również aktywny. Migracje 0001–0010 zaaplikowane (`supabase_migrations.schema_migrations`), seed wgrany. Kroki 2–5 poniżej są **do zrobienia ręcznie** (§0.3).

1. ~~Utwórz projekt~~ (istnieje). ~~Zapisz `service_role key` do `.env.local`~~ (zrobione).
2. **Auth → Providers**: Email (włączony, „Confirm email” = ON, „Secure email change” ON). Wszystkie providery OAuth (w tym Google) **wyłączone**.
3. **Auth → URL configuration**: Site URL = `APP_URL`; Redirect URLs puste (brak OAuth i linków e-mail Supabase).
4. **Auth → Email templates**: nieużywane (własne e-maile), ale ustaw dowolne, by nie wyciekały domyślne; **Auth → Rate limits** domyślne; **Password**: min length 10, leaked password protection ON.
5. **Auth → Settings**: JWT expiry 3600 s; refresh token rotation ON.
6. Migracje: zaaplikowane przez MCP Supabase (nazwy `veyraflow_0001_…_0011`); lokalne pliki `supabase/migrations/*.sql` są ich odpowiednikiem 1:1 (przy odtwarzaniu od zera: `supabase link --project-ref <ref>` → `supabase db push`). Seed: `supabase/seed.sql` (wgrany). Admin: ręcznie `update profiles set role='admin' where email='…'`.
7. **Realtime**: publikacja `supabase_realtime` zawiera `job_status_feed` (zrobione migracją 0005).
8. **Storage**: nieużywany (pliki w R2) — nie tworzyć bucketów.
9. Włącz **pg_cron**? Nie — harmonogramy obsługuje Inngest.

### 23.2 Cloudflare R2 (stan 2026-09-23: **R2 włączone, bucket istnieje, brakuje tokenu S3**)

0. ✅ R2 włączone w dashboardzie (wymagało metody płatności nawet przy darmowym limicie 10 GB) — 2026-09-22.
1. ✅ Bucket **`plikiveyraflow1`**, location `EEUR` (Europa Wschodnia — spełnia wymóg „dane w UE” z §21.4), storage class Standard, jurisdiction default. Jedyny bucket na koncie; wpisany w `.env` jako `R2_BUCKET`. Nazwa odbiega od pierwotnego planu (§13) — bucket utworzył właściciel ręcznie i nie da się go przemianować.
2. ☐ **API token — czynność ręczna, sekret pokazywany tylko raz i niedostępny przez API**:
   `Dashboard → R2 Object Storage → API → Manage API tokens → Create API token`
   - Permission: **Object Read & Write**
   - Specify bucket(s): **`plikiveyraflow1`** (nie „All buckets”)
   - TTL: forever
   Po utworzeniu strona pokazuje trzy wartości, wszystkie idą do `.env.local`:
   | Na stronie Cloudflare | Zmienna |
   |---|---|
   | `Access Key ID` | `R2_ACCESS_KEY_ID` |
   | `Secret Access Key` | `R2_SECRET_ACCESS_KEY` |
   | `<32-hex>` z `Endpoint for S3 clients: https://<32-hex>.r2.cloudflarestorage.com` (= „Account ID” z R2 → Overview) | `R2_ACCOUNT_ID` |

   `R2_ENDPOINT` zostaje **puste** w `.env` — `lib/env.ts` składa je z `R2_ACCOUNT_ID`. Wpisywać tylko dla endpointu jurysdykcyjnego (np. `https://<account>.eu.r2.cloudflarestorage.com`).
3. ☐ CORS (potrzebny do uploadów z przeglądarki, §13): `Dashboard → bucket → Settings → CORS policy → Add CORS policy`:
   ```json
   [{ "AllowedOrigins": ["http://localhost:3000", "https://veyraflow.eu", "https://*.vercel.app"],
      "AllowedMethods": ["GET", "PUT", "HEAD"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3600 }]
   ```
4. ☐ Lifecycle rules (`bucket → Settings → Object lifecycle rules`): prefix **`downloads/`** → delete po 1 dniu.
   **Uwaga**: reguły lifecycle w R2 dopasowują wyłącznie **prefiks literalny**, bez wildcardów — pierwotnie planowana reguła `ws/*/uploads/` jest niewykonalna przy schemacie kluczy `ws/{workspace_id}/uploads/…` (§13). Tymczasowe uploady sprząta więc aplikacja (`uploads.expires_at` + funkcja `retention/cleanup`, §13). Alternatywa na przyszłość: przenieść klucze uploadów na `uploads/{workspace_id}/…` i dodać drugą regułę lifecycle.
5. Bez custom domeny publicznej (wszystko presigned).
6. Weryfikacja po wklejeniu kluczy: **`pnpm r2:check`** (`scripts/check-r2.ts`) — czyta `.env` + `.env.local`, robi PUT → HEAD → GET → presigned GET (realny `fetch`) → DELETE na kluczu `_healthcheck/<uuid>.txt`, na koniec informacyjnie sprawdza CORS. Typowe błędy tłumaczy na przyczynę (zły account id → endpoint się nie rozwiązuje, `AccessDenied` → token bez Object Read & Write lub zawężony do innego bucketu, `NoSuchBucket` → zła nazwa w `R2_BUCKET`).

### 23.3 Vercel (stan 2026-09-24: **projekt `asset-generator` utworzony i zdeployowany, bez zmiennych środowiskowych** — §0.1)
1. ✅ Projekt **`asset-generator`** (Vercel → *Add New → Project → Import* repo GitHub `janeknastaly580-lang/2DAssets-ai-generator`, root `/`, framework **Next.js**, install/build/output — auto: pnpm wykrywany z `pnpm-lock.yaml`, `next build`). Node: `engines.node: ">=22"` w `package.json` → Vercel używa **24.x**. Region funkcji **`fra1`** (Frankfurt, obok Supabase `eu-central-1`) — ustawiony w projekcie (Settings → Functions → Region) i w **`vercel.json`**:
   ```json
   { "$schema": "https://openapi.vercel.sh/vercel.json", "framework": "nextjs", "regions": ["fra1"] }
   ```
   Branch `main` = Production; pozostałe branche/PR = Preview. Domena Production: `asset-generator-tawny.vercel.app`.
2. ☐ Env (Production/Preview/Development) wg §24; sekrety oznaczone „Sensitive” — **celowo niewpisane** (decyzja właściciela 2026-09-24); instrukcja: §0.3 pkt 13. Build (`next build`) przechodzi bez żadnych zmiennych (zweryfikowane w czystym klonie repo); runtime bez nich zwraca 500.
3. ✅ Fluid compute ON; `export const maxDuration = 300` w `app/api/inngest/route.ts`, `app/api/downloads/route.ts` i `app/api/jobs/route.ts` (w dwóch ostatnich kolejka inline wykonuje pracę w `after()`, więc limit czasu dotyczy całej generacji / budowy ZIP-a).
4. ☐ Domena produkcyjna **`veyraflow.eu`** (apex) + `www.veyraflow.eu` → redirect 308 na apex; DNS (A/CNAME) wg instrukcji Vercel u rejestratora.
5. ☐ Vercel Analytics włączone dopiero po zgodzie cookies (komponent ładowany warunkowo).
6. Crony nie są konfigurowane w Vercel (brak `crons` w `vercel.json`) — harmonogramy (`retention-cleanup`, `expire-credits`, `reset-violation-counters`) obsługuje Inngest (§14.1).
7. Plan **Hobby** (niekomercyjny) — przed uruchomieniem płatności przejść na Pro.

### 23.4 Stripe
1. Produkty i ceny (test + live):
   - `Veyraflow Trial` — one-time, **1,29 USD** (+ PLN równowartość) → `STRIPE_PRICE_TRIAL`
   - `Veyraflow Pro` — recurring monthly, 15,00 USD (+ PLN) → `STRIPE_PRICE_PRO_MONTHLY`
   - `Veyraflow Studio` — recurring monthly, 45,00 USD (+ PLN) → `STRIPE_PRICE_STUDIO_MONTHLY`
   - `Credit Pack 1000` — one-time, X → `STRIPE_PRICE_PACK_1000`
   - `Credit Pack 10000` — one-time, Y → `STRIPE_PRICE_PACK_10000`
   - wszystkie ceny `tax_behavior = exclusive`; metadata na cenach: `credits` (**86**/1000/3200/1000/10000), `kind`.
2. Stripe Tax: włącz, ustaw kraj rejestracji firmy (Polska), rejestracje VAT (PL + OSS UE).
3. Customer Portal: pozwól na zmianę planu między Pro/Studio (proration), anulowanie na koniec okresu, aktualizację metody płatności, historię faktur.
4. Webhook endpoint `https://veyraflow.eu/api/webhooks/stripe` z eventami z §11.6 → `STRIPE_WEBHOOK_SECRET`.
5. Checkout: tryb hostowany (`ui_mode: 'hosted'`), `customer_creation: 'always'`, `billing_address_collection: 'required'` (dla Stripe Tax). Żadnych Stripe Elements / Payment Element w aplikacji — dane kart obsługuje wyłącznie Stripe.
6. Radar (opcjonalnie, w całości po stronie Stripe): wbudowane reguły antyfraudowe; ewentualna reguła ograniczająca wielokrotne zakupy `Trial` z tej samej karty konfigurowana w Stripe Dashboard — aplikacja nie otrzymuje ani nie przechowuje żadnych danych karty. Ograniczenie „raz na konto” egzekwuje aplikacja (`trial_used_at`, `stripe_customer_id`).
7. Lokalnie: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`.

### 23.5 Resend — odtworzenie konfiguracji od zera

Kolejność ma znaczenie: klucza API nie da się później przepiąć na inną domenę.

1. **Domena.** Resend → Domains → Add Domain → `veyraflow.eu`, region **eu-west-1** (dane zostają w UE, §21). Resend wygeneruje rekordy **DKIM (TXT)**, **SPF (TXT/MX)** i opcjonalnie **DMARC** — dodać je u rejestratora domeny, potem „Verify”. Status musi być `verified`, sending `enabled`.
2. **Klucz API.** Resend → API Keys → Create API Key: nazwa `veyraflow-app-sending-eu`, permission **Sending access**, **Domain: `veyraflow.eu`**. Token pokazywany jest **tylko raz** — wkleić do `.env.local` jako `RESEND_API_KEY` (na Vercelu: zmienna oznaczona „Sensitive”).
   > Ograniczenie domeny i poziom uprawnień są **niezmienne po utworzeniu** — API pozwala zmienić tylko nazwę klucza. Klucz ograniczony do innej domeny zwróci przy wysyłce `403 „This API key is not authorized to send emails from veyraflow.eu”`.
3. **Nadawca.** `EMAIL_FROM="Veyraflow <website@veyraflow.eu>"` w `.env` (nie jest sekretem). Ta sama wartość jest fallbackiem w `lib/env.ts`, więc brak zmiennej nie przełącza wysyłki na inną domenę.
4. **Szablony.** Utworzyć i **opublikować** 7 szablonów z tabeli w §20.1 — aliasy muszą się zgadzać z `TEMPLATE_IDS` w `lib/email/resend.ts` (kod wysyła po ID, więc po odtworzeniu w nowym koncie trzeba wpisać nowe ID). Szablonów dla aliasów `job-completed` i `account-deleted` **nie tworzyć** — te e-maile renderuje kod (§20.3).
   - `signin` / `preset` mają wspólny layout (§20.3): tło `#0b0b0f`, karta `#15151c`, pasek akcentu `#7C5CFF`, wordmark „Veyraflow.”, eyebrow, nagłówek 24 px, akapit 15 px, **kod 38 px, `letter-spacing: 8px`, monospace, w ramce `#0e0e14` z obwódką `#2c2c3a`**, informacja o czasie ważności (10 min / 15 min), separator i nota bezpieczeństwa. Zmienne: `{{{CODE}}}` i `{{{PRESET}}}`. Tematy: „Verification” i „Password reset”.
5. **Weryfikacja.** Wysłać próbny e-mail przez API z `from = EMAIL_FROM`; odpowiedź `200` z `id` oznacza poprawną parę klucz↔domena. Adresy testowe Resend: `delivered@resend.dev`, `bounced@resend.dev`, `complained@resend.dev`.
6. **Opcjonalnie:** Supabase Auth → SMTP przez Resend (`smtp.resend.com:465`, user `resend`, hasło = klucz API, sender `website@veyraflow.eu`) dla wbudowanych e-maili Supabase — aplikacja ich nie używa (§5).

### 23.6 Inngest
- Aplikacja w Inngest Cloud, połączona z Vercel (integracja) → `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`. Lokalnie: `npx inngest-cli@latest dev`.

### 23.7 Modal (worker)
- Konto Modal, `modal token new`; `modal deploy worker/modal_app.py` → URL endpointów → `MODAL_WORKER_URL`; sekret `MODAL_WORKER_TOKEN` (losowy, ustawiony w Modal Secrets i w Vercel), `WORKER_WEBHOOK_SECRET`; w Modal Secrets także dane R2 (do PUT/GET przez presigned nie są potrzebne — worker dostaje presigned URL; zostawić bez kluczy R2).

### 23.8 Dostawcy AI
| Dostawca | Co skonfigurować | Env |
|---|---|---|
| OpenAI | klucz API; modele: `PROMPT_TRANSLATOR_MODEL`, `MODERATION_MODEL` | `OPENAI_API_KEY` |
| fal.ai | konto na https://fal.ai → **Dashboard → Keys → Create key** (zakres API) → wartość `<key_id>:<secret>` do `.env.local` jako `FAL_KEY`; **Billing**: konto musi mieć dodatnie saldo (inaczej `403 User is locked. Reason: Exhausted balance`). Wszystkie 6 endpointów z §9.7 działają na tym jednym kluczu, żadnej osobnej konfiguracji modeli. Webhook `APP_URL/api/webhooks/fal` opcjonalny (pipeline'y odpytują kolejkę) | `FAL_KEY` (+ opcjonalnie `FAL_WEBHOOK_SECRET`) |

Meshy i bezpośrednie API ElevenLabs **nie są używane** (od 2026-09-23 modele ElevenLabs idą przez fal.ai).

### 23.9 Google Analytics 4 (stan 2026-09-24: **kod gotowy, właściwość GA4 nieutworzona**)

Firebase **nie jest potrzebny** — to aplikacja webowa, gtag.js wysyła dane bezpośrednio do właściwości GA4 (§21.6). Kroki (właściciel, w przeglądarce):

1. https://analytics.google.com → **Admin** (koło zębate) → **Create → Account** (nazwa np. `Veyraflow`; w *Data sharing settings* odznaczyć wszystkie opcje) → **Property**: nazwa `Veyraflow`, strefa czasowa *Poland*, waluta *US Dollar* (ceny w USD, §11) → *Business details* / *Business objectives* → **Create** → akceptacja warunków GA (region: Poland) wraz z **Data Processing Terms** (RODO).
2. **Choose a platform → Web**: URL `https://asset-generator-tawny.vercel.app` (docelowo `veyraflow.eu`), nazwa strumienia `Veyraflow Web`. Przed **Create stream** kliknąć koło zębate przy *Enhanced measurement*: zostawić **Page views** i (opcjonalnie) **Scrolls**; **wyłączyć** *Outbound clicks*, *Site search*, *Form interactions*, *Video engagement*, **File downloads** (link_url z presigned URL-em R2 = podpis dostępu do pliku); w *Page views → Show advanced settings* **odznaczyć „Page changes based on browser history events”** (page_view wysyła kod; inaczej duplikaty i surowe URL-e z tokenami). Skopiować **Measurement ID** `G-XXXXXXXXXX` (instrukcji instalacji tagu nie wykonywać — kod już jest).
3. Strumień → **Redact data**: włączyć *Email* oraz *Query parameters* z listą `email, next, token, code` (druga warstwa obok `sanitizeUrl`).
4. Strumień → **Configure tag settings → Show more → List unwanted referrals**: warunek *Referral domain contains* `stripe.com` (powrót z Checkout/Portal nie może zaczynać nowej sesji ze źródłem „stripe”).
5. **Admin → Data collection and modification**: *Data collection* → **Google signals** = OFF (kod i tak wysyła `allow_google_signals: false`); *Data retention* → **14 months**.
6. **Admin → Data display → Custom definitions**: wymiary niestandardowe (zakres *Event*): `asset_type`, `download_kind`, `engine_preset`, `checkout_kind`; metryka niestandardowa (zakres *Event*, jednostka *Standard*): `credits`. (`method` i `content_type` są wymiarami wbudowanymi.)
7. **Admin → Data display → Key events → New key event**: `sign_up`, `begin_checkout`, `generate_asset`.
8. **Vercel** → projekt `asset-generator` → **Settings → Environment Variables → Add**: `NEXT_PUBLIC_GA_MEASUREMENT_ID` = `G-XXXXXXXXXX`, środowisko **tylko Production** (Preview i localhost bez ID = bez zaśmiecania danych), bez „Sensitive” (wartość publiczna) → **Deployments → ⋯ → Redeploy** (ID i CSP są wkompilowywane w build). Lokalnie zmienna zostaje pusta.
9. **Test**: okno incognito → strona produkcyjna → baner → **Accept all** → GA4 **Reports → Realtime** pokazuje użytkownika w ciągu ~30 s; ścieżki w stylu `/s/[id]`, bez `?email=`. W DevTools → Console brak błędów CSP; w Network żądania `…google-analytics.com/g/collect`. Po **Cookie settings → Necessary only** żądania ustają, cookies `_ga*` znikają.
10. **Dokumenty prawne** (§21.2, §27 poz. 20): w Privacy Policy i Cookie Policy dopisać Google Analytics 4 (Google Ireland Ltd.), cookies `_ga` i `_ga_<ID>` (do 2 lat), cel (statystyka użycia), podstawa: zgoda (art. 6 ust. 1 lit. a RODO), wycofanie przez „Cookie settings”.

### 23.10 Google Cloud Error Reporting (stan 2026-09-24: **kod gotowy, projekt GCP i klucz nieutworzone**)

Zamiennik Firebase Crashlytics dla weba (§25.4). Projekt Firebase **jest** projektem Google Cloud — jeśli właściciel ma już projekt Firebase dla Veyraflow, można użyć jego *Project ID* i pominąć pkt 1.

1. https://console.cloud.google.com → wybór projektu (górny pasek) → **New project**: nazwa `Veyraflow`, zanotować **Project ID** (np. `veyraflow-prod`; to on idzie do `GCP_PROJECT_ID`, nie nazwa ani numer projektu) → **Create**.
2. **APIs & Services → Library** → wyszukać **Error Reporting API** (`clouderrorreporting.googleapis.com`) → **Enable**. Error Reporting nie ma osobnego cennika (retencja 30 dni); jeśli konsola zażąda konta rozliczeniowego, podpiąć je (Billing → Link a billing account) i ustawić budżet z alertem (Billing → Budgets & alerts, np. 1 USD).
3. **APIs & Services → Credentials → + Create credentials → API key**. Po utworzeniu **Edit API key**: nazwa `veyraflow-error-reporting`; *Application restrictions* = **None** (klucz jest używany tylko z serwerów Vercela, które nie mają stałych IP); *API restrictions* = **Restrict key → Error Reporting API** → **Save**. Skopiować klucz (`AIza…`).
4. **Vercel** → projekt `asset-generator` → **Settings → Environment Variables**: `GCP_PROJECT_ID` = Project ID (zwykła zmienna) i `GCP_ERROR_REPORTING_API_KEY` = klucz (**Sensitive**); środowiska: **Production** (opcjonalnie Preview — wtedy błędy mają wersję `preview-<sha>`). Lokalnie nie wpisywać (błędy dev nie zaśmiecają raportów). → **Redeploy**.
5. **Powiadomienia**: https://console.cloud.google.com/errors → **Configure notifications** → kanał e-mail (Monitoring → Notification channels → Email, np. `support@veyraflow.eu`) → Error Reporting wysyła e-mail przy **nowej grupie błędów** i przy jej powrocie po oznaczeniu jako rozwiązana.
6. **Test**: na produkcji w konsoli przeglądarki (DevTools) wpisać `setTimeout(() => { throw new Error("Veyraflow Error Reporting test") })` → w Network `POST /api/client-errors` = 204 → po ~1 min błąd widoczny w https://console.cloud.google.com/errors (serwis `veyraflow-browser`, wersja `production-<sha>`); oznaczyć go jako *Resolved*. Błędy serwera pojawiają się jako `veyraflow-server`. Brak wpisu → Vercel → **Logs**, filtr `error-reporting` (np. `HTTP 403` = zła restrykcja klucza lub API niewłączone, `HTTP 400 API_KEY_INVALID` = zły klucz, `404` = zły Project ID).
7. **Dokumenty prawne** (§27 poz. 20): w Privacy Policy dopisać Google Cloud (Google Ireland Ltd.) jako podmiot przetwarzający dane diagnostyczne (treść błędu, stack trace, adres strony bez parametrów, user-agent, pseudonimowy ID użytkownika; 30 dni; prawnie uzasadniony interes).
8. Opcjonalnie usunąć z `.env.local` nieużywaną pozostałość `SENTRY_DSN`.

---

## 24. Zmienne środowiskowe

Podział plików: `.env` (wartości jawne) i `.env.local` (sekrety) — patrz §0.2; `.env.example` to szablon obu. **Od 2026-09-23 wszystkie trzy pliki są w `.gitignore`** (`.env*.local`, `.env`, `.env.example`) — przy odtwarzaniu projektu trzeba je utworzyć ręcznie wg tej sekcji. **Publiczne** (dozwolone w przeglądarce):
```
NEXT_PUBLIC_APP_URL=https://veyraflow.eu
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=      # tylko jeśli używamy Stripe.js (opcjonalne)
NEXT_PUBLIC_GA_MEASUREMENT_ID=           # G-XXXXXXXXXX z GA4 (§23.9); puste = analityka wyłączona. Wkompilowywane w build → po zmianie redeploy
```
**Serwerowe** (nigdy w kliencie). Oznaczone `[S]` = sekret → `.env.local` / Vercel „Sensitive”; pozostałe → `.env` / zwykłe zmienne Vercel:
```
APP_URL=https://veyraflow.eu
SUPABASE_SERVICE_ROLE_KEY=                # [S]
SUPABASE_DB_URL=                          # [S] tylko dla migracji/CLI
AUTH_CODE_PEPPER=                         # [S] także klucz HMAC podpisanych linków lokalnego storage
TOS_VERSION=2026-09-20
MOCK_PROVIDERS=false                      # true = pipeline'y zwracają lokalne placeholdery (§0.4), bez kosztów; brak FAL_KEY i OPENAI_API_KEY też włącza mock
INNGEST_DEV=                              # 1 = wysyłaj eventy do lokalnego `npx inngest-cli dev` zamiast trybu inline

OPENAI_API_KEY=                           # [S]
PROMPT_TRANSLATOR_MODEL=gpt-5.6-luna      # zweryfikować ID modelu w OpenAI
MODERATION_MODEL=gpt-5-nano               # najtańszy model OpenAI (nano/mini) — zweryfikować ID
FAL_KEY=                                  # [S] wszystkie modele generujące (§9.7)

R2_ACCOUNT_ID=                            # [S]
R2_ACCESS_KEY_ID=                         # [S]
R2_SECRET_ACCESS_KEY=                     # [S]
R2_BUCKET=plikiveyraflow1                 # jedyny bucket na koncie (§23.2); puste R2_ACCOUNT_ID/KEY/SECRET = sterownik lokalny
R2_ENDPOINT=                              # zostawić puste — wyliczane z R2_ACCOUNT_ID (lib/env.ts)

STRIPE_SECRET_KEY=                        # [S]
STRIPE_WEBHOOK_SECRET=                    # [S]
STRIPE_PRICE_TRIAL=
STRIPE_PRICE_PRO_MONTHLY=
STRIPE_PRICE_STUDIO_MONTHLY=
STRIPE_PRICE_PACK_1000=
STRIPE_PRICE_PACK_10000=

RESEND_API_KEY=                           # [S]
EMAIL_FROM="Veyraflow <website@veyraflow.eu>"   # domena veyraflow.eu zweryfikowana w Resend; RESEND_API_KEY musi być kluczem dopuszczonym dla tej domeny
SUPPORT_EMAIL=support@veyraflow.eu
TRIAL_CREDITS=86

INNGEST_EVENT_KEY=                        # [S]
INNGEST_SIGNING_KEY=                      # [S]

MODAL_WORKER_URL=
MODAL_WORKER_TOKEN=                       # [S]
WORKER_WEBHOOK_SECRET=                    # [S]
FAL_WEBHOOK_SECRET=                       # [S] jeśli fal wymaga własnego sekretu w URL

GCP_PROJECT_ID=                           # Project ID z Google Cloud (§23.10); puste = raportowanie błędów wyłączone
GCP_ERROR_REPORTING_API_KEY=              # [S] klucz API ograniczony do Error Reporting API
```

---

## 25. Środowisko developerskie, testy, wdrożenie

### 25.1 Lokalnie (stan faktyczny)
```bash
pnpm install                      # Node 22+ (używany 24), pnpm 10 (na Windows: pnpm.cmd)
#  .env.local już istnieje — uzupełnić SUPABASE_SERVICE_ROLE_KEY (§0.3 pkt 1)
pnpm dev                          # http://localhost:3000 (schemat w chmurowym projekcie Supabase; `supabase start` nie jest wymagane)
pnpm typecheck && pnpm test && pnpm build
pnpm check:public-env             # po build: skan .env* i bundla klienta (§22)
pnpm r2:check                     # round-trip na bucketcie R2 (§23.2); bez kluczy R2_* kończy się instrukcją, skąd je wziąć
# opcjonalnie:
INNGEST_DEV=1 pnpm dev  +  pnpm inngest:dev        # kolejka przez lokalny Inngest zamiast inline
stripe listen --forward-to localhost:3000/api/webhooks/stripe
cd worker && modal serve modal_app.py              # URL dev do MODAL_WORKER_URL
```
Odtworzenie bazy od zera: `supabase link --project-ref <ref>` → `supabase db push` → wgrać `supabase/seed.sql` (lub `supabase start` + `supabase db reset` dla lokalnego stacku; `config.toml` gotowy).

Od 2026-09-23 `.env` ma `MOCK_PROVIDERS=false` — generacje idą do fal.ai i kosztują (§9.7). Aby rozwijać i testować UI oraz pipeline bez kosztów, ustaw `MOCK_PROVIDERS=true`: pipeline'y generują wtedy placeholdery lokalnie (§0.4). Pliki lądują w `.data/storage/` (gitignore).

### 25.2 Testy
- Unit (Vitest) — **zrobione**: `tests/postprocess.test.ts` (packer atlasu + `.tres`, kwantyzacja palety, WAV/normalizacja/loop, GLB writer/split, presety silników) `tests/validation.test.ts` (schematy zod auth/jobs/style guide, kontrakty tłumacza i moderacji) `tests/email.test.ts` (routing alias→szablon Resend vs. renderer inline, escaping wartości użytkownika, odrzucanie linków spoza `http(s)`) i `tests/falModels.test.ts` (§9.7: routing endpointów, mapowanie parametrów UI → fal dla Rodina/TRELLIS/SFX/Lyrii/TTS, pierwszeństwo ustawień ręcznych nad `model_params`, odrzucanie niepoprawnych wartości LLM, reguły TRELLIS i zakres `speed`, koszty, kontrakt tłumacza z `model_params`) i `tests/analytics.test.ts` (§21.6: oczyszczanie URL-i dla GA4 — tokeny/UUID → `[id]`, usuwanie query poza `utm_*`) i `tests/errorReporting.test.ts` (§25.4: format `message`/`reportLocation`, dokładny URL i treść `events:report` przy zamockowanym `fetch`, no-op bez konfiguracji, brak wyjątku przy awarii sieci, filtr szumu przeglądarki) — **44 testy**. `tests/validation.test.ts` pilnuje też, że `ASSET_TYPES` zawiera dokładnie 4 typy po usunięciu generatorów 2D (§9.0) i sprawdza domyślne wartości `model3dInputSchema`. Księga kredytów przetestowana skryptem SQL bezpośrednio na projekcie (§0.1). Do dodania: webhook Stripe (fixtures), testy adapterów z `msw`.
- Integracyjne: pipeline'y z `msw` mockami dostawców; Inngest `InngestTestEngine`.
- E2E (Playwright) — **do dodania**: rejestracja z kodem (kod odczytywany z bazy w teście), logowanie, tworzenie projektu, generacja obrazu (mock), pobieranie ZIP, checkout (Stripe test mode).
- CI (GitHub Actions) — do dodania (repo nie jest jeszcze w git): lint, typecheck, unit, `check-public-env`, build; e2e na PR do `main`.

### 25.3 Wdrożenie
- Branch `main` → Production (Vercel), PR → Preview (z Supabase branch lub projektem dev; Inngest branch envs).
- Migracje: `supabase db push` w kroku CI przed deployem produkcyjnym (ręczne zatwierdzenie).
- Worker: `modal deploy` z CI po zmianach w `worker/`.
- Monitoring: Vercel logs, Inngest dashboard, Stripe dashboard, **Google Cloud Error Reporting** (§25.4, powiadomienia e-mail o nowych błędach), alert e-mail przy > 10% failed jobs/h (Inngest failure handler → `send-email` do `SUPPORT_EMAIL`).

### 25.4 Raportowanie błędów — Google Cloud Error Reporting (od 2026-09-24)

**Dlaczego nie Firebase Crashlytics:** Crashlytics obsługuje tylko Apple, Android, Flutter i Unity — nie ma SDK dla aplikacji webowych. Decyzja właściciela (2026-09-24): odpowiednik z ekosystemu Google, **Google Cloud Error Reporting** (grupowanie błędów po stack trace, liczniki wystąpień i dotkniętych użytkowników, powiadomienia e-mail o nowych błędach, retencja 30 dni). Ograniczenie: brak source map — błędy z przeglądarki pokazują zminifikowane pliki `/_next/static/chunks/*.js`.

- **Transport**: `lib/errorReporting.ts` (`server-only`) → `POST https://clouderrorreporting.googleapis.com/v1beta1/projects/<GCP_PROJECT_ID>/events:report?key=<GCP_ERROR_REPORTING_API_KEY>` (uwierzytelnienie kluczem API — obsługiwane przez Error Reporting API). Timeout 4 s, nigdy nie rzuca (błąd transportu → `console.warn "[error-reporting] …"`). Bez obu zmiennych — no-op (`integrations.errorReporting`). Bez SDK Google (sam `fetch`, działa też w runtime edge).
- **Payload** (`ReportedErrorEvent`): `eventTime`; `serviceContext.service` = `veyraflow-server` lub `veyraflow-browser`, `serviceContext.version` = `<VERCEL_ENV|local>-<7 znaków VERCEL_GIT_COMMIT_SHA>` (np. `production-abcdef1`); `message` = `err.stack` w formacie V8 (`TypeError: msg\n    at fn (file:l:c)`) — po nim Error Reporting grupuje; `context.reportLocation` = pierwsza ramka stosu (V8 lub Firefox/Safari `fn@file:l:c`), a gdy jej brak — etykieta `where` z `lineNumber: 0`; `context.httpRequest` = metoda, **oczyszczony URL** (`sanitizeUrl` z §21.6 — bez tokenów i query), user-agent, referer, status; `context.user` = UUID użytkownika Supabase (tylko dla zgłoszeń, gdzie jest znany). Bez IP, e-maili i promptów.
- **Źródła po stronie serwera**:
  - `instrumentation.ts` → `onRequestError` (Next.js): nieprzechwycone błędy renderowania RSC, Server Actions, middleware i Route Handlerów bez wrappera (`/api/webhooks/*`, `/api/files`);
  - `lib/api.ts: fail(err, req)` — każdy 500 `internal_error` z Route Handlerów opakowanych w `handler()` (`ApiError`, `ZodError`, `ConfigError` nie są raportowane), wysyłka w `after()` po odpowiedzi;
  - `lib/pipelines/run.ts` — nieudany job, jeśli błąd **nie** jest `JobFailure` (czyli błąd kodu albo `ProviderError` inny niż `provider_policy`, np. wyczerpane saldo fal.ai); `where = "pipeline <typ>"`, `user` = właściciel joba;
  - `lib/queue/dispatch.ts` (błąd poza pipeline'em w kolejce inline, eksport danych), `lib/downloads.ts` (ZIP), `app/api/webhooks/stripe/route.ts` (błąd handlera zdarzenia).
- **Źródła po stronie przeglądarki**: `components/error-reporter.tsx` (montowany w `app/layout.tsx`; `window` `error` + `unhandledrejection`), `app/error.tsx` i nowy `app/global-error.tsx` (błędy root layoutu) → `lib/client/reportError.ts` → `POST /api/client-errors` (`fetch` z `keepalive`). Błędy z `digest` (rzucone przy renderowaniu na serwerze) są pomijane w przeglądarce — raportuje je `onRequestError`. Filtr szumu `shouldIgnore`: `Script error.` bez obiektu błędu, `AbortError`, `ResizeObserver loop`, stosy z `*-extension://`, `ApiClientError` ze statusem < 500. Deduplikacja w obrębie strony (nazwa + treść + pierwsza ramka), maks. 10 zgłoszeń na załadowanie strony.
- **`POST /api/client-errors`** (`app/api/client-errors/route.ts`): `requireSameOrigin`, bez konfiguracji → od razu 204; rate limit 20/min/IP (`LIMITS.clientErrorsPerIp`, gdy jest service role); walidacja `clientErrorSchema` (`kind`, `name` ≤ 100, `message` ≤ 1000, `stack` ≤ 8000, `url` ≤ 2000 znaków); dołącza `user` z sesji Supabase (jeśli zalogowany); raport w `after()`; odpowiedź **204**.
- **Zgoda**: nie wymaga zgody cookies — brak cookies i brak żądań z przeglądarki do domen trzecich (przeglądarka rozmawia tylko z naszym API). Podstawa: prawnie uzasadniony interes (stabilność usługi); do opisania w Privacy Policy (§21.5).
- **CSP**: bez zmian (przeglądarka nie łączy się z Google). `check-public-env` sprawdza, że `clouderrorreporting.googleapis.com` nie trafia do bundla klienta.
- **Weryfikacja (2026-09-24, localhost, fikcyjny projekt i klucz)**: tymczasowe trasy rzucające błąd (bez wrappera i z `handler()`) oraz błędy JS/odrzucony Promise w przeglądarce → 5 wywołań `events:report`, każde odrzucone przez Google `400 API_KEY_INVALID` (oczekiwane przy fikcyjnym kluczu), `POST /api/client-errors` → 204; testy jednostkowe `tests/errorReporting.test.ts` sprawdzają dokładny URL i treść żądania (fetch zamockowany). Trasy testowe usunięte.

---

## 26. Roadmapa (poza MVP)

1. Animacje 2D w 4/8 kierunkach przez tor 3D→2D (model 3D + rig + render ortograficzny) oraz PixelLab API dla pixel-artu; postacie czworonożne; upload własnych klipów BVH.
2. Edycja obrazów: upscale 2×/4×, inpainting, outpainting, warianty; tilesety z auto-tile (47-tile blob), podgląd map.
3. Generowanie „zestawów” (np. cały pakiet UI, zestaw ikon 20 szt. w jednym stylu) jako batch.
4. Public REST API + klucze API użytkowników; plugin Unity/Godot.
5. Galeria publiczna / remix; polubienia.
6. Więcej logowań (GitHub, Discord), magic link, 2FA.
7. i18n (PL i inne), light-theme dopracowanie.
8. Refund Policy jako osobna strona; faktury własne; dodatkowe miejsca w zespole; plan Enterprise.
9. Generowanie `.meta` dla Unity (pocięte sprite'y), pakiety `.unitypackage`, Unreal `.uasset` — badanie wykonalności.
10. Voice cloning (ElevenLabs) — wymaga zgód i weryfikacji.
11. Wersjonowanie assetów i porównywanie wariantów; komentarze w zespole.

---

## 27. Otwarte decyzje / placeholdery do uzupełnienia

Rozstrzygnięte (2026-09-20): domena `veyraflow.eu`; trial 1,29 USD netto (przed VAT, `tax_behavior: exclusive`) / 86 kredytów / 30 dni / raz na konto, bez danych kart po naszej stronie; progi moderacji 3 (ostrzeżenie) / 12 (ban); dwa okienka kredytów — Subscription credits resetowane co miesiąc do 1000 (Pro) / 3200 (Studio), Usage credits z pakietów bez resetu; nazwa szablonu `SIGNIN` pochodzi od „sign in” i zostaje.

Rozstrzygnięte (2026-09-23): **wszystkie modele generujące przez fal.ai** (§9.7) — Rodin Gen-2.5 i TRELLIS (3D), ElevenLabs Sound Effects v2, Lyria 3 Pro (jedyny silnik muzyki; selektor Engine usunięty), ElevenLabs TTS Turbo v2.5 (select modelu TTS usunięty, `speed` 0.7–1.2); TRELLIS wymaga dokładnie jednego zdjęcia; Meshy usunięty (rigging/animacje przejdą na model fal.ai wybrany później); parametry modeli spoza UI ustawia LLM tłumacza (`model_params`).

Rozstrzygnięte (2026-09-22): **generatory `image` i `sprite_animation` usunięte z produktu** (§9.0) — Veyraflow to teraz 3D + audio; 3D przyjmuje prompt i/lub do 3 zdjęć (trial 1), ma selektor **Engine** zamiast Category i nie ma pola `art_style`; SFX maks. **10 s**; TTS bez katalogu głosów, z obowiązkowym polem `Instructions` i listą języków; **usuwanie konta jest natychmiastowe** i potwierdzane wpisaniem własnego adresu e-mail (bez 14-dniowej karencji).

| # | Temat | Stan / propozycja |
|---|---|---|
| 1 | Domena e-mail marki w Resend | **zrobione** (2026-09-22): `veyraflow.eu` zweryfikowana, nadawca `website@veyraflow.eu` |
| 2 | Ceny pakietów X (1000 kr.) i Y (10 000 kr.) | sugestia 19 USD / 79 PLN i 149 USD / 599 PLN (netto) |
| 3 | Liczba kredytów Pro/Studio | 1000 / 3200 (marża ~33% / ~29%) — do akceptacji |
| 4 | Dokładne ID modelu OpenAI „gpt 5.6 luna” i taniego modelu moderacji | zweryfikować w dokumentacji OpenAI |
| 5 | Kolor marki, logo | placeholder `#7C5CFF` |
| 6 | Dane firmy do Impressum, minimalny wiek użytkownika | do dostarczenia przez właściciela |
| 7 | Treści dokumentów prawnych | do napisania przed startem (na razie placeholdery) |
| 8 | Szablony Resend `SIGNIN` / `PRESET` — design | **zrobione** (2026-09-22): brandowany ciemny layout z dużym kodem, logika i zmienne bez zmian |
| 9 | Cloudflare R2: token S3 (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`) | R2 włączone i bucket `plikiveyraflow1` gotowy (2026-09-22); **token tworzy właściciel ręcznie w dashboardzie** — sekret pokazywany raz, nie ma API do jego utworzenia (§23.2 pkt 2). Do tego czasu storage lokalny. Po wklejeniu: `pnpm r2:check`. Osobno: CORS (§23.2 pkt 3) i lifecycle `downloads/` (§23.2 pkt 4) |
| 9b | Rezydencja danych: bucket ma `jurisdiction: default` | `location hint EEUR` to tylko preferencja umiejscowienia. Jeśli Privacy Policy ma deklarować przechowywanie plików wyłącznie w UE, trzeba utworzyć bucket z **`jurisdiction: eu`** (endpoint `https://<account>.eu.r2.cloudflarestorage.com` → wtedy `R2_ENDPOINT` wpisujemy jawnie) i przenieść do niego dane — jurysdykcji nie da się zmienić po utworzeniu (§21.4, §23.2) |
| 9a | Nazwa bucketu odbiega od konwencji i nie ma rozdziału dev/prod | `plikiveyraflow1` zamiast `veyraflow-assets(-dev)`; R2 nie pozwala na zmianę nazwy — decyzja właściciela, czy przed produkcją utworzyć drugi bucket i ustawić `R2_BUCKET` per środowisko na Vercelu (§13) |
| 10 | `SUPABASE_SERVICE_ROLE_KEY` w `.env.local` | **zrobione** (wklejony przez właściciela 2026-09-20) |
| 11 | Silniki 3D Rodin Gen-2.5 i TRELLIS | **zrobione** (2026-09-23): oba na fal.ai (§9.3, §9.7), `provider = 'fal'` |
| 12 | Ceny kredytów dla silników 3D i muzyki | startowo Rodin 45 / TRELLIS 25 kr.; koszt fal to 0,40 / 0,02 USD (≈ 40 / 2 kr.) — TRELLIS ma dużą marżę, Rodin prawie zerową. Lyria kosztuje stałe 0,08 USD, a kredyty rosną z żądaną długością (35–150). Do kalibracji w `model_pricing` (panel admina) |
| 13 | Głos TTS | **rozstrzygnięte** (2026-09-23): głos wybiera LLM tłumacza z 21 presetów na podstawie `Instructions`; do czasu podłączenia LLM — domyślny Rachel (§9.6) |
| 14 | Stary klucz Resend `veyraflow-app-sending` (dla `comitraapp.pl`) | nieużywany — do usunięcia z konta Resend |
| 15 | **Model fal.ai do rigowania i animacji 3D** | do wyboru przez właściciela. Do tego czasu: Rodin generuje postać w T/A-pose, `rig_status = 'not_connected'`, dodatki rig/animacje nie są naliczane (`provider = 'unbound'`), UI pokazuje „coming soon”. Po wyborze: adapter/builder w `lib/ai/falModels.ts` + krok w `runModel3dPipeline`, `provider = 'fal'` w obu wierszach |
| 16 | **Saldo konta fal.ai** | 2026-09-23 konto zablokowane („Exhausted balance”) — właściciel doładowuje w Dashboard → Billing (§0.3 pkt 9); potem test na żywo wszystkich 6 endpointów |
| 17 | Podłączenie LLM tłumacza (OpenAI) | kontrakt gotowy (`model_params`, §8.3); do zrobienia: `OPENAI_API_KEY`, weryfikacja ID modelu `gpt-5.6-luna` i wsparcia `minimum`/`maximum` w strict JSON Schema |
| 18 | Tekst strony głównej o 3D | kafelek „3D models & characters” obiecuje „auto-rigging and animations” — nieaktualne, dopóki poz. 15 nie jest zrobiona |
| 19 | Tekstury 1K w Rodinie | Rodin nie ma opcji 1K — przy 1K dostawca oddaje 2K (TRELLIS obsługuje 1K przez `texture_size = 1024`); ewentualne skalowanie tekstur w post-processingu do decyzji |
| 20 | Privacy Policy / Cookie Policy a analityka i raportowanie błędów | przed włączeniem `NEXT_PUBLIC_GA_MEASUREMENT_ID` na produkcji dopisać Google Analytics 4 (cookies, cel, podstawa prawna, odbiorca Google Ireland) — §23.9 pkt 10; po włączeniu Error Reporting dopisać Google Cloud jako podmiot przetwarzający dane diagnostyczne — §23.10 pkt 7 |

---

## 28. Checklista odtworzenia projektu od zera

1. ✅ Repo wg struktury §4.2 (Next.js 15.5, TS, Tailwind 4, biblioteki z §4.1; `pnpm install`).
2. ✅ Supabase (§23.1): migracje `supabase/migrations/0001–0010` (tabele, enumy, triggery, RPC, RLS, `job_status_feed` + Realtime), seed. ☐ Ustawienia Auth w dashboardzie (Confirm email, Google wyłączone, leaked-password, Site URL) — ręcznie.
3. ✅ Auth (§5) z kodami 6/8-cyfrowymi i Resend (§20); tylko e-mail + hasło (bez OAuth).
3a. ✅ Migracja `20260922000012_remove_image_animation_voices.sql` — usuwa wiersze `model_pricing`/`feature_flags` wycofanych generatorów (§9.0), dodaje `model3d.engine.rodin`/`model3d.engine.trellis`, kasuje tabelę `voice_cache` i kolumnę `profiles.deletion_requested_at` wraz z aktualizacją triggera `profiles_restrict_self_update` (§21.5).
3b. ✅ Migracja `20260923000013_fal_models.sql` — cennik pod fal.ai (§11.2): endpointy fal w `model_pricing`, wiersze `music.lyria3.*`, usunięte wiersze ElevenLabs Music / Stable Audio / eleven_v3, rig/animacje `unbound`, pusty payload flagi muzyki. `seed.sql` odzwierciedla ten stan.
4. ✅ Workspace'y, role, zaproszenia (§6); projekty, style guide, referencje (§7).
5. ✅ Storage (§13): klient R2 + presigned URL + uploady + quota; ✅ R2 włączone i bucket `plikiveyraflow1` (§23.2 pkt 0–1); ☐ token S3 do `.env.local`, CORS, lifecycle — ręcznie w dashboardzie (§23.2 pkt 2–4), weryfikacja `pnpm r2:check`; do tego czasu sterownik lokalny.
6. ✅ Kolejka (§14.1): funkcje Inngest + tryb inline; adapter fal.ai na `@fal-ai/client` i rejestr modeli (§8.4, §9.7); tłumacz (§8.3, z `model_params`) i moderacja (§12) z kanonicznymi promptami; ✅ `FAL_KEY`; ☐ saldo fal.ai, ☐ `OPENAI_API_KEY`, ☐ klucze Inngest.
7. ✅ Pipeline'y §9 i post-processing §10 (sharp, packer atlasu, `.tres`, GIF, README per silnik, GLB writer); worker Modal (§14.2) — kod napisany, ☐ deploy (`modal deploy`) i pliki BVH.
8. ✅ Kredyty i Stripe (§11): RPC księgi, checkout, portal, webhooki, cykl miesięczny, trial jednorazowy; ☐ produkty/ceny/webhook w Stripe (§23.4).
9. ✅ UI (§17): marketing, auth, app (dashboard, projects, generate ×6, library, asset, jobs, billing, settings, workspaces/new), share (§18), admin (§19).
10. ✅ Formalności (§21): stopka, strony-placeholdery, baner cookies + menedżer zgód, zgody, eksport/usunięcie konta.
11. ✅ Bezpieczeństwo (§22): CSP i nagłówki, rate limity, `check-public-env`, testy jednostkowe; ☐ Playwright e2e, CI.
12. ✅ Projekt Vercel `asset-generator` + deploy z GitHuba (§23.3, 2026-09-24); ☐ zmienne środowiskowe na Vercelu i redeploy (§0.3 pkt 13), ☐ deploy workera, ☐ konfiguracja webhooków u dostawców.
12a. ✅ Google Analytics 4 w kodzie (§21.6); ☐ właściwość GA4, ustawienia strumienia i `NEXT_PUBLIC_GA_MEASUREMENT_ID` na Vercelu (§23.9).
12b. ✅ Google Cloud Error Reporting w kodzie (§25.4, zamiast Crashlytics); ☐ projekt GCP, Error Reporting API, klucz API i zmienne na Vercelu (§23.10).
13. ☐ Uzupełnić placeholdery z §27 i aktualizować ten dokument przy każdej zmianie.

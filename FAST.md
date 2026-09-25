# FAST.md — audyt wydajności Veyraflow

Data audytu: 2026-09-23 · Wersja: `package.json` 0.1.0 · Next.js 15.5.25 / React 19

Dokument opisuje **co spowalnia aplikację** i **jak to naprawić**. Nic w kodzie nie zostało
zmienione — to jest wyłącznie raport. Każdy punkt ma odniesienie do konkretnego pliku i linii.

Legenda priorytetów:

- **P0** — duży, mierzalny wpływ na każde żądanie / każde wejście na stronę. Naprawić najpierw.
- **P1** — zauważalny wpływ na konkretne ekrany lub przy wzroście danych.
- **P2** — realne, ale mniejsze; warto poprawić przy okazji.

Pomiary bundla pochodzą z `npx next build` uruchomionego podczas audytu (build przechodzi).

---

## Podsumowanie — 8 rzeczy o największym wpływie

| # | Problem | Gdzie | Priorytet |
|---|---------|-------|-----------|
| 1 | `getAppContext()` wykonuje się **dwa razy** na każde wejście do `/app` (layout + page) | [lib/appContext.ts](lib/appContext.ts) | P0 |
| 2 | Każde żądanie API robi sieciowy `auth.getUser()` do Supabase — mimo że middleware już to zrobił | [lib/api.ts:93](lib/api.ts:93) | P0 |
| 3 | Strony marketingowe są `ƒ Dynamic` zamiast statycznych — przez `getSessionUser()` w layoucie | [app/(marketing)/layout.tsx:6](app/(marketing)/layout.tsx:6) | P0 |
| 4 | `useJobFeed` montuje się 2× równolegle → 2 kanały Realtime + 2 pętle pollingu co 4 s | [hooks/use-job-feed.ts](hooks/use-job-feed.ts) | P0 |
| 5 | Presigned URL-e generowane od nowa przy każdym żądaniu → przeglądarka **nigdy** nie cache'uje miniatur | [lib/assets.ts:24](lib/assets.ts:24), [lib/storage/r2.ts:42](lib/storage/r2.ts:42) | P0 |
| 6 | `/app/jobs` odpytuje `/api/jobs?limit=100` co 5 s bezwarunkowo, z pełnym JSON-em `input` | [app/app/jobs/page.tsx:22](app/app/jobs/page.tsx:22) | P1 |
| 7 | Biblioteka renderuje 60 **animowanych GIF-ów** jako miniatury siatki | [components/app/asset-card.tsx:25](components/app/asset-card.tsx:25) | P1 |
| 8 | `@supabase/supabase-js` (196 kB surowo) ląduje w bundlu `/login` i `/signup` przez `GoogleButton` | [components/auth/google-button.tsx:6](components/auth/google-button.tsx:6) | P1 |

---

## P0 — naprawić najpierw

### 1. `getAppContext()` uruchamia się podwójnie na każde wejście do `/app` i `/admin`

**Co się dzieje.** `getAppContext()` jest wywoływane w layoucie **oraz** w stronach:

- [app/app/layout.tsx:7](app/app/layout.tsx:7)
- [app/app/page.tsx:15](app/app/page.tsx:15)
- [app/app/generate/[type]/page.tsx:24](app/app/generate/[type]/page.tsx:24)
- [app/admin/layout.tsx:13](app/admin/layout.tsx:13)

W App Routerze layout i page renderują się w tym samym żądaniu. Funkcja nie jest owinięta w
`React.cache()` — sprawdziłem, w całym repo **nie ma ani jednego użycia `cache()`**. Więc cała
jej zawartość leci dwa razy.

Jedno `getAppContext()` to:

1. `supabase.auth.getUser()` — **round trip sieciowy** do Supabase Auth ([lib/appContext.ts](lib/appContext.ts))
2. `SELECT * FROM profiles`
3. `getCurrentWorkspace()` → odczyt cookie + `SELECT ... workspace_members` (i ewentualnie 2 kolejne zapytania fallback, [lib/workspace.ts](lib/workspace.ts))
4. `SELECT ... workspace_members JOIN workspaces` (lista workspace'ów)
5. `getBalance()` → `SELECT * FROM credit_balances`
6. `storage().presignGet(avatar_key)` — podpis SigV4

Razy dwa = **2 round tripy do Auth + 8–10 zapytań do bazy** na jedno wejście na dashboard.
Do tego dochodzi middleware (punkt 4 poniżej) i zapytania samej strony.

**Jak naprawić.**

```ts
// lib/appContext.ts
import { cache } from "react";

export const getAppContext = cache(async function getAppContext(): Promise<AppContext> {
  // ... bez zmian
});
```

`React.cache()` deduplikuje w obrębie jednego żądania serwerowego. To jedna linia i ucina
połowę pracy na każdej nawigacji do `/app`. To samo warto zrobić dla `getCurrentWorkspace()`
([lib/workspace.ts](lib/workspace.ts)) i `requireUser()` ([lib/api.ts:93](lib/api.ts:93)).

### 2. `requireUser()` robi sieciowy `auth.getUser()` przy każdym żądaniu API

**Co się dzieje.** [lib/api.ts:93–101](lib/api.ts:93) — każdy z ~50 route handlerów zaczyna od
`requireUser()`, które wykonuje `supabase.auth.getUser()`. To **nie jest** lokalna weryfikacja
JWT — `supabase-js` wysyła `GET /auth/v1/user` do Supabase i czeka na odpowiedź. Dopiero potem
leci `SELECT * FROM profiles`.

Efekt: minimum 2 round tripy zanim handler w ogóle zacznie robić cokolwiek użytecznego. Przy
pollingu (`/api/jobs` co 3–5 s) to stały narzut sieciowy pomnożony przez częstotliwość.

Dodatkowo niektóre route'y wołają `requireUser()` **wielokrotnie** w jednym pliku, bo każdy
export (GET/PATCH/POST) ma własne wywołanie — to akurat OK (różne żądania), ale
[app/api/account/route.ts:16,24,52](app/api/account/route.ts:16) pokazuje skalę powtórzeń.

**Jak naprawić (dwie opcje, można łączyć).**

- **Krótkoterminowo:** owinąć `requireUser` w `React.cache()` — deduplikuje w obrębie żądania.
- **Właściwie:** przejść na lokalną weryfikację JWT. `supabase-js` v2.116 ma
  `auth.getClaims()`, które przy asymetrycznych kluczach JWT (ES256/RS256) weryfikuje token
  **lokalnie**, bez round tripu. Wtedy `requireUser()` kosztuje jedno zapytanie do `profiles`
  zamiast round trip + zapytanie.
- **Alternatywa:** middleware i tak już zweryfikował użytkownika — może przekazać `user.id`
  w nagłówku odpowiedzi/żądania (`x-vf-user`), a route handler tylko go odczyta. Uwaga: nagłówek
  musi być ustawiany wyłącznie przez middleware i czyszczony z ruchu wejściowego, inaczej robi
  się z tego dziura autoryzacyjna. Opcja z `getClaims()` jest bezpieczniejsza.

### 3. Strony marketingowe są renderowane dynamicznie zamiast statycznie

**Co się dzieje.** [app/(marketing)/layout.tsx:6](app/(marketing)/layout.tsx:6) woła
`getSessionUser()`, żeby pokazać "Open app" zamiast "Sign in". To czyta `cookies()` i robi
sieciowy `auth.getUser()`. Efekt: **cała grupa `(marketing)` wypada z prerenderingu**.

Potwierdzenie z outputu builda:

```
ƒ /                     5.26 kB   198 kB
ƒ /pricing              5.26 kB   198 kB
ƒ /privacy              2.75 kB   114 kB
ƒ /terms                2.75 kB   114 kB
ƒ /impressum            2.75 kB   114 kB
ƒ /cookies              2.75 kB   114 kB
ƒ /ai-disclosure        2.75 kB   114 kB
```

`ƒ` = "server-rendered on demand". Landing page i regulaminy — treść, która nie zmienia się
między użytkownikami — są renderowane od zera przy każdym wejściu, z round tripem do Supabase
w krytycznej ścieżce TTFB. To najgorsze miejsce, żeby płacić za taki round trip: to jest
pierwsza strona, którą widzi nowy użytkownik, i to ona decyduje o LCP i o SEO.

**Jak naprawić.** Wyrzucić `getSessionUser()` z layoutu i rozwiązać "signed in" po stronie
klienta albo przez middleware:

- **Najprościej:** `SiteHeader` jako mały komponent kliencki, który sprawdza obecność cookie
  sesji (`document.cookie`) i renderuje odpowiedni przycisk. Layout staje się w pełni statyczny.
- **Albo:** zostawić w headerze oba warianty i przełączać CSS-em na podstawie klasy ustawianej
  przez middleware — zero JS, zero flashu.
- **Albo:** przenieść `getSessionUser()` z layoutu do osobnego `<Suspense>`-owanego slotu, żeby
  reszta strony mogła się prerenderować.

Po zmianie te 7 stron powinno pokazać się jako `○ (Static)` i serwować się z CDN-u.

### 4. Middleware: dwa sekwencyjne round tripy na każde żądanie strony

**Co się dzieje.** [middleware.ts](middleware.ts) na każde żądanie (matcher wyklucza tylko
`_next/static`, `api/` i pliki statyczne):

1. `updateSession(request)` → `supabase.auth.getUser()` — round trip sieciowy
   ([lib/supabase/middleware.ts:31](lib/supabase/middleware.ts:31))
2. Dla `/app`, `/admin` i stron auth: `SELECT role, banned_at FROM profiles` — drugi round trip,
   **sekwencyjnie po pierwszym**

Do tego middleware waży **93 kB** (z outputu builda) — to cały `@supabase/ssr` ładowany na
każde żądanie.

W sumie ścieżka wejścia na `/app` to: middleware (2 round tripy) → layout `getAppContext()`
(1 round trip + 5 zapytań) → page `getAppContext()` (znowu to samo) → zapytania strony.

**Jak naprawić.**

- Punkty 1 i 3 (cache + getClaims) redukują to naturalnie.
- Zapytanie o `banned_at`/`role` można wyciąć z gorącej ścieżki: te dane są już w JWT, jeśli
  dodasz je jako custom claims przez Supabase Auth Hook. Wtedy middleware nie dotyka bazy wcale.
- Alternatywnie: sprawdzać ban tylko na `/app`/`/admin`, a nie na stronach auth (obecnie
  `isAuthPage` też triggeruje zapytanie, mimo że wynik jest potrzebny tylko do redirectu,
  który i tak nastąpi).

### 5. `useJobFeed` uruchamia się podwójnie — 2 kanały Realtime + 2 pętle pollingu

**Co się dzieje.** Hook [hooks/use-job-feed.ts](hooks/use-job-feed.ts) jest używany w trzech
miejscach:

- [components/app/topbar.tsx:37](components/app/topbar.tsx:37) — **zawsze zamontowany**, bo Topbar
  siedzi w `AppShell` ([components/app/app-shell.tsx](components/app/app-shell.tsx))
- [components/app/active-jobs.tsx:9](components/app/active-jobs.tsx:9) — dashboard `/app`
- [components/generate/generator.tsx:99](components/generate/generator.tsx:99) — `/app/generate/[type]`

Każda instancja tworzy **własny** kanał Realtime (nazwa jest celowo unikalna przez `channelSeq`),
**własny** `setInterval` co 4 s ([hooks/use-job-feed.ts:79](hooks/use-job-feed.ts:79)) i **własny**
stan `Map`. Na `/app` i na `/app/generate/*` działają więc dwie kopie równolegle: 2 subskrypcje
WebSocket i 2 zapytania `job_status_feed` co 4 sekundy, zwracające te same 30 wierszy.

Dodatkowo dwa mniejsze problemy w tym samym hooku:

- [hooks/use-job-feed.ts:55](hooks/use-job-feed.ts:55) — `qc.invalidateQueries({ queryKey: ["jobs"] })`
  jest wołane **bezwarunkowo** na końcu każdego `upsert()`, także gdy zmieniło się tylko
  `progress` z 42 na 43. Każdy tick postępu z Realtime wymusza refetch `/api/jobs`.
- `setInterval` nie respektuje widoczności zakładki. React Query ma
  `refetchIntervalInBackground: false` domyślnie, więc jego pollingi zasypiają w tle — ale ten
  ręczny interwał **odpytuje Supabase także w ukrytej zakładce**.

**Jak naprawić.**

- Wynieść feed do kontekstu: jeden `JobFeedProvider` w `AppShell`, jeden kanał, jeden interwał,
  a `useJobFeed()` niech tylko czyta z kontekstu. To usuwa duplikację u źródła.
- Wywoływać `invalidateQueries(["jobs"])` tylko gdy zmienił się `status`, nie przy samym `progress`.
- Dodać `if (document.hidden) return;` w callbacku `setInterval`.

### 6. Presigned URL-e zabijają cache przeglądarki dla wszystkich miniatur

**Co się dzieje.** Dwa problemy się tu nakładają.

**a) URL zmienia się przy każdym żądaniu.** [lib/assets.ts:24–25](lib/assets.ts:24) generuje
świeży presigned URL dla każdego assetu przy każdym wywołaniu `/api/assets`. Podpis SigV4
zawiera `X-Amz-Date` i `X-Amz-Signature`, które są inne za każdym razem. Dla przeglądarki
`.../thumb.png?X-Amz-Date=20260923T090000Z&...` i `.../thumb.png?X-Amz-Date=20260923T090012Z&...`
to **dwa różne zasoby**. Cache nie ma szans zadziałać.

Konsekwencja: każde `invalidateQueries(["assets"])` — a to dzieje się przy **każdym** ukończonym
jobie ([hooks/use-job-feed.ts:48](hooks/use-job-feed.ts:48)) — powoduje ponowne pobranie
**wszystkich** miniatur w siatce. Przy 60 elementach w bibliotece to 60 pobrań obrazków przy
każdym zakończonym zadaniu.

**b) Obiekty w R2 mają `max-age=0`.** [lib/storage/r2.ts:42](lib/storage/r2.ts:42):

```ts
CacheControl: opts.cacheControl ?? "private, max-age=0",
```

`persistOutputs` ([lib/pipelines/finalize.ts:44,65,70](lib/pipelines/finalize.ts:44)) nigdy nie
przekazuje `cacheControl`, więc **każdy** wygenerowany plik i miniatura dostaje `max-age=0`.
Nawet gdyby URL był stabilny, przeglądarka i tak rewalidowałaby przy każdym renderze.

To jest treść immutable — asset o danym ID nigdy się nie zmienia.

**Jak naprawić.**

- W `persistOutputs` przekazywać `cacheControl: "public, max-age=31536000, immutable"` dla plików
  assetów i podglądów.
- Ustabilizować URL-e: zaokrąglić moment podpisu do pełnej godziny (np. `X-Amz-Date` wyliczany
  z `Math.floor(Date.now()/3600000)*3600000`) przy TTL 2 h — wtedy ten sam klucz daje ten sam
  URL przez godzinę i cache działa.
- Docelowo lepiej: wystawić miniatury przez publiczną domenę R2 (`r2.dev` / custom domain)
  z długim cache, a presigned URL-e zostawić tylko dla plików do pobrania. Wymaga zmiany w CSP
  (`img-src` w [next.config.ts](next.config.ts)) i decyzji, czy miniatury mogą być publiczne.

---

## P1 — zauważalny wpływ

### 7. `/app/jobs` odpytuje serwer co 5 s bezwarunkowo, ciągnąc pełny `input`

[app/app/jobs/page.tsx:22](app/app/jobs/page.tsx:22):

```ts
const jobs = useJobs({ status: ..., limit: "100" }, 5000);
```

Interwał jest stały — działa nawet gdy żaden job nie jest aktywny i nic się nie zmienia.
Każdy poll to: `auth.getUser()` (round trip) + `getCurrentWorkspace()` + `SELECT * FROM jobs_public`
dla 100 wierszy.

Co gorsza, widok `jobs_public` ([supabase/migrations/20260920000004_rls.sql:86](supabase/migrations/20260920000004_rls.sql:86))
zawiera kolumnę `input` (jsonb) — a [app/api/jobs/route.ts:21](app/api/jobs/route.ts:21) robi
`select("*")`. Czyli co 5 sekund leci przez sieć 100 pełnych obiektów wejściowych jobów, z czego
UI wykorzystuje głównie `status`, `progress`, `type` i `created_at`.

**Jak naprawić.**

- Wyliczyć interwał z danych, tak jak robi to generator
  ([components/generate/generator.tsx:100](components/generate/generator.tsx:100)):
  `refetchInterval: hasActiveJobs ? 5000 : false`. Jeszcze lepiej — oprzeć widok o ten sam
  feed Realtime, który już działa w tle, i zrezygnować z pollingu.
- Zawęzić `select()` do faktycznie używanych kolumn. `input` wystarczy pobierać na żądanie
  (np. przy "retry"), a nie w liście.

### 8. Biblioteka renderuje 60 animowanych GIF-ów jako miniatury

[components/app/asset-card.tsx:22](components/app/asset-card.tsx:22) — `AssetCard` przekazuje
`animated` do `AssetThumb`, co wybiera `animated_preview_url` (GIF) zamiast statycznego
`preview_url` (PNG). [app/app/library/page.tsx:41](app/app/library/page.tsx:41) ładuje
`limit: "60"`.

Animowany GIF jest wielokrotnie większy od PNG-a i **każdy odtwarzany jednocześnie** obciąża
główny wątek dekodowaniem klatek. 60 GIF-ów w siatce to zauważalny spadek płynności scrollowania.

Dodatkowo w całej aplikacji **nie ma ani jednego `next/image`** — wszystko to surowe `<img>`
(sprawdzone: 10 wystąpień `<img`, 0 importów `next/image`). Nie ma więc ani optymalizacji
rozmiaru, ani `srcset`, ani automatycznego AVIF/WebP. Miniatury są generowane przez
[lib/postprocess/image.ts:`thumbnail()`](lib/postprocess/image.ts) jako **PNG 256×256** — WebP
byłby tu 3–5× mniejszy.

**Jak naprawić.**

- Animację odtwarzać dopiero na `hover` (statyczny PNG jako `src`, GIF podmieniany na
  `onMouseEnter`) — standardowy wzorzec w galeriach.
- `thumbnail()` powinien zwracać WebP zamiast PNG.
- Rozważyć `next/image` dla miniatur — wymaga dodania hosta R2 do `images.remotePatterns`
  (już jest w [next.config.ts](next.config.ts)), ale przy presigned URL-ach optymalizator
  będzie re-pobierał obrazek przy każdej zmianie podpisu, więc najpierw trzeba naprawić punkt 6.
- `loading="lazy"` już jest ([asset-card.tsx:25](components/app/asset-card.tsx:25)) — dobrze.
  Warto dodać `decoding="async"` i konkretne `width`/`height`, żeby uniknąć layout shiftu.

### 9. `@supabase/supabase-js` w bundlu stron logowania i rejestracji

> **Aktualizacja 2026-09-24:** `GoogleButton` usunięty razem z logowaniem Google (SPEC §5) — `/signup` nie importuje już `supabaseBrowser` (First Load JS po buildzie: **278 kB → 208 kB**). `/login` nadal go importuje (formularz woła `signInWithPassword` w przeglądarce), więc dla tej strony punkt pozostaje aktualny.

Z analizy chunków builda: chunk `7233-*.js` (**196 kB** surowo) zawiera `RealtimeClient`,
`GoTrue` i `postgrest`. Jest ładowany przez `/app/layout`, `/app/page`,
`/app/generate/[type]/page` — i przez **`/login` oraz `/signup`**.

Powód: [components/auth/google-button.tsx:6](components/auth/google-button.tsx:6) importuje
`supabaseBrowser` tylko po to, żeby wywołać `signInWithOAuth`. Ten jeden import ciągnie cały
klient Supabase — łącznie z klientem WebSocket Realtime i PostgREST, których strona logowania
nigdy nie użyje.

Wynik w liczbach (First Load JS z builda):

```
○ /signup     5.54 kB   278 kB   ← najcięższa strona publiczna
○ /login      6.17 kB   202 kB
```

278 kB na formularzu rejestracji to dużo — a to jest strona, na której zależy Ci na konwersji.

**Jak naprawić.** Załadować klienta leniwie, dopiero po kliknięciu:

```ts
const onClick = async () => {
  const { supabaseBrowser } = await import("@/lib/supabase/browser");
  await supabaseBrowser().auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
};
```

To samo warto zrobić dla `useJobFeed` w `/app/layout` — Realtime nie musi blokować pierwszego
renderu shellu aplikacji.

`/app/login` (linia 28) też woła `signInWithPassword` bezpośrednio przez klienta — można to
przenieść na istniejący route handler, żeby strona logowania w ogóle nie potrzebowała
`supabase-js`.

### 10. Admin overview: nielimitowane skany 30-dniowe agregowane w JS, odświeżane co 30 s

[app/api/admin/overview/route.ts](app/api/admin/overview/route.ts) wykonuje m.in.:

```ts
db.from("jobs").select("status, provider_cost_usd, credits_charged, created_at").gte("created_at", month)
db.from("credit_ledger").select("delta").eq("kind", "settlement").gte("created_at", month)
db.from("profiles").select("id", { count: "exact", head: true })
```

Żadne z tych zapytań nie ma `limit`. Wszystkie joby i wszystkie wpisy ledgera z 30 dni są
ściągane do Node'a i sumowane pętlą w JS. Przy tym `count: "exact"` na `profiles` to pełny skan
tabeli w Postgresie.

A [app/admin/page.tsx:24](app/admin/page.tsx:24) ustawia `refetchInterval: 30_000` — więc dzieje
się to **co 30 sekund na każdą otwartą zakładkę admina**.

Dodatkowo brakuje indeksów pod te zapytania. Istniejący `jobs_ws_created_idx` to
`(workspace_id, created_at desc)` — przy filtrze wyłącznie po `created_at` (bez workspace'u)
jest bezużyteczny. Tak samo `credit_ledger_ws_idx (workspace_id, created_at desc)` nie pomoże
przy `kind = 'settlement' AND created_at >= x` globalnie.

To samo dotyczy [app/api/admin/costs/route.ts:19](app/api/admin/costs/route.ts:19) — pełny zakres
dat ściągany do pamięci i grupowany pętlą.

**Jak naprawić.**

- Przenieść agregację do Postgresa: funkcja RPC `admin_overview_stats(p_from timestamptz)`
  z `GROUP BY date_trunc('day', created_at)`. Baza zwróci 30 wierszy zamiast potencjalnie
  dziesiątek tysięcy.
- Dodać indeksy: `create index jobs_created_idx on public.jobs (created_at desc);`
  oraz `create index credit_ledger_kind_created_idx on public.credit_ledger (kind, created_at desc);`
- Zamienić `count: "exact"` na `count: "estimated"` albo `count: "planned"` dla licznika
  użytkowników na dashboardzie — dokładna liczba nie jest tam potrzebna co 30 sekund.
- Podnieść `refetchInterval` do 2–5 minut albo dodać przycisk "Odśwież".

### 11. `withPreviewUrls` generuje do 120 podpisów SigV4 na jedno żądanie biblioteki

[lib/assets.ts:20–27](lib/assets.ts:20) — dla każdego assetu podpisywane są dwa URL-e
(`preview_key` i `animated_preview_key`). Przy `limit=60` to 120 operacji
HMAC-SHA256 + konstrukcja `GetObjectCommand` na jedno żądanie API. Same podpisy są lokalne
(nie ma round tripu), ale narzut AWS SDK na budowę komendy i middleware stack nie jest zerowy,
a `Promise.all` nad 120 elementami blokuje event loop w ciasnych seriach.

**Jak naprawić.** Podpisywać leniwie — tylko ten URL, który faktycznie zostanie użyty.
Skoro siatka i tak pokazuje jeden obrazek na kartę, drugi podpis jest marnowany. Jeśli
zrealizujesz punkt 6 (stabilne URL-e zaokrąglone do godziny), warto dołożyć mały cache
`Map<key, {url, expiresAt}>` w procesie — wtedy powtarzające się żądania nie podpisują nic.

### 12. Wyszukiwanie `ILIKE '%tekst%'` bez indeksu trigramowego

- [app/api/assets/route.ts:28](app/api/assets/route.ts:28) —
  `or(name.ilike.%q%, prompt.ilike.%q%)` na tabeli `assets`
- [app/api/admin/users/route.ts:13](app/api/admin/users/route.ts:13) —
  `or(email.ilike.%q%, display_name.ilike.%q%)` na `profiles`

Wzorzec z wiodącym `%` uniemożliwia użycie indeksu B-tree. Postgres robi sekwencyjny skan.
Przy tabeli `assets` dochodzi do tego filtr `workspace_id`, więc indeks częściowy
`assets_ws_proj_idx` zawęzi zbiór — ale `prompt` to pole tekstowe bez ograniczenia długości,
więc skan i tak jest kosztowny. Na `profiles` (admin) filtra nie ma wcale — zawsze pełny skan.

Do tego wyszukiwarka w bibliotece jest debounce'owana na 300 ms
([app/app/library/page.tsx:32](app/app/library/page.tsx:32)), co przy szybkim pisaniu i tak
generuje kilka pełnych skanów.

**Jak naprawić.**

```sql
create extension if not exists pg_trgm;
create index assets_name_trgm_idx on public.assets using gin (name gin_trgm_ops);
create index assets_prompt_trgm_idx on public.assets using gin (prompt gin_trgm_ops);
create index profiles_email_trgm_idx on public.profiles using gin (email gin_trgm_ops);
```

Alternatywnie kolumna `tsvector` + `to_tsquery`, jeśli chcesz właściwe full-text search
zamiast dopasowania podciągu.

### 13. Operacje masowe wysyłają N osobnych żądań, każde z własną autoryzacją

[app/app/library/page.tsx:51,57,63](app/app/library/page.tsx:51):

```ts
await Promise.all(ids.map((id) => del(`/api/assets/${id}`)));
await Promise.all(ids.map((id) => post(`/api/assets/${id}/restore`)));
await Promise.all(ids.map((id) => patch(`/api/assets/${id}`, { project_id: moveTo })));
```

Przy 60 zaznaczonych assetach to 60 równoległych żądań HTTP, z których **każde** wykonuje
`requireUser()` (round trip do Auth + `SELECT profiles`) i `loadAsset()` (`SELECT assets`
+ `SELECT workspace_members`). Czyli ~240 zapytań do bazy i 60 round tripów do Auth, żeby
usunąć 60 wierszy. Do tego 60 równoległych połączeń wysyca pulę połączeń Supabase.

**Jak naprawić.** Dodać endpointy zbiorcze — `PATCH /api/assets` i `DELETE /api/assets`
przyjmujące `{ ids: string[] }`. Jedna autoryzacja, jedno `UPDATE ... WHERE id = ANY($1)
AND workspace_id = $2`. Ten sam wzorzec dotyczy `bulkZip`, który już to robi dobrze
(jeden POST z tablicą).

---

## P2 — mniejsze, ale realne

### 14. Pipeline: 2–3 zapytania do bazy na każdy cykl pollingu providera

[lib/pipelines/providerWait.ts:25–33](lib/pipelines/providerWait.ts:25) — w pętli co 5 s:

```ts
await ctx.assertActive();          // SELECT status FROM jobs WHERE id = ...
const p = await adapter.poll(...); // round trip do providera
await ctx.setProgress(...);        // UPDATE jobs SET progress = ...
await ctx.rt.sleep(pollMs);
```

`assertActive()` ([lib/pipelines/run.ts](lib/pipelines/run.ts)) to osobny `SELECT` przy każdej
iteracji. Job 3D trwający 3 minuty = ~36 iteracji = ~72 zapytania do bazy tylko na sprawdzanie
statusu i aktualizację postępu.

**Jak naprawić.** Połączyć jedno i drugie w jeden `UPDATE ... RETURNING status` — aktualizacja
postępu i odczyt statusu anulowania w jednym round tripie. Dodatkowo aktualizować `progress`
tylko gdy zmienił się o ≥2 punkty procentowe (teraz każdy tick providera leci do bazy).

Osobno: [lib/pipelines/run.ts](lib/pipelines/run.ts) ma dwa następujące po sobie `update()`
bez żadnej pracy pomiędzy:

```ts
await update({ status: "post_processing", progress: 88 });
await update({ status: "uploading", progress: 92 });
```

To dwa zapisy do bazy (i dwa eventy Realtime do wszystkich klientów) za jednym zamachem.

### 15. `persistOutputs` wysyła pliki do R2 sekwencyjnie

[lib/pipelines/finalize.ts:44,65,70](lib/pipelines/finalize.ts:44) — `await st.put(...)`
w pętli `for`. Model 3D z teksturami to często 5–10 plików; każdy czeka na poprzedni.
Przy 300 ms na upload to 3 sekundy zamiast 300 ms.

**Jak naprawić.** `Promise.all` na plikach jednego assetu (kolejność nie ma znaczenia —
każdy ma własny klucz). Zachować sekwencyjność między assetami, jeśli zależy Ci na
deterministycznej kolejności `ids`.

### 16. `buildDownloadZip` — sekwencyjne pobrania + kompresja nieściśliwych danych + 200 MB w RAM

[lib/downloads.ts:41](lib/downloads.ts:41):

```ts
zip.file(..., await st.get(f.r2_key));   // sekwencyjnie, plik po pliku
```

Trzy problemy naraz:

1. **Sekwencyjne pobrania** — ZIP z 50 plików to 50 kolejnych round tripów do R2.
2. **`compression: "DEFLATE"`** ([linia 55](lib/downloads.ts:55)) na PNG, GLB, WAV i MP3 —
   to już skompresowane formaty. DEFLATE zużywa CPU i praktycznie nic nie oszczędza.
3. **Wszystko w pamięci** — limit to 200 MB (`MAX_ZIP_BYTES`), więc w szczycie trzymasz
   bufory źródłowe **plus** cały wynikowy ZIP. Na małej instancji to OOM.

**Jak naprawić.** Pobierać pliki równolegle w paczkach (np. `p-limit` z limitem 8). Użyć
`compression: "STORE"` dla formatów już skompresowanych, a DEFLATE zostawić dla JSON/TXT/README.
Docelowo — strumieniować ZIP prosto do R2 zamiast budować go w pamięci.

### 17. `trimAndPad` koduje PNG 3–4 razy na ten sam obrazek

[lib/postprocess/image.ts](lib/postprocess/image.ts), funkcja `trimAndPad`:

```ts
trimmed = await img.trim(...).png().toBuffer();     // encode #1
let out = sharp(trimmed);
await out.metadata();
out = sharp(await out.extend(...).png().toBuffer()); // encode #2
const png = await out.png().toBuffer();              // encode #3
```

Każde `.png().toBuffer()` to pełne kodowanie PNG (kompresja zlib) i ponowne dekodowanie przy
następnym `sharp()`. Dla obrazka 2048×2048 to kilkaset milisekund na przebieg, trzykrotnie.

**Jak naprawić.** Zbudować jeden pipeline sharp i wywołać `.toBuffer()` raz. Gdy potrzebujesz
wymiarów w trakcie, użyj `.toBuffer({ resolveWithObject: true })` — zwraca `info` z `width`/`height`
bez osobnego `metadata()`. Pośrednie bufory trzymać jako `raw()` zamiast `png()`, jeśli i tak
lecą z powrotem do sharpa.

Warto też ustawić globalnie `sharp.cache(false)` i `sharp.concurrency(n)` w kontekście
serwerless — domyślny cache libvips trzyma pamięć między wywołaniami.

### 18. `SpritePlayer` re-renderuje React z częstotliwością klatek

[components/preview/sprite-player.tsx:51](components/preview/sprite-player.tsx:51):

```ts
const t = setInterval(() => setFrame((f) => (f + 1) % frames.length), 1000 / fps);
```

Przy 30 fps to **30 re-renderów Reacta na sekundę** — i to całego komponentu razem z
`<Select>`, `<Slider>` i przyciskami Radiksa — żeby zmienić jedną liczbę, która służy wyłącznie
do `drawImage` na canvasie.

**Jak naprawić.** Trzymać numer klatki w `useRef` i rysować w pętli `requestAnimationFrame`,
bez dotykania stanu Reacta. Aktualizować stan tylko dla licznika "frame N/M" (albo pisać go
bezpośrednio do DOM-u przez ref). Bonus: `requestAnimationFrame` automatycznie zatrzymuje się
w ukrytej zakładce, `setInterval` nie.

### 19. `AudioPlayer` ustawia stan na każde zdarzenie `timeupdate`

[components/preview/audio-player.tsx](components/preview/audio-player.tsx):

```ts
instance.on("timeupdate", (t: number) => setTime((s) => ({ ...s, cur: t })));
```

Wavesurfer emituje `timeupdate` w rytmie animacji (~60/s). Przy assecie z kilkoma wariantami
audio ([components/preview/asset-preview.tsx](components/preview/asset-preview.tsx) renderuje
jeden `AudioPlayer` na wariant) to kilkaset aktualizacji stanu na sekundę.

**Jak naprawić.** Throttlować do ~4/s (wyświetlasz czas z dokładnością do sekundy, więc więcej
i tak nic nie wnosi) albo pisać czas bezpośrednio do DOM-u przez `ref.current.textContent`.

### 20. `useGLTF` cache'uje modele po zmieniającym się presigned URL-u → wyciek pamięci

[components/preview/model-viewer-inner.tsx:9](components/preview/model-viewer-inner.tsx:9) używa
`useGLTF(url)` z drei. Drei trzyma globalny cache sparsowanych GLTF-ów **kluczowany URL-em**
i nie zwalnia go automatycznie.

Ponieważ presigned URL zmienia się przy każdym żądaniu API (punkt 6), każde odświeżenie widoku
assetu tworzy **nowy wpis w cache'u** z pełną geometrią, teksturami i buforami GPU. Stare wpisy
zostają. Przy przeglądaniu kilkunastu modeli 3D pamięć rośnie liniowo i nie wraca.

**Jak naprawić.** Wołać `useGLTF.clear(url)` w cleanupie efektu przy odmontowaniu. Naprawienie
punktu 6 (stabilne URL-e) rozwiązuje to przy okazji — ten sam model dostaje wtedy ten sam klucz.

Drobiazg przy okazji: `castShadow` na `<directionalLight>`
([linia 46](components/preview/model-viewer-inner.tsx:46)) nic nie robi, bo `<Canvas>` nie ma
`shadows`. Albo włączyć cienie, albo usunąć flagę.

### 21. `POST /api/jobs` — ~12 sekwencyjnych round tripów przed utworzeniem joba

[app/api/jobs/route.ts:44–100](app/api/jobs/route.ts:44) wykonuje po kolei: `requireUser()`
(auth + profiles) → `rateLimit()` (RPC) → `SELECT projects` → `requireWorkspaceRole()`
(workspace_members + workspaces) → `isFlagEnabled()` ×2 → `estimateJob()` → `COUNT jobs`
→ `getBalance()` → `INSERT jobs` → `reserveCredits()` (RPC) → `dispatchGeneration()`.

Flagi i cennik są cache'owane w procesie ([lib/flags.ts](lib/flags.ts) 30 s,
[lib/credits/pricing.ts](lib/credits/pricing.ts) 60 s) — to dobrze. Ale reszta to łańcuch
sekwencyjny, w którym kilka kroków jest od siebie niezależnych.

**Jak naprawić.** `rateLimit()`, `SELECT projects` i `getBalance()` mogą lecieć równolegle
(`Promise.all`) — wynik `getBalance` jest potrzebny dopiero przy sprawdzaniu salda.
Sprawdzenie `COUNT jobs` i `getBalance` też można złączyć. Realistycznie da się zejść
z ~12 do ~6 round tripów.

### 22. `POST /api/projects` — pętla unikalności slugu do 48 zapytań

[app/api/projects/route.ts:44–47](app/api/projects/route.ts:44):

```ts
for (let i = 2; i < 50; i++) {
  const { count } = await db.from("projects").select("id", { count: "exact", head: true })...
  if (!count) break;
  slug = `${base}-${i}`;
}
```

W pesymistycznym przypadku (48 projektów o podobnej nazwie) to 48 sekwencyjnych zapytań.

**Jak naprawić.** Jedno zapytanie `SELECT slug FROM projects WHERE workspace_id = $1 AND slug LIKE
'base%'`, potem wybór wolnego sufiksu w pamięci. Albo unikalny indeks na `(workspace_id, slug)`
i retry z sufiksem losowym przy konflikcie.

### 23. `lib/maintenance.ts` — N+1 w zadaniach cyklicznych

[lib/maintenance.ts:37](lib/maintenance.ts:37) — `UPDATE assets` osobno dla każdego wygasającego
assetu, w pętli.
[lib/maintenance.ts:41](lib/maintenance.ts:41) — `SELECT profiles` osobno dla każdego użytkownika.
[lib/maintenance.ts:70,78,83](lib/maintenance.ts:70) — sekwencyjne `deletePrefix` / `delete`
plus osobny `DELETE` z bazy per rekord.

To leci z crona, więc nie blokuje użytkownika — ale przy wzroście danych okno wykonania rośnie
liniowo i w końcu przekroczy limit czasu funkcji.

**Jak naprawić.** Zbiorcze `UPDATE ... WHERE id = ANY($1)`, jedno `SELECT profiles WHERE id = ANY($1)`,
kasowanie w paczkach z ograniczoną równoległością.

### 24. `lib/dataExport.ts` — podpis per plik w zagnieżdżonej pętli

[lib/dataExport.ts:25–27](lib/dataExport.ts:25) — `await st.presignGet(...)` w pętli wewnątrz
pętli po assetach. Przy eksporcie konta z setkami assetów to tysiące sekwencyjnych podpisów.
`Promise.all` z ograniczeniem równoległości załatwia sprawę.

### 25. Settings: dwa sekwencyjne fetche tam, gdzie wystarczy jeden `Promise.all`

[app/app/settings/page.tsx:46](app/app/settings/page.tsx:46):

```ts
queryFn: async () => ({
  ...(await api(`/api/workspaces/${wsId}`)),
  ...(await api(`/api/workspaces/${wsId}/members`)),
})
```

Drugie żądanie czeka na pierwsze bez powodu. `Promise.all` przepołowi czas ładowania panelu
workspace'u.

### 26. Formattery `Intl` tworzone od nowa przy każdym wywołaniu

[lib/utils.ts](lib/utils.ts) — `formatDate` i `formatDateTime` wołają `toLocaleDateString` /
`toLocaleString` z obiektem opcji. Każde takie wywołanie konstruuje nowy `Intl.DateTimeFormat`,
co jest o rząd wielkości wolniejsze niż użycie gotowego formattera.

Ma to znaczenie w tabelach admina i w historii ledgera, gdzie formatuje się 25–100 dat na render.

**Jak naprawić.** Wyciągnąć formattery na poziom modułu:

```ts
const DATE_FMT = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric" });
```

### 27. Lokalny gateway plików wczytuje cały plik do pamięci (tylko dev)

[app/api/files/route.ts:31](app/api/files/route.ts:31) — `fs.readFile()` + `new Uint8Array(buf)`
dla całego pliku. Dla ZIP-a 200 MB albo dużego GLB to kopia w RAM-ie przy każdym pobraniu.
Dotyczy wyłącznie środowiska bez skonfigurowanego R2, więc nie wpływa na produkcję — ale
spowalnia lokalną pracę z większymi assetami. Rozwiązanie: `ReadableStream` z `fs.createReadStream`.

---

## Kolejność wdrażania (sugestia)

Uszeregowane wg stosunku efektu do nakładu pracy:

1. **`React.cache()` na `getAppContext`, `getCurrentWorkspace`, `requireUser`** — kilka linii,
   ucina połowę zapytań na każdej nawigacji w `/app`. (punkty 1, 2)
2. **Wyciąć `getSessionUser()` z layoutu marketingowego** — landing i regulaminy stają się
   statyczne. (punkt 3)
3. **Jeden `JobFeedProvider` zamiast trzech instancji hooka** + warunkowy `invalidateQueries`. (punkt 5)
4. **`cacheControl: immutable` na plikach assetów + stabilizacja presigned URL-i** — po tym
   miniatury przestają się przeładowywać. (punkt 6)
5. **Warunkowy polling na `/app/jobs` + zawężony `select()`**. (punkt 7)
6. **Leniwy import `supabase-js` w `GoogleButton`** — −76 kB na `/signup`. (punkt 9)
7. **Statyczny PNG w siatce, GIF na hover** + WebP w `thumbnail()`. (punkt 8)
8. **Indeksy trigramowe i indeksy pod zapytania admina**. (punkty 10, 12)
9. Reszta wg priorytetu.

---

## Czego nie znalazłem (rzeczy zrobione dobrze)

Żeby raport był uczciwy — te rzeczy są już w porządku i nie wymagają zmian:

- `supabaseAdmin()` i `supabaseBrowser()` cache'ują instancję klienta
  ([lib/supabase/admin.ts](lib/supabase/admin.ts), [lib/supabase/browser.ts](lib/supabase/browser.ts)).
- Flagi i cennik mają cache w procesie z sensownym TTL
  ([lib/flags.ts](lib/flags.ts), [lib/credits/pricing.ts](lib/credits/pricing.ts)).
- `three.js` / `@react-three` są poprawnie lazy-loadowane przez `next/dynamic` z `ssr: false`
  ([components/preview/model-viewer.tsx:9](components/preview/model-viewer.tsx:9)) — ~888 kB
  chunków nie trafia do initial bundle. `wavesurfer.js` też ładowany dynamicznie.
- Zapytania na dashboardzie idą przez `Promise.all`
  ([app/app/page.tsx:17](app/app/page.tsx:17)).
- Paginacja kursorowa w `/api/assets` zamiast `OFFSET`
  ([app/api/assets/route.ts](app/api/assets/route.ts)).
- Debounce 300 ms na wyszukiwarkach ([app/app/library/page.tsx:32](app/app/library/page.tsx:32),
  [components/admin/admin-table.tsx:32](components/admin/admin-table.tsx:32)).
- Indeksy pod najczęstsze zapytania aplikacyjne istnieją — `assets_ws_proj_idx`,
  `jobs_ws_created_idx`, `job_status_feed_ws_idx`, PK `(workspace_id, user_id)` na
  `workspace_members` pokrywa `getMembership()`.
- `is_member()` / `is_admin()` są `stable security definer` — Postgres może je cache'ować
  w obrębie zapytania.
- `refetchOnWindowFocus: false` i `staleTime: 10_000` w `QueryClient`
  ([components/providers.tsx](components/providers.tsx)) — rozsądne domyślne.
- `loading="lazy"` na miniaturach w siatce.

---

## Jak zmierzyć efekt

Przed i po każdej zmianie:

- **TTFB / czas renderu serwerowego** — `curl -w "%{time_starttransfer}\n" -o /dev/null -s <url>`
  na `/`, `/pricing` i `/app`.
- **Liczba zapytań do bazy na żądanie** — Supabase Dashboard → Logs → Postgres, albo
  tymczasowy licznik w `supabaseAdmin()` logujący liczbę wywołań per request.
- **Bundle** — `npx next build` i porównanie kolumny "First Load JS"; interesują Cię
  `/`, `/signup`, `/login`, `/app`, `/app/generate/[type]`.
- **Klient** — DevTools → Performance przy scrollowaniu biblioteki (punkt 8) i przy odtwarzaniu
  sprite'a (punkt 18); DevTools → Network z włączonym "Disable cache" **wyłączonym**, żeby
  zobaczyć czy miniatury trafiają w cache po naprawie punktu 6.
- **Pamięć** — DevTools → Memory, snapshot po obejrzeniu 10 modeli 3D pod rząd (punkt 20).

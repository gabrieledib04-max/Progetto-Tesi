# EventSpot — Technical Requirements Document (TRD)

**Versione:** 2.2  
**Data:** 25 novembre 2026  
**Documento collegato:** `EventSpot_PRD.md` (Product Requirements Document)  
**Riferimenti scientifici:** Huang et al. (*Electronics*, 2020); Pagano et al. (*ACM RecSys*, 2016)

---

## 1. Architettura di Sistema (3 Microservizi + Client SPA)

EventSpot adotta un'architettura snella a **3 microservizi indipendenti** orchestrati tramite Docker Compose, esposti al client React esclusivamente attraverso un **API Gateway** (pattern *Backend-for-Frontend*). Tutti i servizi condividono un monorepo TypeScript con tipi di contratto comuni, mantenendo responsabilità, configurazione e ciclo di vita separati.

```
                       +-----------------------------------------+
                       |   React SPA (Browser - OLED / iOS UI)   |
                       | - iPhone-style Bottom Tab Bar           |
                       | - Interactive Canvas Heatmap (Leaflet)  |
                       | - localStorage: Preferiti Local-First   |
                       +--------------------+--------------------+
                                            | HTTPS (Cookie Tecnico HttpOnly)
                                            v
                       +-----------------------------------------+
                       |   1. api-gateway (Fastify :3000)        |
                       |   OAuth PKCE | Session AES-GCM | Docs   |
                       +-------------+-------------+-------------+
                                     |             |
              +----------------------+             +------------------+
              v                                                       v
+-----------------------------------+       +-----------------------------------+
| 2. ingestion-service (Fastify     |       | 3. recommendation-service         |
|    :3001)                         |       |    (Fastify :3002 - Stateless)    |
| - Spotify Session & Genre Enrich. |       | - Context-Driven Scoring Engine   |
| - Open-Meteo Weather & Discretiz. |       | - TF-IDF / Cosine Similarity      |
| - Event Providers Aggregator:     |       | - Spatio-Temporal & Weather Score |
|   Ticketmaster + Plug-in Adapters |       | - Price Filter & Explainability   |
| - Deduplication, Cache, Bucket    |       +-----------------------------------+
+-----------------+-----------------+
                  |
                  v
+-----------------------------------+
|       MongoDB 7 (TTL DB)          |
| - auth_attempts (10m)             |
| - sessions (encrypted, 24h)       |
| - session_ctx_cache (15m)         |
| - weather_cache (1h)              |
| - events_cache (6h fresh / 24h)   |
+-----------------------------------+
```

### Responsabilità dei Microservizi

1. **`api-gateway` (porta interna `3000`):**
   * Unico punto di ingresso pubblico; gestisce CORS, sicurezza HTTP (`@fastify/helmet`), validazione dei payload tramite JSON Schema e generazione della specifica **OpenAPI 3.1** (`@fastify/swagger` + `@fastify/swagger-ui`).
   * Implementa l'intero flusso OAuth 2.0 PKCE verso Spotify, la cifratura/decifratura dei token e il refresh serializzato per sessione (`NFR-R1`, `NFR-R2`).
   * Orchestrazione delle richieste verso `ingestion-service` e `recommendation-service`, propagando l'header `x-correlation-id`.

2. **`ingestion-service` (porta interna `3001`):**
   * Centralizza tutte le integrazioni con i provider esterni dietro interfacce *Adapter* dedicate, gestendo timeout, retry, circuit breaker e caching su MongoDB.
   * **Modulo Contesto:** interroga Spotify (`recently-played` e `currently-playing`), risolve i generi associati agli artisti (Spotify `/v1/artists` + fallback opzionale Last.fm/MusicBrainz), discretizza il timestamp nello slot `weekday-hour`, calcola il Geohash e acquisisce le previsioni da **Open-Meteo API**.
   * **Modulo Eventi & Aggregazione Multi-Provider (`FR-13`):** interroga **Ticketmaster Discovery API** (e gli Adapter complementari registrati per club indipendenti/locali), normalizza gli eventi nel modello canonico interno `NormalizedEvent`, applica deduplicazione spazio-temporale e gestisce *cache-aside*, *stale-if-error*, *single-flight* e rate-limiting a *token bucket*.

3. **`recommendation-service` (porta interna `3002`):**
   * Servizio puramente *stateless* che riceve il Vettore di Stato Contestuale $C$ e la lista di eventi candidati $E$.
   * Applica il filtro budget (`maxPrice`, `includeUnpriced`), calcola lo score *Context-Driven*, gestisce il fallback spazio-temporale in caso di *Missing Context* (`FR-06`) e produce la spiegazione testuale (`FR-08`).

---

## 2. Stack Tecnologico

| Livello | Tecnologia | Motivazione |
| :--- | :--- | :--- |
| **Runtime & Linguaggio** | Node.js 22 LTS + TypeScript 5 (`strict: true`) | Ecosistema asincrono I/O-bound ideale per orchestrazione API e microservizi leggeri. |
| **Framework Backend** | Fastify 5 | Bassa latenza, validazione nativa JSON Schema, generazione automatica OpenAPI 3.1, logging `pino`. |
| **Database & Cache** | MongoDB 7 (con TTL Indexes e indici geospaziali `2dsphere`) | Modello documentale naturale per payload JSON normalizzati; scadenza automatica dei dati effimeri via TTL. |
| **Frontend** | React 19 + Vite + TypeScript + Tailwind CSS + Leaflet | SPA *mobile-first* in tema OLED/Acid-Lime, navigazione stile iPhone Tab Bar, **Mappa Termica** su Canvas HTML5 integrato in Leaflet, preferiti in `localStorage`. |
| **Containerizzazione** | Docker + Docker Compose | Isolamento reale dei 3 microservizi e avvio riproducibile in un solo comando. |
| **Testing & Load Test** | Node Integration Suites, OpenAPI 3.1 Validator, `k6` | Verifica automatizzata di logica, contratti OpenAPI e SLA (`NFR-P1`..`NFR-P5`). |
| **Offline Evaluation** | Python 3.12 (`numpy`, `pandas`, `scikit-learn`) | Script dedicati nel modulo `evaluation/` per calcolare `Precision@10`, `NDCG@10`, `MRR` e `Coverage` nel confronto con la baseline 2D. |

---

## 3. Modello Matematico e Algoritmo Context-Driven

L'algoritmo traduce il cambio di paradigma da *Context-Aware* a *Context-Driven* (*Pagano et al., 2016*): il target della raccomandazione non è uno User ID storico, ma lo **Stato Contestuale** corrente $C$.

### 3.1 Vettore di Stato Contestuale $C$

Per ogni richiesta, `ingestion-service` costruisce lo stato contestuale:

$$C = \langle T_{\text{session}}, \text{slot}_{\text{now}}, \text{loc}_{\text{user}}, W_{\text{now}}, B_{\text{max}} \rangle$$

dove:
* $T_{\text{session}}$ è il vettore ponderato dei generi e tag semantici estratti dagli ultimi $N$ brani riprodotti (default $N = 15$, finestra temporale configurabile fino a $3\text{ h}$). Ogni traccia $k$ in posizione di recency $r_k \in \{1, \dots, N\}$ riceve un peso di decadimento esponenziale:
  $$\alpha_k = e^{-\lambda (r_k - 1)}$$
  con $\lambda = 0.15$, così da dare maggiore peso ai brani ascoltati negli ultimi minuti rispetto a quelli più datati nella sessione.
* $\text{slot}_{\text{now}} = (d, h)$ rappresenta la discretizzazione temporale nel pattern `weekday-hour` ($d \in \{0, \dots, 6\}$, $h \in \{0, \dots, 23\}$), validato da Wang & Tang in *Huang et al. (2020)* come il più efficace per catturare la periodicità settimanale.
* $\text{loc}_{\text{user}} = (\text{lat}, \text{lon})$ sono le coordinate GPS dell'utente.
* $W_{\text{now}}$ è lo stato meteorologico (codice WMO da Open-Meteo, precipitazioni in $\text{mm}$, temperatura).
* $B_{\text{max}}$ è il vincolo opzionale di budget massimo selezionato dall'utente.

### 3.2 Componenti dello Score Situazionale

Dato un evento candidato $e \in E$ (filtrato preventivamente per raggio massimo, finestra date e vincolo $B_{\text{max}}$), il `recommendation-service` calcola quattro sotto-punteggi normalizzati nell'intervallo $[0, 1]$:

1. **Similarità Semantica di Sessione ($\text{Sim}_{\text{sem}}$):**
   I tag/generi della sessione $T_{\text{session}}$ e i tag/generi dell'evento $T_e$ (estratti da `classifications` e artisti in line-up) vengono proiettati in uno spazio vettoriale TF-IDF. La similarità è calcolata tramite *Cosine Similarity* (*Huang et al., 2020*):
   $$\text{Sim}_{\text{sem}}(T_{\text{session}}, T_e) = \frac{\vec{v}(T_{\text{session}}) \cdot \vec{v}(T_e)}{\|\vec{v}(T_{\text{session}})\| \cdot \|\vec{v}(T_e)\|}$$
   Se un artista della sessione attiva è presente esattamente nella line-up dell'evento $e$, viene applicato un boost diretto ($\text{Sim}_{\text{sem}} = 1.0$).

2. **Congruenza Temporale ($\text{Cong}_{\text{time}}$):**
   Combina la prossimità temporale rispetto all'istante corrente (privilegiando eventi imminenti o nel weekend prossimo rispetto a eventi lontani mesi) e la compatibilità dello slot `weekday-hour` (*Huang et al., 2020*):
   $$\text{Cong}_{\text{time}}(\text{slot}_{\text{now}}, t_e) = \beta \cdot e^{-\gamma \cdot \Delta \text{days}(t_{\text{now}}, t_e)} + (1 - \beta) \cdot \text{SlotMatch}(\text{slot}_{\text{now}}, t_e)$$
   dove $\text{SlotMatch} \in [0, 1]$ assegna punteggio massimo a fasce serali/weekend coerenti con la finestra di ricerca.

3. **Decadimento Spaziale ($\text{Decay}_{\text{spatial}}$):**
   Calcola la distanza geodetica $d(\text{loc}_{\text{user}}, \text{loc}_e)$ tramite formula di Haversine e applica un decadimento normalizzato rispetto al raggio massimo $R_{\text{max}}$ impostato dall'utente (*Huang et al., 2020*):
   $$\text{Decay}_{\text{spatial}}(d) = \max\left(0, 1 - \frac{d(\text{loc}_{\text{user}}, \text{loc}_e)}{R_{\text{max}}}\right)$$

4. **Compatibilità Meteorologica ($\text{Compat}_{\text{weather}}$):**
   Utilizza le previsioni Open-Meteo per la data e posizione dell'evento (se entro $7$ giorni) o il meteo corrente. Gli eventi sono classificati euristicamente in `indoor` (club, teatri, palazzetti) o `outdoor` (parchi, arene estive, festival all'aperto):
   * Condizioni avverse (pioggia/temporale/vento forte) + venue `outdoor` $\rightarrow 0.2$ (penalizzazione).
   * Condizioni avverse + venue `indoor` $\rightarrow 1.0$ (bonus situazionale).
   * Condizioni favorevoli $\rightarrow 0.85$ (neutro-positivo per entrambi).
   * Meteo non disponibile (`NFR-R5`) $\rightarrow$ peso $w_4$ azzerato e ridistribuito proporzionalmente.

### 3.3 Funzione di Scoring Finale e Fallback

Lo score finale in modalità standard (**Context-Driven**) è:

$$\text{Score}(e \mid C) = w_1 \cdot \text{Sim}_{\text{sem}} + w_2 \cdot \text{Cong}_{\text{time}} + w_3 \cdot \text{Decay}_{\text{spatial}} + w_4 \cdot \text{Compat}_{\text{weather}}$$

con pesi di default configurabili tramite variabili d'ambiente:

$$w_1 = 0.40, \quad w_2 = 0.20, \quad w_3 = 0.30, \quad w_4 = 0.10 \quad \left(\sum w_i = 1\right)$$

**Modalità Fallback (*Missing Context*, `FR-06`):**
Quando $T_{\text{session}} = \emptyset$ (utente non loggato, senza ascolti recenti o Spotify non raggiungibile), $w_1$ viene azzerato e i pesi residui vengono rinormalizzati privilegiando la prossimità geografica:

$$w'_2 = 0.30, \quad w'_3 = 0.55, \quad w'_4 = 0.15$$

### 3.4 Filtro Prezzi (`FR-07`)

Il filtro budget agisce in fase di pre-filtraggio sui candidati prima dell'ordinamento finale:
* Se `maxPrice` è specificato e l'evento possiede `priceRange.min`, l'evento è mantenuto se $\text{priceRange.min} \le \text{maxPrice}$.
* Se l'evento non espone `priceRanges` su Ticketmaster, viene incluso solo se `includeUnpriced=true` e contrassegnato con `priceStatus: "UNAVAILABLE"`.

### 3.5 Generazione dell'Explainability (`FR-08`)

Per ogni evento raccomandato, `recommendation-service` ispeziona i contributi pesati $w_i \cdot s_i$ e compone dinamicamente un array strutturato `reasons` più una stringa leggibile, ad esempio:

> *"Affine ai generi del tuo ascolto odierno (indie rock, alternative); A soli 5.4 km dalla tua posizione (Milano); Concerto in programma questo weekend; Venue al coperto (Fabrique), protetta dal meteo previsto."*

---

## 4. Frontend Design System, Menu iOS-Style & Mappa Termica

### 4.1 Design System OLED & Acid Lime (`U-7`)

Per massimizzare leggibilità notturna e identità visiva moderna, la SPA adotta i seguenti token CSS root:
* **Superfici:** `--bg-canvas: #000000` (nero OLED), `--bg-surface: #0c0d0f`, `--bg-card: #141517`, `--bg-card-subtle: #1c1d21`, `--border-subtle: #26282c`.
* **Accento Primario:** `--accent-lime: #c2ff00` (con varianti hover `#d4ff4d` e `--text-on-lime: #090a0b`), affiancato da token semantici secondari per feedback puntuali (`--accent-emerald`, `--accent-rose`, `--accent-sky`).
* **Tipografia:** Famiglia sans geometrica (`Plus Jakarta Sans` / `Inter`) con gerarchia display ad alto peso per il greeting hero (*"Ciao ascoltatore?"* / *"Ecco i live per te"*).
* **Header & Hero Banner:** Top bar essenziale con wordmark/pin in acid-lime a sinistra e action pill compatta a destra; banner di benvenuto in evidenza quando l'utente non ha ancora connesso la sessione.

### 4.2 Navigazione Stile iPhone (*iOS Bottom Tab Bar*)

L'intera navigazione dell'applicazione è affidata a una **Tab Bar inferiore in stile iOS** (`position: fixed; bottom: 0` con `env(safe-area-inset-bottom)`, effetto *frosted glass* `backdrop-blur-2xl`, sfondo `rgba(18, 19, 22, 0.84)` e bordo superiore `1px solid rgba(255, 255, 255, 0.10)`):
1. **`Per te`**: Feed principale con Context Ribbon compatto, filtri GPS/raggio/budget e griglia delle raccomandazioni *Context-Driven*.
2. **`Mappa`**: Vista cartografica con **Mappa Termica interattiva** degli eventi.
3. **`Preferiti`**: Lista *Local-First* letta dal `localStorage` con badge numerico live.
4. **`Account`**: Gestione autenticazione (Spotify OAuth PKCE / Demo 1-Click), pseudonimo di sessione `usr_...`, ispezione dei tag Spotify attivi, impostazioni raggio default e pulsante irreversibile **GDPR Right to Erasure** (`DELETE /v1/auth/me`).

### 4.3 Collocazione Privacy, Cookie e Note Legali nel Footer (`U-6`, `U-7`)

Tutte le informative legali e sulla trasparenza sono spostate nell'area **footer inferiore** (sormontata con adeguato `padding-bottom` dalla dock iOS):
* Voci esposte: `Privacy`, `Cookie`, `Termini`, `Privacy-by-Design`, `OpenAPI 3.1`, `GitHub`.
* **Policy Cookie Trasparente:** EventSpot impiega esclusivamente **$1$ cookie tecnico di sessione** (`eventspot_session`, attributi `HttpOnly; SameSite=Lax; Path=/`) strettamente necessario al mantenimento della sessione autenticata. Non sono presenti cookie di profilazione, analitici o di terze parti.

### 4.4 Architettura della Mappa Termica (`FR-12`, `US-11`)

La vista `Mappa` (`EventHeatmapView.tsx`) rende una mappa geospaziale interattiva basata su **Leaflet** senza dipendere da API proprietarie a pagamento:
* **Base Layer Cartografico:** Tile raster in tema scuro *CartoDB DarkMatter* (`basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png`), coerenti con lo sfondo `#000000`.
* **Layer Termico Custom (`CanvasHeatmapLayer` su HTML5 `<canvas>`):**
  - Estende `L.Layer` sincronizzandosi con gli eventi `move`, `zoom`, `resize` della mappa e scalando al `devicePixelRatio` del display.
  - Per ciascun evento $e \in E_{\text{ranked}}$, proietta $(\text{lat}_e, \text{lon}_e)$ in coordinate viewport $(x_e, y_e)$ e disegna un gradiente radiale gaussiano con intensità:
    $$I(e) = \begin{cases} \dfrac{\text{Score}(e \mid C)}{100} & \text{in modalità "Affinità Context-Driven"} \\ 0.75 & \text{in modalità "Densità Eventi"} \end{cases}$$
  - Applica una *lookup table* (LUT a $256$ step) sulla matrice dei canali alpha accumulati per mappare la densità in scala termica calibrata sul tema dell'app: blu notte $\rightarrow$ verde smeraldo $\rightarrow$ **acid lime (`#c2ff00`)** $\rightarrow$ ambra/corallo nei focolai ad alta concentrazione.
* **Overlay Geometrici & Interazione:**
  - Cerchio tratteggiato del raggio di ricerca attivo $R_{\max}$ attorno a `loc_user` per rendere visivamente interpretabile il decadimento spaziale `Decay_spatial`.
  - Marker interattivi cliccabili sulle singole venue che aprono una scheda rapida ancorata in basso con punteggio, distanza Haversine, meteo e pulsanti *Dettagli* / *Biglietti*.

---

## 5. Modello Dati e Privacy-by-Design

Per aderire al principio di minimizzazione GDPR (*Pagano et al., 2016*), MongoDB memorizza esclusivamente **dati tecnici ed effimeri** con cancellazione automatica tramite **TTL Index**. Nessuna cronologia di ascolto o preferenza permanente viene salvata lato server.

### 5.1 Collezioni MongoDB

1. **`auth_attempts`** (`api-gateway`, TTL: $10\text{ minuti}$): `state`, `codeVerifier`, `createdAt`.
2. **`sessions`** (`api-gateway`, TTL: $24\text{ ore}$): `sessionIdHash` (SHA-256), `spotifyUserHash` (HMAC-SHA256), `encryptedAccessToken` / `encryptedRefreshToken` (AES-256-GCM), `tokenExpiresAt`, `lastActiveAt`.
3. **`session_context_cache`** (`ingestion-service`, TTL: $15\text{ minuti}$): `sessionIdHash`, `tags[]`, `artistNames[]`, `trackCount`, `fetchedAt`.
4. **`events_cache`** (`ingestion-service`, TTL fisico: $24\text{ ore}$, freschezza logica: $6\text{ ore}$): `cacheKey` (`geohash5:radiusBucket:dateFrom:dateTo`), `events[]`, `freshUntil`, `staleUntil`.
5. **`weather_cache`** (`ingestion-service`, TTL: $1\text{ ora}$): `geohash4`, `current`, `dailyForecast`, `fetchedAt`.

### 5.2 Preferiti Local-First (`localStorage`)

Chiave nel browser: `eventspot_favorites_v1`. Contiene un array JSON di snapshot minimi (`eventId`, `name`, `artistNames`, `venue`, `city`, `startDateTime`, `priceRange`, `ticketUrl`, `imageUrl`, `savedAt`), garantendo zero tracciamento server-side (`FR-10`).

---

## 6. Contratto API (OpenAPI 3.1)

### 6.1 Endpoint Pubblici (`api-gateway`)

| Metodo | Endpoint | Descrizione |
| :--- | :--- | :--- |
| `GET` | `/v1/auth/login` | Avvia il flusso OAuth 2.0 PKCE verso Spotify (`302`). |
| `GET` | `/v1/auth/callback` | Valida `state`, scambia `code`, crea sessione e imposta il cookie tecnico `HttpOnly`. |
| `POST` | `/v1/auth/mock-login` | Istanzia una sessione demo effimera per test e valutazione in sede di tesi. |
| `GET` | `/v1/auth/session` | Verifica stato sessione corrente e pseudonimo `userHash`. |
| `POST` | `/v1/auth/logout` | Invalida la sessione corrente e rimuove il cookie. |
| `DELETE` | `/v1/auth/me` | Diritto all'oblio GDPR: elimina sessione, token cifrati e `session_context_cache`. |
| `GET` | `/v1/matches` | Restituisce la lista ordinata di eventi *Context-Driven* (per feed e heatmap). |
| `GET` | `/v1/events` | Ricerca libera (Discovery) senza personalizzazione di sessione. |
| `GET` | `/v1/events/{eventId}` | Dettaglio normalizzato del singolo evento. |
| `GET` | `/v1/health` | Stato di salute del gateway e dei microservizi downstream. |
| `GET` | `/v1/docs` | Interfaccia OpenAPI 3.1 interattiva e download YAML/JSON. |

### 6.2 Endpoint Interni (Rete Privata)

* `ingestion-service`: `POST /internal/context/build`, `GET /internal/events/search`, `GET /internal/events/:eventId`, `DELETE /internal/context/cache/:sessionIdHash`.
* `recommendation-service`: `POST /internal/recommendations/rank`.

### 6.3 Gestione Errori (RFC 9457)

Ogni errore restituisce `Content-Type: application/problem+json` con campi `type`, `title`, `status`, `detail`, `errorCode` (`SESSION_REAUTH_REQUIRED`, `VALIDATION_ERROR`, `UPSTREAM_UNAVAILABLE`) e `correlationId`.

---

## 7. Integrazioni Esterne, Strategia Multi-Provider e Variabili d'Ambiente

### 7.1 Provider Attuali e Strategia Multi-Sorgente (`FR-13`)

| Provider | Endpoint / Ruolo | Limiti & Mitigazione | Strategia Fallback / Note |
| :--- | :--- | :--- | :--- |
| **Spotify Web API** | `/v1/me/player/recently-played`, `/v1/me/player/currently-playing`, `/v1/artists` | Cache `session_context_cache` (TTL $15\text{ min}$); refresh serializzato. | Se in `429` o offline: usa cache o fallback spazio-temporale puro (`NFR-R3`). |
| **Ticketmaster Discovery API** | `/discovery/v2/events.json` (`classificationName=music`) | $5\text{ req/s}$, $5000\text{ req/day}$. Cache `geohash5` + *stale-if-error* $24\text{ h}$ + *single-flight* + *token bucket*. | Cache scaduta fino a $24\text{ h}$ (`NFR-R4`). Forte copertura su stadi/palasport, minore sui piccoli club. |
| **Open-Meteo API** | `/v1/forecast` (nessuna key richiesta) | Cache `geohash4` (TTL $1\text{ h}$). | Azzeramento peso $w_4$ senza bloccare la risposta (`NFR-R5`). |
| **Estensione Multi-Provider (`FR-13`)** | Bandsintown API, Eventbrite / Dice.fm / Xceed feeds, Schema.org JSON-LD (`MusicEvent`) | Interfaccia comune `EventSourceAdapter` con fan-out parallelo e deduplicazione `(artist + venue + date)`. | Risolve la copertura su live club indipendenti, festival locali e scene regionali (es. Puglia). |

### 7.2 Configurazione Variabili d'Ambiente (`.env`)

Tutte le chiavi devono essere inserite in `.env` nella root del progetto (copiato da `.env.example`, escluso da Git via `.gitignore`):
* `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REDIRECT_URI=http://127.0.0.1:3000/v1/auth/callback` (Spotify vieta esplicitamente `localhost` e richiede l'IP di loopback `127.0.0.1` o HTTPS)
* `TICKETMASTER_API_KEY`
* `LASTFM_API_KEY` (opzionale, arricchimento generi secondario)
* `TOKEN_ENCRYPTION_KEY` (64 caratteri hex = 32 byte per AES-256-GCM)
* `MOCK_EXTERNAL_PROVIDERS=false` (impostare `false` per interrogare le API reali anziché i dati demo locali)

---

## 8. Matrice di Tracciabilità

| Requisito PRD | Componente TRD | Verifica / Test |
| :--- | :--- | :--- |
| `FR-01`, `FR-02`, `US-01`, `US-09` | `api-gateway` (OAuth PKCE, AES-256-GCM, `sessions`) | Test integrazione auth + verifica sicurezza cookie/log |
| `FR-03`, `FR-04` | `ingestion-service` (Spotify, Last.fm, Open-Meteo, `weekday-hour`) | Test discretizzazione + mock provider |
| `FR-05`, `FR-08`, `US-02`, `US-03` | `recommendation-service` (TF-IDF, scoring, `reasons`) | Test unitari scoring + Offline Evaluation Python (`O-1`, `O-2`) |
| `FR-06`, `US-05` | `recommendation-service` (rinormalizzazione pesi fallback) | Test integrazione con sessione Spotify vuota |
| `FR-07`, `US-04` | `ingestion-service` + `recommendation-service` (`maxPrice`) | Test validazione `422` + casi `priceRanges` mancanti |
| `FR-10`, `US-06` | React SPA (`eventspot_favorites_v1` in `localStorage`) | Verifica UI + assenza scrittura su MongoDB |
| `FR-12`, `US-11` | `EventHeatmapView.tsx` (Leaflet + Canvas Gaussian LUT) | Verifica rendering termico su score/densità e marker venue |
| `U-7`, `US-09` | Design System OLED/Acid-Lime, iPhone Bottom Tab Bar, Footer Legale | Ispezione responsive mobile/desktop e modali Privacy/Cookie |
| `FR-13`, `US-12` | `ingestion-service` Multi-Provider Adapter Architecture | Predisposizione `NormalizedEvent` & deduplicazione |
| `NFR-R1`..`NFR-R8` | Circuit breaker, retry, `stale-if-error`, RFC 9457 | Test tolleranza ai guasti e formati di errore |
| `O-5`, `US-10` | `@fastify/swagger` OpenAPI 3.1 su `api-gateway` | Esposizione live e validazione schema `/v1/docs/json` |

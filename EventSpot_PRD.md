# EventSpot — Product Requirements Document (PRD)

**Versione:** 2.2  
**Data:** 25 novembre 2026  
**Contesto:** Progetto di tesi triennale in Ingegneria Informatica, Politecnico di Bari  
**Documento collegato:** `EventSpot_TRD.md` (Technical Requirements Document)

Ogni requisito possiede un identificativo univoco (`O-`, `US-`, `FR-`, `U-`, `NFR-`) richiamato nel TRD per garantire la piena tracciabilità *requisiti $\rightarrow$ architettura $\rightarrow$ validazione*.

---

## 1. Executive Summary

**Cos'è EventSpot.** EventSpot è una web app sperimentale di raccomandazione per eventi musicali dal vivo che implementa un'architettura **Context-Driven** e **Session-Based**. Invece di profilare l'utente tramite lo storico di ascolto di lungo periodo, acquisisce l'intento musicale immediato dalla sessione recente su Spotify e lo fonde con fattori contestuali osservabili in tempo reale — posizione GPS, fascia oraria e giorno della settimana, condizioni meteorologiche e vincoli di budget — per ordinare, rappresentare geospazialmente (anche tramite **mappa termica interattiva**) e spiegare gli eventi live raccolti dai cataloghi connessi.

**Il problema.** I sistemi commerciali di scoperta eventi soffrono di tre limiti strutturali evidenziati dalla letteratura scientifica:
1. **Frammentazione dei dati:** le preferenze musicali risiedono nelle piattaforme di streaming, mentre l'offerta live è dispersa tra grandi circuiti di ticketing (es. Ticketmaster) e circuiti indipendenti/locali.
2. **Assunto delle Preferenze Immutabili (ImP):** gli approcci tradizionali bidimensionali ($R : \text{User} \times \text{Item} \rightarrow \text{Rating}$) presuppongono che i gusti di un utente siano statici nel tempo, ignorando il contesto immediato (*Pagano et al., ACM RecSys 2016*).
3. **Continuous Cold-Start:** negli *Event-Based Social Networks* (EBSN) gli eventi hanno un ciclo di vita breve (*short lifetime*) e mancano di valutazioni esplicite pregresse, rendendo inefficace il *Collaborative Filtering* classico (*Huang et al., Electronics 2020*).

**Valore aggiunto.**
* **Per l'utente:** raccomandazioni pertinenti al "qui e ora" senza profilazione invasiva, esplorabili sia in elenco sia tramite **heatmap geospaziale** dei concerti attorno alla propria posizione, filtrabili per budget e accompagnate da spiegazioni *white-box* immediate.
* **Per il progetto di tesi:** prototipo applicativo a microservizi che traduce sul campo la transizione teorica da *Context-Aware* a *Context-Driven*, affrontando vincoli ingegneristici reali (OAuth 2.0 PKCE, rate-limiting, caching distribuito, deprecazione API di terze parti, aggregazione multi-sorgente, *Privacy-by-Design*) e validando quantitativamente l'approccio rispetto a una baseline 2D tramite test offline.

**Obiettivi misurabili**

| ID | Obiettivo | Metrica | Target v1.0 |
| :--- | :--- | :--- | :--- |
| `O-1` | Rilevanza (Validazione Offline) | `Precision@10` e `NDCG@10` del motore *Context-Driven* rispetto alla baseline 2D statica | `Precision@10` $\ge 0.60$ e incremento misurabile su baseline |
| `O-2` | Diversità (*Popping the Bubble*) | `Coverage` del catalogo eventi raccomandati nel benchmark offline | Superiore alla baseline 2D |
| `O-3` | Reattività | Latenza $p_{95}$ di `GET /v1/matches` con cache eventi calda | $\le 300\text{ ms}$ |
| `O-4` | Mitigazione rate-limit | Cache hit ratio sulle chiamate verso i provider esterni nel test di carico | $\ge 80\%$ |
| `O-5` | Contratto API documentato | Endpoint pubblici esposti dall'API Gateway descritti e validati in OpenAPI 3.1 | $100\%$ |

**Non-obiettivi.** Acquisto diretto di biglietti; riproduzione audio; funzioni social o chat; raccomandazione di artisti senza eventi in programma; addestramento di modelli di Machine Learning sui dati Spotify (vietato dai Termini d'Uso della piattaforma); conservazione persistente su database dello storico di ascolto o dei preferiti dell'utente; utilizzo di cookie di profilazione/marketing.

---

## 2. Target Audience e Personas

**Segmento primario:** ascoltatori attivi di musica su Spotify (18–35 anni) che partecipano a concerti, live club o festival e cercano suggerimenti rapidi coerenti con il proprio momento attuale e budget.

* **Marco, 23 anni — lo studente universitario.** Decide spesso all'ultimo momento cosa fare il venerdì o sabato sera. *Bisogno:* trovare un live club vicino, coerente con ciò che sta ascoltando oggi e con un biglietto sotto i 25 €. *Frustrazione:* le app classiche gli propongono concerti lontani o artisti che ascoltava anni fa.
* **Giulia, 29 anni — l'appassionata di eventi all'aperto e festival.** Pianifica uscite nel weekend spostandosi fino a $150\text{ km}$. *Bisogno:* visualizzare a colpo d'occhio su mappa termica dove si concentrano gli eventi più affini, verificare la compatibilità col meteo previsto e filtrare per data e fascia di prezzo.
* **Davide, 35 anni — l'utente attento alla privacy.** Diffida delle piattaforme che richiedono permessi estesi o salvano profili storici permanenti o cookie di tracciamento. *Bisogno:* scope OAuth minimi, zero cookie di profilazione, controllo locale sui preferiti e cancellazione immediata dei dati tecnici.
* **Stakeholder accademici (Relatore e Commissione di Tesi):** richiedono rigore metodologico, tracciabilità dei requisiti, aderenza alla letteratura citata e sperimentazione riproducibile.

---

## 3. User Stories

| ID | User Story | Criteri di accettazione |
| :--- | :--- | :--- |
| `US-01` | Come utente Spotify, voglio autenticarmi con il mio account concedendo solo i permessi minimi di lettura degli ascolti recenti affinché la mia privacy sia tutelata. | Flusso OAuth 2.0 PKCE con scope limitato alla sessione recente; la password Spotify non transita mai da EventSpot; i token restano confinati nel backend. |
| `US-02` | Come utente, voglio ricevere eventi musicali coerenti con la mia sessione di ascolto attuale, la mia posizione GPS, l'orario e il meteo affinché i suggerimenti rispecchino la mia situazione immediata. | La lista è ordinata per punteggio *Context-Driven*; ogni voce mostra artista, venue, città, data/ora, fascia di prezzo (se disponibile) e distanza. |
| `US-03` | Come utente, voglio capire perché un evento mi è stato raccomandato affinché possa fidarmi del suggerimento. | Ogni card evento include una motivazione trasparente in linguaggio naturale basata sui fattori contestuali attivi (generi della sessione, slot temporale, distanza, meteo). |
| `US-04` | Come utente, voglio filtrare gli eventi per località/raggio, intervallo di date e fascia di prezzo (budget massimo) affinché i risultati siano compatibili con la mia disponibilità economica e logistica. | La modifica dei filtri aggiorna i risultati entro gli SLA; gli eventi privi di prezzo possono essere inclusi o esclusi tramite opzione esplicita; parametri non validi restituiscono `422`. |
| `US-05` | Come utente che non ha ascoltato brani di recente su Spotify, voglio comunque visualizzare eventi rilevanti per la mia zona e fascia oraria affinché l'app resti utile anche senza sessione musicale attiva. | In assenza di tracce recenti (*Missing Context*), il sistema attiva il fallback spazio-temporale puro (GPS + slot `weekday-hour` + meteo) segnalandolo all'utente. |
| `US-06` | Come utente, voglio salvare eventi tra i preferiti senza che vengano registrati su un database remoto affinché restino privati sul mio dispositivo. | I preferiti sono salvati esclusivamente nel `localStorage` del browser; l'aggiunta è idempotente e gli eventi già trascorsi vengono evidenziati. |
| `US-07` | Come utente, voglio accedere alla pagina ufficiale di ticketing per acquistare il biglietto. | Link esterno con attribuzione verso il provider/biglietteria; nessun dato di pagamento gestito da EventSpot. |
| `US-08` | Come utente, voglio che l'app continui a funzionare in modo degradato ma chiaro se un servizio esterno (Spotify, Ticketmaster o meteo) è lento o irraggiungibile. | Utilizzo della cache anche scaduta con avviso di freschezza dei dati; nessun crash se il servizio meteo non risponde. |
| `US-09` | Come utente attento alla privacy, voglio disconnettermi ed eliminare immediatamente la mia sessione server-side e consultare policy su privacy e cookie dal footer in basso. | Il logout e `DELETE /v1/auth/me` rimuovono sessione, token cifrati e cache di contesto effimera; link a Privacy, Cookie, Termini e Privacy-by-Design sempre accessibili nel footer. |
| `US-10` | Come valutatore della tesi, voglio consultare la documentazione OpenAPI 3.1 interattiva per ispezionare e testare il contratto pubblico. | Specifica OpenAPI 3.1 esposta dall'API Gateway e validata automaticamente in CI. |
| `US-11` | Come utente, voglio visualizzare una mappa termica (*heatmap*) dei concerti intorno a me per cogliere visivamente le aree geografiche a più alta affinità contestuale o densità di eventi. | Tab dedicata `Mappa` nel menu inferiore in stile iOS, con overlay termico ponderato sullo score o densità, perimetro del raggio $R_{\max}$ e marker interattivi delle venue. |
| `US-12` | Come utente di zone non coperte capillarmente da Ticketmaster, voglio che il sistema possa aggregare anche sorgenti complementari per eventi indie e club locali. | Architettura Adapter modulare in `ingestion-service` predisposta per aggregazione multi-provider e deduplicazione eventi. |

---

## 4. Requisiti FURPS+

### 4.1 Functionality

| ID | Requisito |
| :--- | :--- |
| `FR-01` | **Autenticazione OAuth 2.0.** Login tramite Spotify Authorization Code Flow con PKCE (`S256`) e parametro `state` monouso. Scope richiesti: `user-read-recently-played` e `user-read-currently-playing`. Modalità Demo 1-Click disponibile per valutazione accademica. |
| `FR-02` | **Logout e Cancellazione Sessione.** Invalidazione della sessione sul database, rimozione dei token cifrati, cancellazione della cache di contesto effimera e pulizia del cookie `HttpOnly`. |
| `FR-03` | **Acquisizione Contesto Musicale di Sessione.** Estrazione degli ultimi brani riprodotti nella sessione recente da Spotify, risoluzione dei relativi artisti e arricchimento dei generi/tag semantici (Spotify Artists API + fallback Last.fm/MusicBrainz). |
| `FR-04` | **Acquisizione Contesto Spazio-Temporale e Meteo.** Raccolta della posizione GPS del browser (o città selezionata), discretizzazione dell'istante corrente nel pattern `weekday-hour` (*Huang et al., 2020*) e acquisizione delle condizioni meteo tramite Open-Meteo API. |
| `FR-05` | **Matchmaker Context-Driven.** Calcolo dello score situazionale per ciascun evento candidato combinando similarità semantica (TF-IDF / Cosine Similarity sui generi di sessione), congruenza temporale, decadimento spaziale e compatibilità meteo (venue indoor vs outdoor). |
| `FR-06` | **Fallback Missing Context.** In caso di sessione Spotify vuota o priva di generi risolvibili, attivazione automatica del ranking spazio-temporale puro (prossimità geografica, congruenza `weekday-hour`, compatibilità meteo) con avviso esplicito in UI. |
| `FR-07` | **Filtro Prezzi e Parametri di Ricerca.** Supporto ai filtri: località/coordinate, raggio ($10\text{--}200\text{ km}$, default $50\text{ km}$), finestra temporale (default prossimi $30$ giorni, estendibile fino a $90$), budget massimo (`maxPrice` in valuta locale) e flag `includeUnpriced` per gestire eventi senza prezzo dichiarato. |
| `FR-08` | **Explainability Dinamica.** Generazione di una spiegazione leggibile per ogni evento raccomandato che espliciti i driver principali del punteggio (es. tag di sessione, distanza, fascia oraria, meteo). |
| `FR-09` | **Discovery e Dettaglio Evento.** Esplorazione libera del catalogo eventi normalizzato con ordinamento (rilevanza contestuale, data, distanza, prezzo crescente) e vista dettaglio (line-up, venue, mappa/distanza, fascia di prezzo, previsione meteo, link biglietti). |
| `FR-10` | **Preferiti Local-First.** Gestione dei preferiti (aggiunta, rimozione, lista) interamente lato client tramite `localStorage`, salvando uno snapshot minimo dell'evento. |
| `FR-11` | **Trasparenza sullo Stato dei Dati.** Esposizione nei metadati di risposta dell'età della cache eventi, della modalità di calcolo (`context_driven` vs `spatio_temporal_fallback`) e di eventuali servizi terzi in stato degradato. |
| `FR-12` | **Mappa Termica Interattiva degli Eventi (*Heatmap*).** Visualizzazione cartografica geospaziale in tema scuro con strato termico continuo calcolato in tempo reale sul punteggio contestuale ($Score \in [0, 100]$) o sulla densità degli eventi, visualizzazione del raggio di ricerca $R_{\max}$ e marker interattivi per l'ispezione rapida e il dettaglio concerto. |
| `FR-13` | **Architettura Multi-Provider & Deduplicazione Eventi.** Supporto architetturale in `ingestion-service` per combinare Ticketmaster Discovery API con provider complementari dedicati a live club e festival indipendenti (es. Bandsintown, Dice/Xceed, feed JSON-LD / eventi organizzatori), applicando deduplicazione deterministica su `(artistNormalized, venueGeohash, localDate)`. |

### 4.2 Usability & Design System

* `U-1` Dal primo accesso alla prima lista di raccomandazioni in al massimo $3$ interazioni (login Spotify / Demo, conferma geolocalizzazione).
* `U-2` Interfaccia web responsive *mobile-first* (da $360\text{ px}$), conforme a WCAG 2.2 livello AA.
* `U-3` Stati espliciti per caricamento (*skeleton*), risultati vuoti, fallback *Missing Context*, dati da cache scaduta ed errori recuperabili.
* `U-4` Badge contestuali chiari (es. stato meteo della serata, fascia di prezzo, distanza in km e motivazione del match).
* `U-5` Supporto localizzazione italiana coerente (formati data, valuta EUR e distanze in km).
* `U-6` Informativa trasparente su Privacy, Cookie e assenza di profilazione storica persistente accessibile dal footer inferiore.
* `U-7` **Design System Dark OLED + Acid Lime & Navigazione iOS-Style:**
  - Tema visivo basato su sfondo nero OLED ad alto contrasto (`#000000`), superfici elevate grigio antracite (`#141517`) con bordi sottili (`#26282c`) e accento primario *Acid Lime* (`#c2ff00`) per call-to-action, badge di stato e focus visivo.
  - **Menu di navigazione stile iPhone (*iOS Tab Bar*):** dock inferiore traslucido *frosted-glass* (`backdrop-blur`) con icone ed etichette impilate per le 4 viste principali (`Per te`, `Mappa`, `Preferiti`, `Account`), garantendo ergonomia *thumb-zone* su mobile e stile app nativa su desktop.
  - **Footer dedicato a Privacy, Cookie e Note Legali:** collocazione ordinata di tutte le voci legali e di trasparenza (`Privacy`, `Cookie`, `Termini`, `Privacy-by-Design`, `OpenAPI 3.1`, `GitHub`) nel footer inferiore della pagina, lasciando l'header superiore essenziale e pulito.

### 4.3 Reliability

| ID | Scenario | Comportamento richiesto |
| :--- | :--- | :--- |
| `NFR-R1` | Access token Spotify scaduto | Refresh trasparente serializzato lato backend; nessuna interruzione per l'utente. |
| `NFR-R2` | Refresh token revocato o invalido | Eliminazione sessione e risposta `401` con codice `SESSION_REAUTH_REQUIRED`. |
| `NFR-R3` | Spotify non disponibile o in `429` | Utilizzo della cache di sessione effimera se presente; altrimenti attivazione del fallback spazio-temporale puro (`FR-06`) con avviso di degrado. |
| `NFR-R4` | Ticketmaster non disponibile o in `429` | Utilizzo della cache eventi condivisa anche scaduta fino a $24\text{ h}$ (*stale-if-error*) con flag `stale: true`; in assenza di cache, `503` con `Retry-After`. |
| `NFR-R5` | Open-Meteo non disponibile o lento | Degrado trasparente: il peso del fattore meteo viene azzerato e ridistribuito senza bloccare la risposta. |
| `NFR-R6` | Eventi privi di `priceRanges` | Gestione esplicita tramite filtro `includeUnpriced` (default `true` senza filtro prezzo attivo, configurabile quando `maxPrice` è impostato). |
| `NFR-R7` | Chiamate inter-servizio ed esterne | Timeout espliciti, massimo $2$ retry con backoff esponenziale e jitter su richieste idempotenti, circuit breaker per provider. |
| `NFR-R8` | Formato degli errori | Tutte le risposte di errore rispettano RFC 9457 (`application/problem+json`). |

### 4.4 Performance

| ID | Operazione | Target SLA |
| :--- | :--- | :--- |
| `NFR-P1` | `GET /v1/matches` (cache eventi e meteo calda) | $p_{95} \le 300\text{ ms}$, $p_{99} \le 600\text{ ms}$ |
| `NFR-P2` | `GET /v1/matches` (cache fredda con chiamate a terzi) | $p_{95} \le 3\text{ s}$ |
| `NFR-P3` | Endpoint di sessione e health check | $p_{95} \le 100\text{ ms}$ |
| `NFR-P4` | Throughput | $\ge 50\text{ req/s}$ su istanza Docker locale con cache calda |
| `NFR-P5` | Efficacia della cache eventi | Hit ratio $\ge 80\%$ nello scenario di test di carico |

### 4.5 Supportability

* **Linguaggio e qualità del codice:** Node.js 22 LTS con **TypeScript 5 (strict mode)** per tutti i microservizi backend e per il client React; ESLint + Prettier; Conventional Commits.
* **Test:** copertura $\ge 80\%$ sulla logica di dominio (motore di scoring, discretizzazione contestuale, normalizzazione eventi); test di contratto sulla specifica OpenAPI 3.1; suite Python separata per la validazione offline della tesi.
* **Osservabilità:** log strutturati JSON (`pino`) con `x-correlation-id` propagato tra i microservizi; divieto assoluto di loggare token, cookie, codici OAuth o coordinate esatte non anonimizzate.
* **Deploy e configurazione:** containerizzazione completa via Docker e Docker Compose; configurazione tramite variabili d'ambiente (*twelve-factor app*).

### 4.6 Vincoli (il "+" di FURPS+)

* **Architettura:** sistema distribuito a **3 microservizi indipendenti** (`api-gateway`, `ingestion-service`, `recommendation-service`); il client React comunica esclusivamente con l'`api-gateway` e mai direttamente con Spotify, Ticketmaster, Open-Meteo o Last.fm.
* **Stack:** Backend **Node.js + Fastify**; Database **MongoDB** (usato esclusivamente per sessioni e cache effimere tramite TTL index); Client **React (Vite + TypeScript + Leaflet)**; script **Python 3.12** per l'evaluation harness offline.
* **Limiti API Spotify:** il sistema non deve dipendere dagli endpoint deprecati `audio-features` e `recommendations`.
* **Legale, Cookie e Privacy:** piena conformità GDPR (*Privacy-by-Design*): nessuna persistenza dello storico utente, nessun training ML sui dati Spotify, preferiti confinati nel `localStorage` del browser, utilizzo di $1$ solo cookie tecnico `HttpOnly` di sessione (`eventspot_session`) e zero cookie pubblicitari o analitici.

---

## 5. Flussi di Sistema

1. **Fase A — Autenticazione (OAuth 2.0 PKCE / Demo):** il client avvia il login verso `api-gateway` (dalla hero *Accedi* o dalla tab *Account* del menu iOS), che genera `state` e `code_verifier`, li salva su MongoDB (TTL $10\text{ min}$) e reindirizza l'utente su Spotify Accounts con i soli scope di sessione recente. Al callback, il gateway scambia il codice per i token, li cifra a riposo, crea una sessione effimera e imposta il cookie tecnico `HttpOnly`, `Secure`, `SameSite=Lax`.
2. **Fase B — Matchmaking Context-Driven & Heatmap:** il client invia `GET /v1/matches` con coordinate GPS, raggio, date e filtro prezzo. L'`api-gateway` valida la sessione e orchestra `ingestion-service` e `recommendation-service`. I risultati alimentano sia la lista card *Per te* sia la vista cartografica **Mappa Termica** (*Heatmap*).
3. **Fase C — Fallback Missing Context:** se `ingestion-service` rileva una sessione Spotify vuota o utente non autenticato, segnala `isSessionEmpty: true`; il `recommendation-service` ricalcola automaticamente i pesi usando il solo contesto spazio-temporale e meteo (`FR-06`).
4. **Fase D — Preferiti Local-First:** il salvataggio e la lettura dei preferiti avvengono interamente nel browser via `localStorage`, senza chiamate di scrittura al backend.

---

## 6. Milestones di Rilascio (MVP) e Gestione Rischi

### 6.1 Roadmap

| Milestone | Settimane | Deliverable | Stato |
| :--- | :--- | :--- | :--- |
| `M0` — Fondazioni e Docker | 1–2 | Monorepo TypeScript, Docker Compose (3 microservizi + MongoDB), OpenAPI 3.1 base | Completato |
| `M1` — API Gateway e Auth | 3–4 | OAuth 2.0 PKCE Spotify, gestione sessioni cifrate, refresh serializzato, sicurezza | Completato |
| `M2` — Ingestion Service | 5–7 | Adapter Spotify (`recently-played`), arricchimento generi, Open-Meteo, Ticketmaster + cache TTL | Completato |
| `M3` — Recommendation Engine | 8–10 | Motore TF-IDF/Cosine, congruenza `weekday-hour`, decadimento spaziale, meteo, filtro prezzo, Explainability | Completato |
| `M4` — Client React OLED + iOS UI + Heatmap | 11–13 | UI OLED/Acid-Lime, Tab Bar stile iPhone, Mappa Termica Leaflet Canvas, Privacy/Cookie in footer, `localStorage` | Completato |
| `M5` — Validazione Tesi & Multi-Provider | 14–16 | Evaluation Harness Python (Context-Driven vs Baseline 2D), estensione Adapter multi-sorgente, load test `k6`, stesura tesi | In corso |

### 6.2 Rischi Principali e Mitigazioni

* **Deprecazione Audio Features di Spotify:** *Mitigato architetturalmente* sostituendo le metriche acustiche con l'estrazione semantica di generi/tag da `recently-played` + Last.fm/MusicBrainz.
* **Copertura limitata di Ticketmaster su piccoli club italiani e pugliesi:** *Mitigato* tramite il pattern Multi-Provider Adapter (`FR-13`) in `ingestion-service`, che consente di affiancare a Ticketmaster sorgenti complementari (Bandsintown, Xceed/Dice, Eventbrite, Schema.org `MusicEvent` JSON-LD dei locali) mantenendo invariato il modello canonico interno `NormalizedEvent`.
* **Assenza di `priceRanges` in molti eventi Ticketmaster:** *Mitigato* tramite gestione esplicita del flag `includeUnpriced` e visualizzazione chiara "Prezzo su Ticketmaster".
* **Complessità operativa dei microservizi:** *Mitigato* consolidando le integrazioni esterne in un unico `ingestion-service` (3 container applicativi totali), gestiti via Docker Compose con contratti JSON tipizzati condivisi nel monorepo.

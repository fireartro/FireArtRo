# Implementarea SEO FireArtRo cu păstrarea designului

Acest document descrie implementarea și verificările tehnice. Starea fiecărei verificări live este consemnată separat mai jos; indexarea și ingestia Analytics nu se deduc dintr-un build reușit.

## Verificarea publicării din 2 noiembrie 2026

PR-ul #21 a fost integrat în `main` prin commit-ul `25a9531`. Deploymentul Production a fost verificat ca versiune staged cu publicația existentă și apoi promovat pe fireart.ro. Matricea HTTP live din 16:13 UTC a trecut 20/20 cazuri: cele 13 pagini SSR și un URL filtrat cu 200, două pagini inexistente cu 404 și patru redirecționări cu 308. Cele zece CSS și trei scripturi inițiale au răspuns cu tipul corect; `npm run verify:production` a confirmat sănătatea API-ului, publicația, asset-urile, robots și sitemap-ul cu 13 URL-uri, inclusiv cele patru servicii. Dovezile sunt în `output/seo-release/`.

Sitemap-ul a fost retrimis și acceptat în Search Console. `generate_lead` a fost înregistrat ca eveniment cheie GA4 fără valoare monetară prestabilită, iar `channel` ca dimensiune de eveniment „Canal de contact”. Aceste setări nu confirmă primirea datelor sau indexarea URL-urilor.

În diagnosticul live, scriptul solicitat cu destinația `G-RL0GGGGVT2` a răspuns 404 HTML. Eticheta Google asociată în același cont are ID-ul `GT-NFJHCTKD`, răspunde 200 JavaScript și include destinația existentă. Corecția separă încărcarea etichetei de destinația GA4. Confirmarea colectării după publicarea acestei corecții rămâne o verificare distinctă.

## Livrarea inițială a paginilor publice

Aplicația rămâne React/CRA, cu interfața și animațiile existente. Noul renderer de server folosește aceleași componente de pagină, același contract de conținut și aceleași stiluri ca aplicația din browser. Nu există o versiune de conținut destinată exclusiv crawlerelor și nu se selectează conținut diferit după user-agent.

Fluxul unei cereri publice este:

1. Vercel trimite adresa publică spre funcția Node `api/page.js`.
2. `serverless/lib/public-page-data.js` citește publicația curentă și, unde este necesar, articolele publicate.
3. `frontend/src/server/renderPage.jsx` validează publicația cu `normalizePublishedContent`, apoi randează componentele existente prin `StaticRouter` și colectează metadatele paginii.
4. `serverless/lib/public-page-document.js` introduce markup-ul în rădăcina documentului, înlocuiește metadatele comune cu cele ale rutei și include stilurile necesare paginii.
5. Browserul primește imediat conținut HTML, linkuri și metadate. Aplicația React pornește cu aceeași publicație inițială și continuă revalidarea conținutului prin mecanismul existent.

Funcția publică nu păstrează un cache de răspuns între cereri și trimite `Cache-Control: no-store`. O nouă publicare în administrare poate fi citită de următoarea cerere de pagină, fără reconstruirea unui portofoliu static dintr-o ciornă.

Contextul de metadate aparține unei singure randări. Publicațiile, articolele și metadatele unei cereri nu sunt păstrate într-un obiect global reutilizat pentru alt vizitator.

## Build, template privat și stiluri

`frontend/package.json` construiește mai întâi aplicația client, apoi rulează `scripts/build-server.cjs`. Artefactele rendererului sunt scrise separat în `frontend/server-build/`, inclusiv chunk-urile sale dinamice.

După build:

- documentul inițial este păstrat ca `frontend/server-build/template.html`, în afara directorului public;
- `frontend/build/index.html` este eliminat din output-ul public;
- `frontend/build/admin-shell.html` păstrează shell-ul aplicației pentru administrare și are metadate `noindex, nofollow`;
- `frontend/build/public-page-assets.json` descrie CSS-ul comun și CSS-ul fiecărei rute, derivat din chunk-urile compilării client.

Eliminarea indexului static este necesară deoarece Vercel acordă prioritate filesystem-ului înaintea regulilor `rewrites`. Păstrarea acelui fișier ar permite homepage-ului să ocolească randarea publică pe server.

Rendererul nu compilează o a doua variantă de CSS. Manifestul de stiluri păstrează fișierele și ordinea utilizate de paginile încărcate în browser. Nu sunt modificate fișierele sursă CSS/SCSS/SASS/LESS. Regulile suplimentare din `noscript` ascund introducerea și fac textul randat accesibil când JavaScript este dezactivat; experiența obișnuită cu JavaScript păstrează introducerea și animațiile existente.

`data-fireart-ssr="true"` este adăugat pe elementul HTML înainte de executarea scriptului de bootstrap. Acesta evită descărcarea inițială duplicată a publicației. Publicația și articolele inițiale sunt transmise într-un element inert `script[type="application/json"]`, citit de aplicație. JSON-ul și JSON-LD-ul sunt escapate pentru a împiedica închiderea prematură a elementului `script`; nu se adaugă JavaScript executabil inline și nu se relaxează CSP.

## Rute Vercel și răspunsuri HTTP

Configurația autoritativă rămâne `vercel.json` de la rădăcină. Output-ul public rămâne `frontend/build`.

Funcția `api/page.js` include explicit numai rendererul și template-ul din `frontend/server-build/**`, plus manifestul de stiluri. Nu include prin glob întreaga bibliotecă `frontend/public/media` sau sursele frontend.

Rutele păstrează următoarea separare:

| Cerere | Destinație sau comportament |
| --- | --- |
| Fișier static existent | Servit de filesystem-ul Vercel |
| `/api/page` | Funcția Node pentru documente publice |
| Celelalte API-uri | API-ul Python existent; funcțiile Node cu fișiere proprii rămân resurse de filesystem |
| `/admin/` | Redirecționare permanentă spre `/admin` |
| `/admin` și subrutele sale | `admin-shell.html`, separat de SSR public |
| `/` și rutele publice fără extensie | Funcția de documente publice |
| Fișier static inexistent | 404, fără răspuns HTML de succes în locul asset-ului |

Contractul intern de rescriere este `/api/page?__fireart_path=/adresa-publica`. Handlerul cere exact un parametru de cale pentru această adresă internă și validează ruta într-o listă publică. Dacă runtime-ul păstrează URL-ul sursă, calea publică din cerere rămâne autoritativă: un parametru intern nu o poate înlocui.

Numai filtrele publice `categorie` și `filtru` sunt trimise către componente. Canonical-ul nu conține parametrii de filtrare sau tracking. Rutele de articole acceptă numai slug-uri publice valide. Rutele private, căile nevalide și paginile inexistente nu pornesc o randare de succes.

Handlerul suportă GET și HEAD. Adresele canonice cu slash final sunt redirecționate prin 308 relativ, fără a construi destinația din antetul `Host`. Sunt păstrate și aliasurile publice existente:

- `/legal/confidentialitate` → `/confidentialitate`;
- `/legal/termeni` → `/termeni-si-conditii`;
- `/legal/cookies` → `/cookies`.

Paginile inexistente răspund 404 cu `noindex`. Lipsa publicației sau o eroare de citire/randare răspunde generic 503 cu `noindex`; nu este înlocuită cu date dintr-o ciornă sau cu un document 200 gol. Detaliile conexiunii la baza de date nu apar în răspuns.

## Conținut public și confidențialitate

Citirea server-side folosește conexiunea MongoDB configurată pe server. Nu introduce URI-uri de conectare sau secrete în bundle-ul client, în markup sau în datele de bootstrap.

Publicația este citită exclusiv din `site_content_publications`, cu `id: "current"`. Proiecția publică conține `revision_id`, `published_at` și `content`; metadatele administrative precum `published_by`, ciornele și istoricul nu sunt incluse. Întregul conținut este validat cu contractul strict comun înainte de randare și serializare.

Publicația conține deja datele media materializate și validate la publicare, la fel ca răspunsul API-ului Python existent. Servirea unei pagini publice nu parcurge biblioteca administrativă de media și nu promovează materiale în așteptare.

Articolele sunt citite numai cu `status: "published"`, prin proiecții explicite. Rezumatele nu includ corpul articolului, starea administrativă sau câmpuri arbitrare stocate în document. Homepage-ul citește cel mult trei rezumate, arhiva SSR cel mult 100. O adresă de articol lipsă și una care corespunde unei ciorne produc același răspuns public 404. Limitele și timeout-urile interogărilor sunt explicite.

## Pagini de servicii și sitemap

Sunt adăugate patru pagini independente:

- `/servicii/artificii-nunta`;
- `/servicii/spectacole-drone`;
- `/servicii/artificii-de-zi`;
- `/servicii/efecte-speciale`.

Paginile reutilizează componentele de navigare, subsol, butoane și stilurile existente pentru conținut editorial. Fiecare are titlu, descriere, canonical, schemă `Service` și fir de navigare. Pachetele și datele de contact afișate provin din publicația CMS. Texte explicative descriu planificarea și informațiile utile pentru ofertă, fără a inventa prețuri, capacități ale flotei, autorizații, recenzii sau evenimente realizate.

Sitemap-ul dinamic rămâne `/api/sitemap.xml`. Cele patru rute sunt adăugate fără a elimina paginile existente. Articolele publicate continuă să primească `lastmod` din datele lor reale; nu se inventează date de modificare pentru serviciile fixe. Politica existentă `Allow: /` permite accesarea serviciilor, iar API-urile private rămân blocate în robots.txt.

Nu sunt create studii de caz din informații neconfirmate și nu sunt trimise mesaje către parteneri. Cazurile reale și eventualele mențiuni externe pot fi adăugate ulterior folosind informații și materiale confirmate.

## Măsurare GA4

Încărcarea GA4 rămâne condiționată de configurarea ID-ului de măsurare, domeniul de producție și consimțământul pentru analytics. Rutele administrative și adresele necunoscute nu sunt eligibile. Retragerea consimțământului și expirarea lui opresc măsurarea; handlerul verifică permisiunea și la trimiterea evenimentelor comerciale.

`REACT_APP_GA_MEASUREMENT_ID` identifică destinația GA4 (`G-...`) folosită pentru `gtag("config", ...)` și `ga-disable`. Variabila publică opțională `REACT_APP_GA_TAG_ID` selectează separat ID-ul Google tag din URL-ul scriptului `gtag.js`, acceptând numai `^(?:G|GT)-[A-Z0-9]+$`. Lipsa sau o valoare goală după eliminarea spațiilor de la capete păstrează încărcarea cu ID-ul de măsurare; o valoare nevidă invalidă blochează încărcarea. Modificarea variabilei cere rebuild/deployment și nu schimbă destinația, proprietatea sau setările key events.

Dacă URL-ul scriptului cu ID-ul destinației răspunde `404`/HTML, trebuie verificat în interfața Google tag un ID de tag asociat destinației existente, apoi configurat drept `REACT_APP_GA_TAG_ID`. Nu se înlocuiește destinația GA4 cu un alt ID doar pentru a obține `200`. [Documentația Google tag management](https://support.google.com/analytics/answer/12329709) explică asocierea tagurilor și destinațiilor; procedura de configurare și verificare live este în [runbook-ul Vercel](runbooks/fireartro-vercel-setup.md#id-ul-google-tag-și-destinația-ga4). Acest document nu confirmă publicarea sau ingestia live a corecției loader-ului.

Sunt definite următoarele semnale:

| Semnal | Declanșare | Date comerciale transmise explicit |
| --- | --- | --- |
| `page_view` | Accesarea unei rute publice eligibile | Cale publică allowlistată, titlu public și context de pagină sanitizat |
| `contact_click` | Clic pe telefon, email sau destinație WhatsApp recunoscută | Categoria fixă `phone`, `email` sau `whatsapp` |
| `generate_lead` | Răspuns HTTP reușit al formularului, cu `accepted === true` | Metoda fixă `quote_form` |

Contextul de pagină folosește domeniul canonic și calea publică, fără query string sau fragment. Referrer-ul este redus la origine, păstrând domeniul sursei fără o cale de conversație sau parametri potențial privați. Parametrii custom nu includ numele clientului, emailul, telefonul, mesajul, data evenimentului, destinația completă a linkului, identificatorul trimiterii sau răspunsul API.

Evenimentele de contact și lead includ contextul sanitizat la nivel de eveniment, actualizat după navigarea SPA. Astfel, configurația inițială GA4 nu le atribuie în continuare paginii pe care vizitatorul a intrat prima dată.

Un eșec HTTP, o respingere sau lipsa confirmării `accepted: true` nu declanșează semnalul de lead. Erorile providerului de măsurare nu trebuie să întrerupă contactarea firmei.

Verificarea codului și a evenimentelor locale nu confirmă ingestia în proprietatea Google Analytics reală. Setările de colectare automată ale proprietății, eventualele filtre și rapoartele live necesită verificare în GA4 după publicare. De asemenea, un clic pe telefon/WhatsApp indică interes, nu confirmă un client sau o vânzare.

## Validare și dovezi locale

Comenzile corespunzătoare verificărilor executate sunt:

```powershell
# Din rădăcina repository-ului
npm run test:api
npm run test:artifacts
node --test frontend/scripts/serve-build.test.cjs
$env:CI = 'true'
npm --prefix frontend test -- --watchAll=false --runInBand

# Build client + renderer server
$env:GENERATE_SOURCEMAP = 'false'
$env:NODE_OPTIONS = '--max-old-space-size=8192'
npm --prefix frontend run build

# Din directorul backend
python -m pytest tests/test_sitemap.py -q
```

Suita frontend finală a trecut cu **70 de suite și 476 de teste**, inclusiv regresia atribuirii evenimentelor după navigare SPA. Suitele API au trecut cu **77 de teste**, verificările de artefacte cu **32**, iar sitemap-ul cu **patru**. Testul separat de preview a trecut: byte ranges pentru video, HEAD și proxy public limitat la citire. Build-ul client și renderer a trecut. Deprecările raportate de mediul Python pentru pytest-asyncio/multipart nu sunt prezentate ca defecte remediate de această schimbare.

Corecția ulterioară pentru ID-ul de încărcare Google tag a fost verificată separat: **17 teste AnalyticsLoader**, **70 de suite frontend cu 482 de teste** și build-ul client + renderer au trecut. Această verificare locală nu confirmă deploymentul corecției sau ingestia GA4 live.

Pentru reproducerea preview-ului local cu conținutul publicat:

```powershell
$env:PORT = '4198'
$env:FIREART_SSR_PREVIEW = 'true'
$env:FIREART_PREVIEW_CONTENT_ORIGIN = 'https://fireart.ro'
node frontend/scripts/serve-build.js
```

Preview-ul citește numai API-urile anonime publice. Acest mod local verifică HTML-ul și funcționarea aplicației cu datele publicate; nu reprezintă un test al accesului funcției Node de pe Vercel la baza de date reală.

Dovezile din `output/seo-implementation/` includ:

- `http-matrix.json`: 13 pagini publice, un URL filtrat, două cazuri 404 și patru redirecționări; verificări de canonical, H1 unic, conținut/navigare în HTML, JSON valid, cache și CSS;
- `browser-qa.json`: rezultatele verificărilor în browser consemnate la livrare;
- `contact-mobile.jpg`: captura formularului în varianta mobilă;
- `service-no-javascript-mobile.jpg`: captura unei pagini de serviciu pe mobil cu JavaScript dezactivat.

Matricea HTTP locală a trecut toate cele 20 de cazuri; cele zece stylesheet-uri distincte referite au răspuns 200 cu tip CSS. Fișierele de dovezi sunt artefacte locale ignorate de Git, nu conținut comercial publicat.

Comparația de design a inclus pagina Pachete la 1536 px și Contact la 390 px. Pentru titlul de Contact, poziția, dimensiunile, fontul și culoarea coincid între build-ul de referință și cel final; în ambele cazuri documentul are lățimea 381 px într-un viewport de 390 px. Verificarea nu reprezintă o comparație pixel cu pixel a tuturor paginilor. În browser au fost verificate meniul mobil, acordul pentru cookies, întrebările extensibile, selecția pachetului către Contact, filtrarea și lightbox-ul galeriei, plus redarea MP4 pe mobil și desktop. Arhiva Blog publicată este goală; fluxul unui articol real nu a putut fi verificat în browser, iar rendererul de articol este acoperit cu date de test.

Nu au fost trimise cereri reale de ofertă sau evenimente sintetice către proprietatea GA4 de producție pentru a crea artificial statistici. Nu se declară verificată o versiune Vercel publicată sau o modificare a numărului de pagini indexate.

## Verificări necesare după publicare

1. Verifică funcția Node în deployment-ul efectiv: rădăcina și paginile interioare trebuie să returneze HTML complet, canonical-uri curate și CSS disponibil. Verifică separat administrarea, API-urile existente și un asset lipsă. Confirmă că secretele MongoDB necesare sunt configurate exclusiv pe server.
2. Compară designul și fluxurile principale pe desktop și mobil, inclusiv prima încărcare, consimțământul, navigarea, filtrele de pachete și formularul. Un build local reușit nu înlocuiește această verificare în mediul publicat.
3. În Google Search Console, verifică citirea sitemap-ului și inspectează URL-urile comerciale canonice și cele patru servicii. Testul live verifică accesibilitatea; starea din index verifică separat indexarea efectivă. Solicită indexarea paginilor importante și urmărește răspunsul ulterior al Google.
4. În GA4, verifică un flux controlat cu consimțământ și instrumentele de diagnostic/Realtime. Confirmă calea după navigare SPA și absența datelor personale din parametrii trimiși. O trimitere reală de formular trebuie verificată separat numai dacă este autorizată și identificată ca test operațional.
5. Urmărește clicurile, afișările, paginile indexate și căutările comerciale în intervale comparabile. Verifică recomandările AI cu întrebări neutre și contexte documentate. Nu interpreta absența unei interogări anonimizate ca dovadă de zero afișări.

Aceste modificări fac paginile accesibile și măsurabile. Nu garantează indexarea, o anumită poziție în Google sau recomandarea de către un model AI și nu recuperează retroactiv date Analytics care nu au fost colectate.

## Revenire după integrare

După merge, revenirea se face printr-un commit `git revert` asupra commit-ului sau commit-urilor integrate și printr-un deployment verificat al acelui revert. Dacă integrarea este un merge commit, se selectează părintele principal corespunzător repository-ului. Nu se folosește `git reset --hard` pentru rescrierea istoricului de producție.

După revenire se verifică homepage-ul, rutele directe, administrarea, formularul și asset-urile. Modificările de cod nu șterg publicațiile CMS sau articolele existente; datele comerciale și secretele nu fac parte din acest rollback de cod.

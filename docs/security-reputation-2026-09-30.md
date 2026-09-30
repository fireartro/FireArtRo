# Verificare securitate și reputație — 30 septembrie 2026

## Ce arată serviciile externe

- ScamAdviser afișa 41/100 pentru `fireart.ro`, citând clasări IPQS „phishing” și „suspicious”, popularitate Tranco redusă și vechimea mică a domeniului. Acesta este un scor de reputație, nu un scor de performanță sau dovada unei vulnerabilități concrete.
- Scannerul IPQS pentru `https://fireart.ro/` afișa risc 97, „Phishing Link” și „Suspicious Activity”; nu semnala malware sau spam. Clasificarea rămâne de investigat, nu este demonstrată ca fals pozitiv.
- Google Safe Browsing afișa „No available data”. Acest rezultat nu certifică siguranța domeniului.
- Cererea de analiză manuală a domeniului a fost primită de IPQS la `https://www.ipqualityscore.com/report-false-positive/submit`. Confirmarea vizibilă: „your false-positive report has been successfully received”. Site-ul furnizorului indică 24–48 de ore pentru analiză, fără garanția eliminării alertei.

Cererea solicită URL-urile incriminate, momentele detecției și indicatorii observabili. Folosește numai identitatea și contactele publice ale firmei; nu transmite parole, certificatul firmei, locația sau IP-ul privat al operatorului. Nu solicită eliminarea restricțiilor pentru întreaga infrastructură Vercel partajată.

## Verificări tehnice și limite

Inspecția codului frontend/backend, a documentului public și a conținutului CMS public nu a identificat cod de phishing, publicare anonimă, redirecționare controlată de vizitator sau secrete în bundle-urile examinate. Au fost verificate autentificarea, CSRF, semnarea callback-urilor și limitarea destinațiilor pentru fișiere. Aceste verificări nu exclud toate compromiterile posibile: istoricul domeniului, logurile și toate setările infrastructurii nu au fost auditate.

Nu există dovezi că vulnerabilitățile de dependențe sau permisiunea CSP explică alerta IPQS. Vechimea domeniului și poziția Tranco nu pot fi „reparate” printr-un commit. Nu au fost cumpărate evaluări, inventate recenzii sau simulate vizite.

## Modificări pregătite

1. Cele trei blocuri JavaScript executabile de startup sunt mutate într-un script same-origin, blocant. JSON-LD rămâne date, nu cod executabil. CSP `script-src` nu mai permite `unsafe-inline` sau `unsafe-eval`; originile explicite Cloudflare și GA4 sunt păstrate. Politica pentru stiluri nu este schimbată.
2. Dependența HTTP `undici` este actualizată la versiuni 6.x corectate, fără schimbarea API-ului Blob SDK: 6.29.0 în lockfile-ul Node și 6.28.1 în cel Yarn. Auditul npm al dependențelor Node de producție raportează zero advisories; acesta nu reprezintă auditul tuturor dependențelor Python sau al uneltelor CRA.
3. Încărcările Blog verifică sesiunea, originea și CSRF înainte de parsarea formularelor, inclusiv pentru URL-ul cu slash final. Cererile autentificate care nu sunt multipart primesc 415. Limitele existente pentru fișiere și corpul total rămân active, iar multipart nu este tratat ca JSON și nu ocupă blocarea referințelor CMS.

## Evidență de verificare

- API Node: 17 teste trecute; artifact/startup/CSP: 22 teste trecute.
- Frontend: 57 suite, 342 teste trecute. Testul first-paint execută acum scriptul extern declarat de HTML, cu transportul anonim simulat la granița de rețea.
- Build de producție: compilat cu succes.
- Backend: 42 teste noi reproduse RED și apoi GREEN; suita completă are 456 teste trecute și 10 teste Mongo omise, cu un avertisment de depreciere preexistent. Nu sunt testate încărcări reale sau baze Mongo live.
- Verificarea inițială în Chrome folosește build-ul real, antetele exacte din `vercel.json` și fixture-ul CMS versionat, exclusiv pe un server separat local la 4193. Acest fixture nu este publicat și nu reprezintă datele live ale firmei. Homepage-ul se montează, loading-ul dispare și `inert` se eliberează fără erori CSP ale aplicației. Testele unitare păstrează minimul de trei secunde și comportamentul pentru încărcări lente.
- Serverul de dezvoltare la 4191 este păstrat. Nu sunt schimbate parole, DNS, datele firmei sau integrările de recenzii.
- Preview-ul Vercel a ajuns Ready; scripturile externe de startup sunt permise de politica publicată. API-ul anonim de preview redirecționează către `vercel.com/sso-api`, apoi este blocat de CSP. Nu este slăbită politica și nu este dezactivată protecția Vercel pentru a ocoli autentificarea; validarea conținutului public și a widget-ului configurat trebuie făcută pe producție la publicare.

## Ce rămâne extern sau necesită o etapă separată

- Răspunsul IPQS și apoi recitirea clasificării ScamAdviser; nu este suficientă trimiterea formularului pentru a declara alerta eliminată.
- Auditul logurilor și al configurației furnizorilor, dacă IPQS furnizează indicatori concreți.
- Actualizarea compatibilă a stack-ului FastAPI/Starlette și a minimului `python-multipart`, cu regresie completă. Protecția timpurie reduce expunerea anonimă a endpoint-ului identificat, dar nu echivalează cu actualizarea tuturor bibliotecilor.
- Protejarea suplimentară a logării credentialelor și caching/quota pentru integrările de recenzii înainte de activarea lor; activarea Google/Facebook rămâne pentru etapa finală cerută de proprietar.

Surse: [ScamAdviser](https://www.scamadviser.com/check-website/fireart.ro), [IPQS scanner](https://www.ipqualityscore.com/threat-feeds/malicious-url-scanner/https%3A%2F%2Ffireart.ro%2F), [IPQS review](https://www.ipqualityscore.com/report-false-positive), [Google Safe Browsing](https://transparencyreport.google.com/safe-browsing/search?url=fireart.ro&hl=en), [Starlette urlencoded advisory](https://github.com/Kludex/starlette/security/advisories/GHSA-82w8-qh3p-5jfq), [Starlette multipart advisory](https://github.com/Kludex/starlette/security/advisories/GHSA-f96h-pmfr-66vw), [undici advisory](https://github.com/nodejs/undici/security/advisories/GHSA-rfgv-xxqx-mfg5).

# FireArtRo — design pentru pregătirea completă de producție

## Obiectiv

Pregătim FireArtRo pentru un deployment funcțional pe `fireart.ro`, cu Admin care publică conținut fără Git/push, infrastructură Vercel + MongoDB Atlas + Blob, e-mail bidirecțional prin Resend, protecție anti-spam, Analytics cu consimțământ, SEO și pagini legale actualizate.

Acest document acoperă punctele 0–7, 9–11 din lista de lansare. Punctele 8 (recenzii Google/Facebook), 12 (QA complet), 13 (monitorizare/backup operațional), 14 (ziua lansării) și 15 (operare post-lansare) sunt excluse explicit, la cererea proprietarului.

## Decizii deja confirmate

| Decizie | Valoare |
| --- | --- |
| Domeniu canonic | `https://fireart.ro` |
| Redirecturi | `www.fireart.ro`, `fireartro.ro`, `www.fireartro.ro`, `fireartro.com`, `www.fireartro.com` către `https://fireart.ro`, cu path și query păstrate |
| Proprietar operațional | Ionuț Barbul |
| Adresa de administrare a serviciilor | `fireartro@gmail.com` |
| Administrator secundar al platformelor | `ebejerea@gmail.com`, unde platforma permite membri |
| Site Admin | un singur profil Admin comun |
| Contact public | `contact@fireart.ro` |
| E-mail | Resend pentru trimitere și primire; alertă la `fireartro@gmail.com` |
| Recenzii | rămân ascunse; nu sunt configurate acum |

Repository-ul oficial este `https://github.com/fireartro/FireArtRo.git`. Nu se modifică Git-ul vechi.

## Restricții de plan și decizia necesară

FireArtRo este un site comercial. Planul Vercel Hobby este gratuit, dar Vercel îl restrânge la utilizare personală, non-comercială și nu oferă colaborare în echipă. Nu poate fi folosit corect pentru FireArtRo cu doi administratori de platformă. Pentru hostingul Vercel de producție trebuie fie Vercel Pro, fie o migrare distinctă către o altă arhitectură de hosting comercială; această lucrare păstrează Vercel ca cerință aprobată și nu activează un plan plătit fără confirmare la momentul acțiunii.

Atlas M0 poate fi folosit gratuit pentru primul deployment, dar nu oferă backup automat. În această etapă se va pregăti o procedură manuală de export/restore; backup-ul automat rămâne indisponibil până la un plan Atlas eligibil. Resend Free este compatibil cu acest proiect, dar are o limită de 100 e-mailuri/zi și 3.000/lună, calculând atât e-mailurile trimise, cât și cele primite.

## Arhitectura țintă

```text
GitHub main ──> Vercel Production ──> fireart.ro
     │                │
     └─ branches ──> Preview deployments
                      │
                      ├── FastAPI /api ──> MongoDB Atlas
                      ├── media publică ──> Vercel Blob Public
                      ├── e-mail ──> Resend
                      ├── anti-spam ──> Cloudflare Turnstile
                      └── analytics (doar după consimțământ) ──> GA4

Admin ──> draft MongoDB ──> preview ──> publish MongoDB ──> site public
```

Frontendul și API-ul rămân pe aceeași origine Vercel. `REACT_APP_BACKEND_URL` rămâne gol în producție. Secretele rămân exclusiv în Environment Variables server-side; în frontend ajung numai identificatori publici, precum Measurement ID GA4 și site key Turnstile.

## Pachete de implementare și ordine

### A. Cod de producție înainte de configurarea externă

1. **E-mail Resend.** Implementăm specificația detaliată din `2026-09-03-resend-bidirectional-contact-email-design.md`: persistare înainte de send, statusuri, retry Admin, inbox de mesaje, webhook semnat, reply în thread și documentație.
2. **Turnstile.** Formularul de ofertă primește widget Turnstile condiționat de `REACT_APP_TURNSTILE_SITE_KEY`. Backendul validează obligatoriu tokenul prin Siteverify când `TURNSTILE_ENABLED=true`; token lipsă, expirat sau repetat este respins, iar lipsa secretului în Production oprește acceptarea formularului în mod fail-closed. Cheia secretă nu este returnată niciodată clientului.
3. **Analytics cu consimțământ.** Se adaugă un loader GA4 separat, activ doar când `REACT_APP_GA_MEASUREMENT_ID` are format valid și consimțământul `analytics` este acordat. Varianta aleasă este Basic Consent Mode: nici scriptul, nici hiturile nu sunt încărcate înainte de consimțământ. Nu se trimit PII, ID-uri de cereri, conținut de formular sau URL-uri cu parametri sensibili.
4. **Domeniu, SEO și metadate.** Se schimbă toate valorile curente `www.fireartro.ro` în `https://fireart.ro`: CMS defaults, fixtures, fallbackuri backend CORS, HTML static, Open Graph, robots, sitemap, schema și conținut de business. Se creează sitemap dinamic pentru articolele Blog publicate, fără drafturi şi fără `/admin`.
5. **Pagini legale.** Se actualizează conținutul de confidențialitate/cookies cu procesatorii activați real (Vercel, MongoDB Atlas, Resend, Cloudflare Turnstile, Google Analytics numai după configurare). Nu se declară un furnizor ca activ înainte să fie conectat.
6. **Status Admin.** Panoul de integrări afișează numai stări sigure pentru MongoDB, Blob, Resend și Turnstile; nu afișează tokenuri, URI-uri sau secrete.

Fiecare comportament nou urmează TDD: test care eșuează, implementare minimă, test verde și commit izolat.

### B. GitHub și controlul codului

După ce branch-ul de implementare este verificat:

1. `main` devine production branch în Vercel.
2. GitHub primește branch protection: fără force-push, fără ștergere, PR obligatoriu, CI obligatoriu și minimum un reviewer pentru schimbări importante.
3. Sunt activate Dependabot/security alerts, unde sunt disponibile.
4. Ionuț Barbul și `ebejerea@gmail.com` sunt invitați cu nivelul minim suficient de acces. Nu se folosesc conturi partajate sau parole comune.
5. Rollback-ul de cod este `git revert`, nu `git reset --hard`.

Aplicarea acestor setări schimbă permisiuni cloud și este confirmată exact înainte de salvare.

### C. Vercel, Atlas și Blob

1. Într-un cont/echipă eligibil(ă) Vercel se importă repository-ul de la rădăcină; `vercel.json` nu este suprascris. Primul deployment este Preview.
2. Atlas primește un proiect FireArtRo, un cluster potrivit planului ales, user de aplicație cu acces minim și baze separate `fireartro_preview` și `fireartro_production`.
3. Se creează un Blob store **Public** numai pentru media de site. Cererile, mesageria și documentele clienților nu intră în Blob.
4. Preview și Production folosesc variabile independente şi baze/tokenuri diferite.
5. `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH` și `ADMIN_SESSION_SECRET` sunt create fără a fi puse în Git sau în conversație. Parola se stabilește interactiv de proprietar; hashul rămâne exclusiv în Vercel.

### D. Variabile Vercel

| Variabilă | Preview | Production | Sensibilă |
| --- | --- | --- | --- |
| `MONGODB_URI` | Atlas Preview | Atlas Production | da |
| `DB_NAME` | `fireartro_preview` | `fireartro_production` | nu |
| `ADMIN_USERNAME` | configurat | configurat | da |
| `ADMIN_PASSWORD_HASH` | hash separat | hash Production | da |
| `ADMIN_SESSION_SECRET` | secret distinct | secret distinct | da |
| `BLOB_READ_WRITE_TOKEN` | token Preview | token Production | da |
| `VERCEL_BLOB_MEDIA_ORIGIN` | origin Preview | origin Production | nu |
| `CORS_ORIGINS` | URL Preview + localhost | `https://fireart.ro` | nu |
| `RESEND_ENABLED` | `false` | `true` după verificare | nu |
| `RESEND_API_KEY` | absent | full-access key | da |
| `RESEND_WEBHOOK_SECRET` | absent | secret webhook | da |
| `RESEND_FROM_EMAIL` | test aprobat | `FireArtRo <contact@fireart.ro>` | nu |
| `RESEND_NOTIFICATION_TO` | `fireartro@gmail.com` | `fireartro@gmail.com` | nu |
| `RESEND_INBOUND_DOMAIN` | absent | `fireart.ro` | nu |
| `RESEND_INBOUND_ADDRESS` | absent | `contact@fireart.ro` | nu |
| `TURNSTILE_ENABLED` | `false` sau test | `true` | nu |
| `TURNSTILE_SECRET_KEY` | secret test | secret Production | da |
| `REACT_APP_TURNSTILE_SITE_KEY` | public test key | public Production site key | nu |
| `REACT_APP_GA_MEASUREMENT_ID` | absent | GA4 `G-…` | nu |

Nicio valoare sensibilă nu va avea prefix `REACT_APP_`.

### E. Domenii, Resend, DNS și SSL

1. Mai întâi se inventariază în ROMARG toate recordurile existente: A, AAAA, CNAME, MX, SPF, DKIM, DMARC, verificări Google/Meta şi subdomenii.
2. Se conectează `fireart.ro` în proiectul Vercel ca domeniu principal, apoi se configurează redirecturile de mai sus. SSL şi HSTS sunt validate numai după ce toate hosturile sunt corecte.
3. În Resend se verifică `fireart.ro` pentru trimitere şi se creează webhook-ul `email.received` către `https://fireart.ro/api/webhooks/resend`.
4. Se adaugă recordurile SPF, DKIM şi MX oferite exact de Resend. MX la rădăcină preia mesajele pentru toate adresele `@fireart.ro`; acesta este motivul pentru care API-ul păstrează şi etichetează mesaje către alți destinatari, nu le elimină.
5. Se adaugă sau se actualizează DMARC fără a invalida recorduri existente.
6. Se creează widget-uri Turnstile distincte pentru Preview şi Production, cu hostname-uri strict limitate.

Niciun record DNS, webhook, API key, widget sau redirect persistent nu este creat până la confirmarea imediată a proprietarului înaintea salvării.

### F. Admin, conținut și GA4

1. După `/api/health = ready`, se inițializează conținutul curent o singură dată în baza de date Production.
2. Se verifică draft → preview → publicare → refresh public → istoric → restaurare ca draft. Conținutul trebuie să rămână după un redeploy.
3. Se creează proprietatea GA4 şi Web Data Stream pentru `https://fireart.ro`; Measurement ID-ul public este salvat numai după ce loaderul cu consimțământ este verificat.
4. Analytics începe cu consent refuzat. Alegerile Acceptă/Refuză/Preferințe actualizează loaderul fără reload, iar schimbarea se păstrează în mecanismul actual de cookie consent.
5. Google Search Console, verificarea sitemapului şi inspecția URL intră în etapa de lansare exclusă, nu se efectuează acum.

## Cerințe de securitate și date

- Toate cheile sunt server-side; niciun secret nu este inspectat, printat sau adăugat în Git.
- Admin rămâne accesibil doar cu sesiunea existentă, CSRF, rate limit şi `noindex`.
- E-mailurile şi cererile sunt tratate ca PII: fără logs cu conținut, fără analytics, fără Blob public.
- Inboxul Resend verifică exact corpul brut al webhookului cu secret Svix şi dedupează toate operațiile.
- Turnstile este validat server-side; widgetul client nu este considerat protecție suficientă.
- GA4 se încarcă doar după consimțământ. Nu există tracking implicit, advertising, remarketing sau user IDs.
- Conținutul legal este aliniat cu procesatorii activați, dar aprobarea juridică a textului final rămâne responsabilitatea proprietarului.

## Criterii de acceptanță pentru această etapă

- Toate modificările de conținut public sunt realizabile din Admin după configurare, fără Git/push/deploy.
- Formularul salvează cererea înainte de e-mail, are anti-spam activ și nu dezvăluie date către public.
- `contact@fireart.ro` poate primi şi răspunde prin Resend/Admin, iar alerta ajunge la `fireartro@gmail.com` o singură dată.
- `fireart.ro` este singura versiune canonică, iar celelalte domenii redirecționează corect.
- GA4 nu se încarcă înainte de consimțământ şi nu primește PII.
- Preview şi Production sunt separate în Atlas, Blob şi Environment Variables.
- În mod explicit, nu sunt configurate încă recenziile Google/Facebook, QA completă, monitorizarea/backup-ul operațional, ziua lansării sau operațiunile post-lansare.

## Referințe validate

- [Vercel Hobby](https://vercel.com/docs/plans/hobby) și [Fair Use pentru utilizare comercială](https://vercel.com/docs/limits/fair-use-guidelines)
- [MongoDB Atlas backup și restore](https://www.mongodb.com/docs/atlas/backup-restore-cluster/)
- [Resend pricing și limite](https://resend.com/pricing) şi [email inbound](https://resend.com/docs/dashboard/receiving/introduction)
- [Cloudflare Turnstile Free](https://developers.cloudflare.com/turnstile/plans/) şi [validare server-side](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
- [Google Consent Mode](https://developers.google.com/tag-platform/security/guides/consent)

# Resend bidirecțional pentru `contact@fireart.ro` — specificație de design

## Scop și rezultat

FireArtRo va folosi Resend, exclusiv din backend, pentru două fluxuri:

1. o cerere publică de ofertă este salvată mai întâi în MongoDB și apoi semnalată la `fireartro@gmail.com`;
2. un e-mail primit la `contact@fireart.ro` este verificat, păstrat în inboxul Admin, transmis ca alertă lizibilă la `fireartro@gmail.com` și poate primi răspuns din Admin, tot de la `contact@fireart.ro`.

Această lucrare este primul subproiect din pregătirea completă de lansare. Conectarea Vercel, Atlas, domeniile, Analytics, SEO și recenziile rămân subproiecte separate; nu sunt modificate de această implementare decât prin documentarea variabilelor necesare.

## Context confirmat

- Repository-ul de lucru este cel nou: `https://github.com/fireartro/FireArtRo.git`, branch `codex/resend-inbound-contact`.
- Proprietarul operațional desemnat este Ionuț Barbul; contul de lucru al serviciilor este `fireartro@gmail.com`.
- `ebejerea@gmail.com` va primi invitație de administrator pe platformele care permit membri. Site-ul păstrează un singur profil Admin comun, nu conturi Admin separate.
- Domeniul canonic dorit este `fireart.ro`; adresa de comunicare este `contact@fireart.ro`.
- În contul Resend curent nu există încă domenii verificate și nu există e-mailuri trimise.
- Codul actual salvează cererile în colecția MongoDB `quotes`, iar Admin-ul are deja sesiune protejată pentru cereri, conținut și media.

## Variante analizate și decizie

### Varianta aleasă — inbox aplicativ Resend, cu alertă Gmail

Resend primește mesajele, trimite un webhook semnat către API-ul Vercel, iar FireArtRo păstrează conversația în MongoDB. Fiecare mesaj primit este trimis și ca alertă la `fireartro@gmail.com`; răspunsul se face din Admin. Aceasta păstrează istoricul în site, permite răspunsuri din aceeași adresă și nu expune chei în browser.

### Alternativă respinsă — doar redirecționare externă

Redirecționarea directă către Gmail este mai simplă, dar nu oferă inbox, statusuri, căutare sau răspunsuri în Admin și nu poate păstra auditabil conversațiile.

### Alternativă respinsă — un widget extern de inbox

Un widget ar scurta codul, dar ar introduce abonament, design inconsecvent și date ale clienților într-un al treilea sistem fără necesitate.

## Arhitectură

```text
Formular ofertă ──POST /api/quotes──> MongoDB quotes
                                      │
                                      └──> Resend API ──> fireartro@gmail.com

contact@fireart.ro ──> Resend Inbound ──webhook semnat──> POST /api/webhooks/resend
                                                           │
                                                           ├──> Resend Receiving API (conținut complet)
                                                           ├──> MongoDB inbound_messages
                                                           └──> Resend API ──> alertă fireartro@gmail.com

Admin / Mesaje ──POST /api/admin/inbox/{id}/reply──> Resend API ──> expeditorul inițial
```

`POST /api/webhooks/resend` este public numai la nivel de rută, dar nu are sesiune, CORS permisiv sau CSRF bypass. Acceptă exclusiv un corp brut cu antetele `svix-id`, `svix-timestamp` și `svix-signature`, validat criptografic înainte de orice acces la MongoDB sau Resend. Orice alt client primește un răspuns generic fără date despre secret sau mesaj.

## Fluxuri funcționale

### 1. Cerere de ofertă

1. API-ul validează consimțământul, honeypot-ul și limita existentă de rată.
2. Cererea este inserată în `quotes` înainte de orice apel extern.
3. API-ul creează un document de livrare cu starea `pending` și trimite o alertă HTML/text simplă la `fireartro@gmail.com`, cu `Reply-To` adresa introdusă în formular.
4. Cererea publică primește în continuare doar `{ "accepted": true }`; nu sunt expuse nume, telefon, e-mail sau detalii tehnice.
5. La succes, livrarea devine `sent` și păstrează numai ID-ul providerului, momentul trimiterii și cheia de idempotență. La eșec, cererea rămâne salvată, livrarea devine `failed`, iar Admin-ul permite o retrimitere explicită.

Nu se trimite automat o confirmare către client în această versiune.

### 2. E-mail primit

1. Resend trimite evenimentul `email.received` la `https://fireart.ro/api/webhooks/resend`.
2. API-ul verifică semnătura Svix peste corpul brut. Semnăturile invalide sau antetele incomplete primesc `400`; evenimentele de alt tip primesc `204`; o indisponibilitate temporară a bazei de date sau a API-ului Resend primește `503`, pentru a permite retry-ul furnizorului.
3. După validare, API-ul recuperează conținutul complet prin Receiving API, deoarece evenimentul nu conține corpul mesajului.
4. API-ul face upsert după `resend_email_id`, salvează mesajul și metadatele atașamentelor, apoi creează o alertă către `fireartro@gmail.com` cu cheia de idempotență `inbound-relay/{resend_email_id}`.
5. Dacă o livrare a webhook-ului este repetată, mesajul și alerta nu sunt create din nou. Repetările cu o livrare deja terminată răspund `204`.
6. Admin-ul arată corpul text în mod sigur; HTML-ul primit nu este randat ca HTML în browser. Atașamentele nu sunt copiate în MongoDB sau Vercel Blob public: sunt afișate doar ca metadate și rămân accesibile în Resend, unde au fost primite.

Mesajele trimise către alte adrese `@fireart.ro` nu sunt abandonate: sunt etichetate „alt destinatar”, păstrate în inbox și anunțate la `fireartro@gmail.com`. Astfel, activarea MX la rădăcină nu pierde în tăcere mesaje care nu sunt pentru `contact@fireart.ro`.

### 3. Răspuns din Admin

1. Un administrator deschide mesajul și apasă „Răspunde”.
2. Endpointul acceptă numai un text de maximum 12.000 de caractere și poate trimite numai către expeditorul validat din mesajul selectat; nu devine un formular generic de trimitere e-mail.
3. Backend-ul generează textul şi HTML-ul escapate, trimite de la `FireArtRo <contact@fireart.ro>` și setează `In-Reply-To` la `message_id` al mesajului primit. Pentru mesaje ulterioare, trimite și lista limitată de `References` pentru threading.
4. Răspunsul, ID-ul Resend și starea sunt salvate în conversația MongoDB. Interfața confirmă succesul sau păstrează textul local și afișează eroare la eșec.

## Model de date și indexuri

### `email_deliveries`

Păstrează toate trimiterile inițiate de site, fără corpul complet al e-mailului:

```json
{
  "id": "uuid",
  "kind": "quote_notification | inbound_relay | admin_reply",
  "state": "pending | sent | failed",
  "idempotency_key": "quote-notification/{quote-id}",
  "related_quote_id": "uuid sau absent",
  "related_inbound_message_id": "uuid sau absent",
  "recipient": "adresă normalizată",
  "resend_email_id": "id furnizor sau absent",
  "error_code": "cod sigur sau absent",
  "created_at": "UTC",
  "sent_at": "UTC sau absent",
  "updated_at": "UTC"
}
```

Indexuri obligatorii: `id` unic, `idempotency_key` unic, `related_quote_id + created_at desc`, `related_inbound_message_id + created_at asc`, `state + updated_at asc`.

### `inbound_messages`

```json
{
  "id": "uuid",
  "resend_email_id": "id furnizor unic",
  "webhook_id": "svix-id unic",
  "message_id": "ID RFC pentru threading",
  "from": "adresa expeditorului",
  "to": ["destinatari"],
  "subject": "subiect normalizat",
  "text": "corp text limitat",
  "html": "corp HTML limitat, doar pentru arhivă",
  "attachments": [{"id": "provider", "filename": "nume", "content_type": "tip", "size": 0}],
  "category": "contact | other_recipient",
  "received_at": "UTC",
  "relay_state": "pending | sent | failed",
  "latest_reply_at": "UTC sau absent"
}
```

Indexuri obligatorii: `id` unic, `resend_email_id` unic, `webhook_id` unic, `received_at desc`, `category + received_at desc`, `from + received_at desc`.

Corpul text şi HTML sunt plafonate înainte de stocare pentru a menține limitele de funcție și MongoDB. Câmpurile sunt tratate ca date personale; nu ajung în logurile aplicației, răspunsurile publice, URL-uri sau analytics. Politica existentă de confidențialitate rămâne regula de păstrare: datele se mențin numai cât este necesar scopului comunicat și obligațiilor legale; acest subproiect nu introduce un mecanism automat de ștergere.

## Module și endpointuri

### Backend

- `backend/resend_email.py`: client HTTPX, validare de configurare, trimitere idempotentă, recuperare e-mail primit, normalizare erori fără secrete.
- `backend/email_inbox.py`: modele Pydantic, repository MongoDB, servicii pentru procesarea inbound, reply și retry.
- `backend/server.py`: inițializează colecțiile, indexurile și rutele; extinde limita de request numai pentru webhookul Resend, fără a slăbi limitele celorlalte rute.
- `backend/quote_admin.py`: expune starea alertei unei cereri și operația protejată de retrimitere.
- `backend/.env.example`: documentează toate variabilele Resend fără valori secrete.
- `docs/runbooks/fireartro-resend-setup.md`: instrucțiuni de conectare în Resend, Vercel și DNS, inclusiv testele de acceptanță.

### Frontend Admin

- `frontend/src/admin/AdminInbox.jsx`: listă, căutare, detaliu, stare alertă și formular de răspuns.
- `frontend/src/admin/inboxApi.js`: contracte HTTP Admin pentru inbox şi răspunsuri.
- `frontend/src/admin/AdminLayout.jsx`: adaugă „Mesaje” la Operațiuni, fără a modifica modelul unic de autentificare.
- `frontend/src/admin/AdminQuotes.jsx`: arată starea alertei și permite retrimitere numai pentru `failed` sau `pending` după eșec.

Toate rutele Admin continuă să ceară sesiunea existentă, verificarea CSRF și răspunsuri `Cache-Control: no-store`.

## Configurare externă necesară după codul verificat

Nu se creează încă resurse, chei, webhookuri sau DNS records. La etapa de configurare, acțiunile cu impact vor fi confirmate imediat înainte de salvare.

| Variabilă Vercel | Mediu | Sensibilă | Rol |
| --- | --- | --- | --- |
| `RESEND_ENABLED` | Preview/Production | nu | `false` în Preview, `true` în Production după verificare |
| `RESEND_API_KEY` | Production | da | cheie Resend cu acces complet, necesară trimiterii și Receiving API |
| `RESEND_WEBHOOK_SECRET` | Production | da | secretul webhookului `email.received` |
| `RESEND_FROM_EMAIL` | Preview/Production | nu | `FireArtRo <contact@fireart.ro>` |
| `RESEND_NOTIFICATION_TO` | Preview/Production | nu | `fireartro@gmail.com` |
| `RESEND_INBOUND_DOMAIN` | Production | nu | `fireart.ro` |
| `RESEND_INBOUND_ADDRESS` | Production | nu | `contact@fireart.ro` |

În Resend se va verifica `fireart.ro` pentru trimitere și primire, se va crea webhook-ul de producție pentru `email.received`, iar secretul acestuia va fi introdus numai în variabilele server-side Vercel. Resend recomandă un subdomeniu pentru inbound deoarece MX-ul de la rădăcină preia orice mesaj adresat domeniului. Cerința FireArtRo este explicit `contact@fireart.ro`, deci schimbarea MX la rădăcină va fi făcută doar după confirmare individuală şi inventarierea recordurilor existente ROMARG.

## Securitate și comportament la erori

- Nicio cheie Resend, secret webhook, token MongoDB sau adresă de client nu este expusă în `REACT_APP_*`, bundle, răspunsuri API, erori sau loguri.
- Înainte de procesare, webhookul verifică exact corpul brut şi antetele Svix; anti-replay-ul este realizat prin indexurile unice şi cheile de idempotență.
- Funcția nu urmează linkuri din e-mail, nu descarcă atașamente, nu randază HTML primit și nu trimite automat e-mailuri către vizitatori.
- Provider errors sunt convertite în coduri scurte precum `not_configured`, `provider_rejected`, `provider_unavailable` sau `delivery_failed`; mesajele furnizorului nu sunt afișate în Admin dacă pot conține informații sensibile.
- Lipsa configurației Resend nu oprește formularul de ofertă: cererea se salvează, iar livrarea este marcată clar `failed`/`not_configured` pentru retrimitere ulterioară.
- E-mailurile sunt trimise cu `Idempotency-Key`; Resend păstrează deduplicarea 24 de ore, iar MongoDB păstrează identitatea permanentă a operației.

## Testare obligatorie

1. Teste unitare pentru configurare, payload Resend, eroare sanitizată şi cheie de idempotență.
2. Teste de integrare FastAPI pentru: salvarea cererii înainte de e-mail, eșecul e-mailului fără pierderea cererii, retrimitere Admin, webhook semnat, semnătură invalidă, eveniment repetat, recuperare conținut, relay idempotent şi reply cu `In-Reply-To`.
3. Teste Admin React pentru lista Inbox, afișarea textului ca text, răspuns validat şi stările de retry.
4. Verificare Preview cu cheile Preview inactive: formularul trebuie să funcționeze fără expediere, iar Admin să semnaleze lipsa configurării fără secrete.
5. Verificare Production după configurare: trimitere ofertă, mail manual către `contact@fireart.ro`, inbox Admin, alertă Gmail, reply în același fir și retry de webhook din dashboard Resend.

## Criterii de acceptanță

- O cerere de ofertă nu se pierde dacă Resend nu răspunde.
- În Admin se vede dacă alerta pentru o cerere a fost trimisă sau trebuie retrimisă.
- Un e-mail real la `contact@fireart.ro` ajunge în Admin şi alertează `fireartro@gmail.com` o singură dată, chiar dacă webhookul este repetat.
- Răspunsul din Admin pleacă de la `contact@fireart.ro`, este în firul mesajului şi nu permite trimitere către un destinatar arbitrar.
- Fără variabilele Resend, site-ul public şi Admin-ul nu scot erori cu secrete şi nu afişează mesaje în mod public.
- Niciun pas din implementare nu creează, rotește sau afișează o cheie, nu schimbă MX/DNS şi nu invită membri de platformă.

## Referințe externe verificate

- [Resend — Receiving Emails](https://resend.com/docs/dashboard/receiving/introduction)
- [Resend — verificarea webhookurilor](https://resend.com/docs/webhooks/verify-webhooks-requests)
- [Resend — recuperarea conținutului e-mailurilor primite](https://resend.com/docs/dashboard/receiving/get-email-content)
- [Resend — răspuns în același fir](https://resend.com/docs/dashboard/receiving/reply-to-emails)
- [Resend — chei de idempotență](https://resend.com/docs/dashboard/emails/idempotency-keys)

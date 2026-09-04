# FireArtRo: Resend pentru trimitere și primire

Acest runbook configurează `contact@fireart.ro` pentru notificările cererilor, primirea mesajelor și răspunsurile din Admin. Codul trebuie să fie deja disponibil într-un deployment Vercel stabil înainte de activarea webhookului sau schimbarea MX.

## Arhitectura aprobată

- Formularul salvează cererea în MongoDB înainte de încercarea de notificare.
- Resend trimite notificările către `fireartro@gmail.com` de la `FireArtRo <contact@fireart.ro>`.
- Emailurile primite de Resend ajung prin evenimentul semnat `email.received` la `/api/webhooks/resend`.
- Backendul preia textul complet prin API-ul Resend, îl salvează în MongoDB și îl afișează numai într-o sesiune Admin.
- Răspunsul din Admin este adresat exclusiv expeditorului salvat. Browserul nu poate furniza sau schimba destinatarul.
- Se păstrează în aplicație numai metadatele atașamentelor. Fișierele atașate rămân la Resend; URL-urile temporare de descărcare nu sunt salvate și nu sunt expuse în Admin.
- Cheile și secretele rămân exclusiv în Vercel. Nu există variabile Resend în bundle-ul React.

## Variabile Vercel

Folosește valori distincte pentru Preview și Production acolo unde tabelul cere acest lucru. Marchează valorile secrete ca **Sensitive** și nu le copia în tichete, capturi, Git sau mesaje.

| Variabilă | Preview | Production | Sensibilă | Format și comportament |
| --- | --- | --- | --- | --- |
| `RESEND_ENABLED` | `false` până la test; apoi `true` | `false` până la validarea completă; apoi `true` | nu | Acceptă numai `true` sau `false`. Orice altă valoare dezactivează integrarea prin fail-closed. |
| `RESEND_API_KEY` | cheie separată, cu acces minim necesar | cheie separată, cu acces minim necesar | da | Cheie API creată în Resend. Nu reutiliza cheia Production în Preview. |
| `RESEND_WEBHOOK_SECRET` | secretul webhookului Preview | secretul webhookului Production | da | Secretul de semnare furnizat de Resend pentru webhookul exact al mediului. |
| `RESEND_FROM_EMAIL` | `FireArtRo <contact@fireart.ro>` | aceeași valoare | nu, dar server-only | Trebuie să fie exact identitatea fixată în aplicație și să folosească domeniul verificat. |
| `RESEND_NOTIFICATION_TO` | `fireartro@gmail.com` | aceeași valoare | server-only | Destinația fixată pentru notificările cererilor și relay-ul mesajelor primite. |
| `RESEND_INBOUND_DOMAIN` | domeniul Resend de test sau `fireart.ro` numai după MX | `fireart.ro` | server-only | Domeniul de Receiving configurat în Resend. |
| `RESEND_INBOUND_ADDRESS` | adresa de test a mediului | `contact@fireart.ro` | server-only | Adresa urmărită de aplicație. În Production trebuie să fie `contact@fireart.ro`. |

Integrarea este intenționat fail-closed: dacă `RESEND_ENABLED=false`, lipsește o valoare sau secretul webhookului nu este valid, trimiterea și primirea nu pornesc. Cererile legitime rămân salvate în MongoDB, iar operatorul le poate vedea în Admin; o notificare eșuată nu șterge cererea.

## Ordinea sigură de configurare

1. În Resend, adaugă și verifică domeniul de trimitere. Copiază în DNS exact înregistrările SPF și DKIM afișate de Resend și așteaptă starea verificată.
2. Confirmă că domeniul verificat permite expeditorul `contact@fireart.ro`. Resend nu cere crearea separată a unei căsuțe pentru adresa de expediere.
3. Publică mai întâi codul webhookului și confirmă că `https://<domeniu>/api/webhooks/resend` răspunde, fără a activa încă Receiving pe domeniul principal.
4. Creează în Resend un webhook pentru evenimentul `email.received`, cu endpointul exact `https://<domeniu>/api/webhooks/resend`.
5. Copiază secretul webhookului direct în `RESEND_WEBHOOK_SECRET` în mediul Vercel corespunzător. Nu îl pune întâi într-un fișier local.
6. Configurează restul variabilelor cu `RESEND_ENABLED=false`, redeploy și verifică `/api/health` și autentificarea Admin.
7. Activează `RESEND_ENABLED=true`, redeploy și trimite un eveniment semnat de test. Confirmă că apare o singură dată în Admin → Operațiuni → Mesaje și că relay-ul ajunge la `fireartro@gmail.com`.
8. Trimite o cerere de ofertă de test. Confirmă salvarea în Admin și primirea notificării, apoi răspunde la un mesaj de test din Admin și verifică firul.
9. Inventariază înainte toate înregistrările MX existente pentru `fireart.ro`, inclusiv prioritatea și serviciul care le folosește. Salvează inventarul într-un loc privat de operațiuni.
10. Oprește-te pentru o confirmare separată înainte de orice modificare MX. Schimbarea MX la domeniul rădăcină mută primirea pentru toate adresele acelui domeniu, nu doar pentru `contact@fireart.ro`.
11. După confirmare, aplică exact MX-ul de Receiving afișat de Resend, verifică propagarea și trimite teste din minimum două servicii externe.

Dacă `fireart.ro` are deja email activ pentru alte adrese, soluția cu risc redus este un subdomeniu dedicat sau o regulă de forward către domeniul de Receiving Resend. Nu înlocui MX-ul existent până când proprietarul confirmă explicit că Resend trebuie să primească toate adresele `@fireart.ro`.

## Verificarea webhookului

1. Verifică în Resend că livrarea webhookului are tipul `email.received` și răspuns `204`.
2. În Admin, deschide `Mesaje`; conținutul trebuie să apară o singură dată chiar dacă Resend retrimite același eveniment.
3. Un payload fără semnătură, cu semnătură greșită sau cu identitate contradictorie trebuie să primească `400` și să nu creeze mesaj.
4. Un răspuns `503` indică o problemă temporară de configurare, provider sau MongoDB; Resend poate relua evenimentul cu aceeași identitate.
5. Nu reda manual webhookul schimbând corpul. Semnătura acoperă corpul brut. Folosește funcția de replay din Resend pentru livrarea originală.

## Recuperare operațională

### Notificare de cerere eșuată

Cererea rămâne în MongoDB. Deschide cererea în Admin, verifică datele fără a le copia în loguri publice și folosește retry numai dacă starea permite. Cheia de idempotency este stabilă pentru aceeași cerere, deci retry-ul nu trebuie înlocuit cu o trimitere manuală repetată.

### Relay inbound eșuat

Mesajul primit rămâne în `Mesaje` cu starea eșuată. După revenirea Resend, folosește `Retrimite notificarea`. Nu recrea webhookul și nu modifica documentul MongoDB manual.

### Răspuns Admin neconfirmat

Textul rămâne în formular după eroare. Folosește retry cu același draft; interfața păstrează același identificator de răspuns până la confirmarea succesului. Reîncarcă mesajul înainte de o nouă încercare dacă apare un conflict.

### Provider indisponibil

1. Setează `RESEND_ENABLED=false` în mediul afectat și redeploy dacă incidentul produce erori repetate.
2. Nu șterge cererile, mesajele, reply-urile sau delivery-urile din MongoDB.
3. Site-ul continuă să salveze cererile; operatorul trebuie să verifice temporar Adminul fără a depinde de notificarea email.
4. După revenirea providerului, verifică domeniul, cheia și webhookul, reactivează integrarea și folosește acțiunile explicite de retry.

### Oprire fără pierderea cererilor

`RESEND_ENABLED=false` oprește transportul și verificarea webhookului, dar nu dezactivează formularul și nu șterge date. În timpul opririi, urmărește manual lista de cereri din Admin. Nu elimina `MONGODB_URI`, `DB_NAME` sau configurația Admin pentru a opri emailul.

## Checklist de acceptare

- Domeniul de trimitere este `verified` în Resend.
- SPF și DKIM corespund exact valorilor Resend; politica DMARC a domeniului a fost verificată separat.
- Webhookurile Preview și Production au secrete diferite și endpointuri corecte.
- Un email către `contact@fireart.ro` apare o singură dată în Admin și este relayed o singură dată.
- O cerere de ofertă este salvată chiar dacă notificarea este oprită.
- Un răspuns din Admin ajunge la expeditor și păstrează firul emailului.
- Un mesaj cu conținut asemănător HTML este afișat ca text, nu executat.
- Atașamentele afișează numai nume, tip și dimensiune; aplicația nu persistă binarele sau URL-urile temporare.
- Nicio variabilă `RESEND_*` nu există în `frontend/.env`, bundle sau `REACT_APP_*`.
- Inventarul MX și procedura de revenire sunt păstrate înainte de schimbarea DNS.

## Revenire după o schimbare MX

Dacă primirea emailului se întrerupe după schimbare, nu improviza valori DNS. Restaurează exact setul MX inventariat anterior, cu aceleași priorități, așteaptă propagarea și testează din exterior. Menține `RESEND_ENABLED=false` până când webhookul și ruta de primire sunt din nou coerente.

## Referințe oficiale

- [Verificarea domeniului de trimitere](https://resend.com/docs/dashboard/domains/introduction)
- [Primirea emailurilor și domeniile custom](https://resend.com/docs/dashboard/receiving/introduction)
- [Evenimentul `email.received`](https://resend.com/docs/webhooks/emails/received)
- [Procesarea atașamentelor primite](https://resend.com/docs/dashboard/receiving/attachments)

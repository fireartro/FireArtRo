# FireArtRo: operațiuni Admin

## Flux editorial

1. Intră la `/admin` și verifică indicatorul de stare.
2. Editează conținutul. `Nesalvat` devine `Se salvează`, apoi `Salvat` numai după confirmarea serverului.
3. Deschide `Previzualizează` pentru a vedea exact draftul. Nu este public și nu poate fi indexat.
4. Verifică secțiunile schimbate în fereastra `Publică modificările`; poți adăuga o notă de maximum 240 caractere.
5. Apasă `Publică acum`. Aceasta promovează o singură versiune coerentă; vizitatorii primesc schimbarea la refresh/navigare, fără deploy.

Nu publica dacă vezi `Conflict`, `Eroare`, `Câmpuri invalide` sau o încărcare media în curs. În conflict, reîncarcă versiunea serverului înainte de a continua.

## Starea integrărilor

- Panoul principal arată numai stări: baza de date, media Blob, Google și Facebook. Nu afișează parole, tokenuri, URL-uri interne sau răspunsuri de la furnizori.
- `Necesită configurare` înseamnă că lipsesc variabilele necesare din Vercel. `Configurat` confirmă prezența lor, iar `Funcțional` confirmă și ultima verificare reușită.
- `Eroare temporară` nu publică date private și nu oprește restul site-ului; verifică logurile Vercel/Atlas, apoi apasă `Verifică din nou` după ce corectezi infrastructura.

## Corectare și rollback

- `Istoric publicări` arată fiecare versiune publicată.
- `Restaurează ca draft` nu schimbă site-ul. Verifică draftul restaurat și publică explicit dacă este corect.
- Pentru un incident de infrastructură, revino temporar la deploymentul Preview/Production anterior din Vercel, apoi restaurează conținutul corect din Admin. Nu folosi `git reset --hard` pentru un rollback al conținutului.

## Media

- Încarcă doar JPG, PNG, WebP, AVIF, MP4 sau WebM: maximum 8 MB pentru imagini și 500 MB pentru video.
- Fiecare material are titlu și text alternativ obligatoriu.
- Un fișier folosit de un draft, o versiune publicată, istoric sau Blog nu poate fi șters.
- Înlocuiește mai întâi referința în draft, publică, apoi șterge numai fișierul nefolosit.
- Dacă un card spune că așteaptă confirmarea stocării, apasă `Verifică încărcarea`. Nu îl atașa în draft până nu devine disponibil. Dacă nu mai este dorit, `Șterge încărcarea` șterge mai întâi obiectul Blob și apoi păstrează tombstone-ul de siguranță.

### Recuperarea unui blocaj de scriere media

Un proces întrerupt poate lăsa protecția fail-closed activă. Simptomul este un răspuns `409` cu mesajul că o operație de conținut este în curs la orice salvare Admin/Blog. Nu șterge automat și nu adăuga TTL la `cms_media_write_locks`: o eliberare automată ar putea suprapune o ștergere Blob lentă cu o publicare.

1. Oprește noile editări și așteaptă cel puțin 10 minute de la ultimul save eșuat. Verifică în Vercel că nu mai există o invocare activă pentru Admin/CMS și consultă logurile pentru operația întreruptă.
2. În Atlas, inspectează numai documentul `cms_media_write_locks` cu `_id: "content-and-media"`; notează `owner` și `created_at`. Verifică și colecția `cms_media` pentru înregistrări în starea `deleting` sau `pending` și reconciliază-le înainte de continuare.
3. Doar dacă nu există un writer activ, blocajul este mai vechi de 10 minute și documentul are același `owner` observat la pasul anterior, un operator responsabil poate elimina acel unic document de blocare din Atlas. Nu șterge colecția, nu folosi wildcard și oprește-te dacă owner-ul se schimbă.
4. Reîncearcă o singură salvare de draft, verifică biblioteca media și abia apoi publică. Notează incidentul, owner-ul și momentul recuperării în jurnalul intern.

## Blog și cereri

- Blogul folosește aceeași sesiune Admin; nu cere și nu salvează un API key în browser.
- Cererile de ofertă au date de contact și note private numai în Admin. Nu copia date personale în titluri publice, analitice sau recenzii.
- Marchează cererile `new`, `contacted`, `qualified`, `closed` sau `spam`; statusul și nota sunt protejate împotriva editării simultane.

## Recenzii externe

- Google apare numai când există atât `GOOGLE_PLACES_API_KEY`, cât și `GOOGLE_PLACE_ID`.
- Facebook apare numai când există atât `META_PAGE_ID`, cât și `META_PAGE_ACCESS_TOKEN`.
- Dacă o integrare eșuează, ea dispare fără să blocheze site-ul sau celălalt furnizor.

## Întreținere

- Fă backup Atlas regulat și testează o restaurare într-o bază Preview separată.
- Rotește periodic parola Admin, `ADMIN_SESSION_SECRET`, tokenurile providerilor și tokenul Blob conform politicii echipei. O rotație a secretului de sesiune invalidează sesiunile existente.
- Urmărește `/api/health`, logurile Vercel și alertele Atlas. Nu pune URL-uri MongoDB, cookie-uri, tokenuri sau corpuri de cereri în tichete publice.

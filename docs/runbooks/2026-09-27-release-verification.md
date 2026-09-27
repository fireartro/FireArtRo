# Verificare release — 27 septembrie 2026

## Modificări

- Parteneri: poziții asimetrice, variație de adâncime și scară, sigle reale, listă accesibilă completă, pauză manuală, oprire în afara ecranului și reduced-motion. Nu sunt inventate siglele Infinity Ballroom sau Palat Ioan Festeleu.
- Capital social opțional, validat identic frontend/backend. Nu se publică o sumă neconfirmată și nu se modifică snapshot-urile vechi prin adăugarea unui câmp gol.
- Email primit: adresa configurată este verificată atât în evenimentul semnat, cât și în răspunsul furnizorului. Mesajele către alte adrese nu sunt salvate sau retransmise. Dublurile și retry-ul rămân idempotente.
- Turnstile: verificare opțională strictă hostname/action. Widgetul trimite `quote_submit`. Activarea restricției pe Production urmează procedura de rollout din runbook; nu se activează prematur pe Preview.
- Node 22.x fixat pentru build reproductibil.

## Dovezi locale

- Backend: `PYTHONPATH=backend python -m pytest backend/tests -q`: 378 trecute, 10 sărite (integrări care cer servicii separate).
- Frontend: 58 suite, 336 teste trecute.
- API Node: 16 teste trecute. Artifacts: 19 teste trecute. Build optimizat fără erori.
- Chrome, geometrie reală: 320, 390, 430, 768, 1024 și 1440 px; fără suprapuneri între sigle/titlu, între sigle și fără ieșiri laterale. Mobilul prezintă 10 sigle în scenă; butonul deschide colecția completă de 26.
- Cele șase fișiere video au exact 30 secunde: trei 1920×1080 și trei 1080×1920. Testul autoplay folosește doar o simulare 4G temporară în preview; nu alterează Production sau preferințele vizitatorilor.
- Evenimentele reale `playing` au confirmat 1 → 2 → 3 → 1 atât pentru wide, cât și pentru portrait, la intervale de aproximativ 30 secunde. Simularea a fost eliminată prin reîncărcarea tabului de test.
- Testul E2E pentru parteneri este izolat printr-un fixture CMS; verificarea geometriei din acest release a fost efectuată în Chrome prin interfața de testare, nu prin rularea întregii matrice Playwright.

## Conturi și restanțe reale

- Resend: domeniu Verified, trimitere/primire active; webhook `email.received` Enabled, cu două evenimente istorice Success. Acestea nu înlocuiesc un test nou de livrare/reply.
- Google Business: linkurile Facebook, Instagram și YouTube salvate. Confirmarea prin filmare reală la locație rămâne cerută de Google.
- CMS public: încă identitatea veche Smart Land; publicarea corecției necesită autentificare Admin și inspectarea diferențelor draft/publicat. Nu se suprascrie prin fallback frontend.
- Capital social, TVA, autorizații și retenție: necesită date confirmate de proprietar; certificatul de înregistrare nu stabilește toate aceste informații.
- Backup/restore drill: necesită acces Atlas și stabilirea unei destinații private criptate; nu se exportă datele clienților în Git.
- Recenziile Google/Facebook și upgrade-ul plătit Vercel sunt amânate conform cererii proprietarului.

Nu se confundă aceste verificări cu o garanție juridică sau cu o testare fizică Safari/iPhone.

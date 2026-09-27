# FireArtRo: parteneri și lansare, 27 septembrie 2026

## Decizie vizuală

Secțiunea nu va copia Cosmos. Preluăm doar senzația de carduri plutitoare cu ritmuri diferite, din referința oferită de proprietar. În FireArtRo, scena rămâne o noapte albastru-închis, cu un spațiu de lectură clar și sigle autentice distribuite asimetric pe mai multe planuri. Fără orbită rigidă, grilă la vedere, logo reconstituit sau captură de ecran. Numele fără siglă verificată rămân tipografice. Un control afișează toate colaborările într-o listă lizibilă.

- Paletă: noapte `#03050a`, adâncime `#0b1626`, plăcuță `#142034`, alb `#f3f6fb`, albastru `#8dd3ff`.
- Tip: Sora pentru mesaj și numele partenerilor, textul utilitar existent pentru controale.
- Mișcare: plutire lentă cu amplitudine mică, faze decalate; se oprește la ieșirea din ecran, la pauză, când tabul este ascuns sau dacă utilizatorul preferă mișcare redusă.
- Adaptare: distribuție organică pe desktop, selecție aerisită în jurul textului pe telefon, listă completă cu două coloane pe mobil și control accesibil. Niciun scroll orizontal.

## Ordinea implementării

1. Scrie teste pentru număr arbitrar de parteneri, fallback fără logo, mod listă, pauză și lipsa suprapunerilor la lățimi uzuale; confirmă că testele noi eșuează înaintea schimbărilor.
2. Schimbă exclusiv `PartnerCloud`, `partnerCloudLayout` și CSS-ul secțiunii, fără a altera catalogul sau conținutul editat în Admin. Teste și verificare vizuală 320–1440 px, inclusiv landscape.
3. Adaugă capital social opțional în contractul CMS și în interfața legală doar dacă valoarea este confirmată. Corectează identitatea publicată numai după autentificare, cu păstrarea draftului și a adresei operaționale.
4. Verifică profilul Google Business, integrarea email, Turnstile, analytics, backup, monitorizare, SEO și bucla video. Acțiunile externe care cer verificare fizică, informații necunoscute sau acces lipsă sunt marcate explicit ca rămase.
5. Rulează testele relevante, buildul și verificarea producției, revizuiește diff-ul, publică prin PR/`main`, apoi verifică deployul live și notează exact ce mai lipsește.

## Limite

Nu inventăm capitalul social, statutul TVA, recenzii, fotografii de locație sau logo-uri. Nu publicăm tot draftul Admin dacă are modificări independente neaprobate. Upgrade-ul Vercel rămâne amânat la cererea proprietarului.

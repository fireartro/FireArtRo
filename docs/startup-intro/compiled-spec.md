# Introducere FireArtRo — specificație

## Compoziție și surse

- Background D2 (starfield parallax), D8 (light trace), C8 (vignette), camera #21 (crossfade overlap).
- Custom: coordonate sferice 3D proiectate pe canvas, potrivite formațiilor de drone și artificiilor din logo. Biblioteca nu are o sculptură specifică FireArtRo.
- Un strat canvas decorativ, identitate HTML, copy și trei segmente de progres real.
- CSS complet: frontend/public/startup-intro.css. Motor și lifecycle complet: frontend/public/startup-intro.js. Aceste fișiere reprezintă specificația executabilă.

## Rafinare vizuală, versiunea 3 — fără elemente albastre

- Aceeași direcție cinematică și aceeași logică de încărcare; identitatea devine mai clară din primul cadru, fără blur.
- La cererea proprietarului eliminăm complet formațiile circulare, punctele și reflexele albastre din intro. Culorile paginilor rămân neschimbate.
- O coroană de 144 de scântei aurii și albe, cu lungimi variate, traiectorii curbate, sclipiri discrete și cădere lentă, înlocuiește geometria orbitală. Perspectiva și luminozitatea separă planurile.
- Halourile sunt reutilizate dintr-un singur sprite canvas. Fără alte imagini, modele sau biblioteci.
- Siglă albă, fundal aproape negru, atmosferă champagne discretă și reflex de scenă cald. Centrul rămâne liber; vârfurile nu traversează textul.
- Copy: „Totul începe cu o scânteie.”; textul și sigla păstrează claritatea pe Retina, mobile și landscape.
- Fără resurse externe noi și fără prelungirea duratei minime de așteptare.

## Comportament

- Bootstrap înainte de React. În absența JavaScript și pe /admin overlay-ul este ascuns.
- Conținut public validat + route commit + primul frame video sunt semnalele normale de ieșire.
- Pentru reduced motion / data saver / media nesuportată: posterul pregătit este suficient.
- Minimum 3 secunde pe orice conexiune, inclusiv cu reduced motion (cadru static). Tranziția de ieșire de 650 ms începe abia după acest minim și după pregătirea paginii.
- Filmul care încă se descarcă și posterul care încă se descarcă nu au limită artificială de 5/12 secunde. Posterul pregătit rămâne fallback pentru redare dezactivată, indisponibilă sau blocată. O eroare reală de media nu blochează accesul la restul paginii.
- Acțiunea „Intră pe site” apare după montarea paginii și expirarea celor 3 secunde. Dacă aplicația nu s-a montat după 12 secunde, apare doar opțiunea manuală „Reîncarcă pagina”, fără închidere sau refresh automat. Erorile CMS și navigarea la Admin elimină imediat overlay-ul.
- Rădăcina aplicației este inertă doar cât timp overlay-ul e activ. Fără focus furat după închidere; focus din buton este mutat către conținut.
- Rotația se oprește când tabul e ascuns. Se elimină RAF, timerele și listeners la final.
- Filmele 2/3 nu sunt solicitate de intro. Nu așteptăm imagini lazy-loaded, cookie vendors sau întreaga pagină.

## External Library Decision

Experiență: puncte și traiectorii într-un spațiu 3D. Canvas nativ proiectează coordonatele și controlează costul pe telefon. Nu adăugăm biblioteci, fișiere video sau modele 3D pentru loading.

## Verificare

Desktop și telefon, landscape scurt, reduced motion, API întârziat, video lent/eșuat, navigare internă și Admin; gating-ul public rămâne autoritativ. Bugetul codului inițial și build-ul trebuie să treacă.

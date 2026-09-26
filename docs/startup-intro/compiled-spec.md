# Introducere FireArtRo — specificație

## Compoziție și surse

- Background D2 (starfield parallax), D8 (light trace), C8 (vignette), camera #21 (crossfade overlap).
- Custom: coordonate sferice 3D proiectate pe canvas, potrivite formațiilor de drone și artificiilor din logo. Biblioteca nu are o sculptură specifică FireArtRo.
- Un strat canvas decorativ, identitate HTML, copy și trei segmente de progres real.
- CSS complet: frontend/public/startup-intro.css. Motor și lifecycle complet: frontend/public/startup-intro.js. Aceste fișiere reprezintă specificația executabilă.

## Rafinare vizuală, versiunea 2

- Aceeași direcție cinematică și aceeași logică de încărcare; identitatea devine mai clară din primul cadru, fără blur.
- 216 lumini albastre se adună în trei formații înclinate, proiectate cu perspectivă. Intensitatea depinde de adâncime.
- Scântei aurii cu traiectorii curbate și cădere lentă; halourile sunt reutilizate din două sprite-uri canvas create în memorie.
- Coroana luminoasă este mai amplă, iar logo-ul crește moderat. Un reflex orizontal fin ancorează compoziția.
- Copy: „Totul începe cu o scânteie.”; textul și sigla păstrează claritatea pe Retina, mobile și landscape.
- Fără resurse externe noi și fără prelungirea duratei minime de așteptare.

## Comportament

- Bootstrap înainte de React. În absența JavaScript și pe /admin overlay-ul este ascuns.
- Conținut public validat + route commit + primul frame video sunt semnalele normale de ieșire.
- Pentru reduced motion / data saver / media nesuportată: posterul pregătit este suficient.
- După maximum 3.2 s de așteptare media, un poster încărcat este suficient; maximum 5 s după route commit chiar dacă media eșuează.
- Minimum 900 ms doar pentru introducerea animată, maximum 12 s în total, ieșire de 650 ms. Reduced motion elimină durata minimă și tranziția spațială.
- Acțiunea „Intră pe site” apare când pagina este montată. Erorile CMS și navigarea la Admin elimină imediat overlay-ul.
- Rădăcina aplicației este inertă doar cât timp overlay-ul e activ. Fără focus furat după închidere; focus din buton este mutat către conținut.
- Rotația se oprește când tabul e ascuns. Se elimină RAF, timerele și listeners la final.
- Filmele 2/3 nu sunt solicitate de intro. Nu așteptăm imagini lazy-loaded, cookie vendors sau întreaga pagină.

## External Library Decision

Experiență: puncte și traiectorii într-un spațiu 3D. Canvas nativ proiectează coordonatele și controlează costul pe telefon. Nu adăugăm biblioteci, fișiere video sau modele 3D pentru loading.

## Verificare

Desktop și telefon, landscape scurt, reduced motion, API întârziat, video lent/eșuat, navigare internă și Admin; gating-ul public rămâne autoritativ. Bugetul codului inițial și build-ul trebuie să treacă.

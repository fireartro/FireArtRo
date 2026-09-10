# Selector cinematografic pentru gamele FireArtRo

## Scop

Înlocuim grila generică de patru carduri din secțiunea „Pachete” de pe landing page cu un selector cinematografic. Vizitatorul trebuie să înțeleagă imediat cele patru game, să vadă un cadru puternic pentru fiecare și să ajungă direct la categoria corespunzătoare din `/pachete`.

Remedierea posterelor YouTube de pe pagina `/pachete` rămâne separată și este deja publicată. Acest document acoperă doar redesignul secțiunii de pe landing și alegerea imaginilor sale.

## Direcție vizuală aprobată

Direcția este „cinematic show selector”: o listă editorială de game în stânga și un singur cadru panoramic dominant în dreapta. Se păstrează fundalul negru atmosferic al site-ului, fără tentă albastră suplimentară, fără colțuri rotunjite pronunțate și fără chenare de tip magazin online.

Referințele de calibrare sunt portofoliile cinematografice cu imagine dominantă și navigare redusă la esențial, nu copierea unei interfețe anume: EXIT FILM (Awwwards) și galeriile editoriale de tip Fiddle.Digital (Awwwards Inspiration).

### Sistem vizual

- Fundal: continuarea exactă a suprafeței `#05070b` deja folosite de landing.
- Text principal: alb rece `#f3f5f8`.
- Text secundar: gri-lavandă `#a8abb5`.
- Accent: albastrul luminos existent `#9bcaff`, folosit numai pentru stare activă, focus și linia de „aprindere”.
- Separatoare: alb la 12–16% opacitate.
- Titluri: Bricolage Grotesque, cu greutate moderată și contrast mare între activ și inactiv.
- Etichete și acțiuni: Sora, compacte și lizibile.

Semnătura secțiunii este o linie subțire de lumină care traversează separatorul gamei active, în timp ce fotografia se schimbă printr-un fade scurt cu un zoom foarte discret. Efectul trebuie să sugereze aprinderea unui spectacol, nu un carusel comercial.

## Layout desktop

Secțiunea păstrează headerul actual, apoi folosește două coloane:

```text
┌──────────────────────────────────────────────────────────────┐
│ PACHETE FIREARTRO                                           │
│ Alege spectacolul evenimentului tău.     descriere scurtă   │
├───────────────────────┬──────────────────────────────────────┤
│ Artificii de noapte ↗ │                                      │
├───────────────────────┤                                      │
│ Artificii de zi     ↗ │     CADRU CINEMATOGRAFIC ACTIV       │
├───────────────────────┤                                      │
│ Spectacole de drone ↗ │     descriere + acțiune discretă     │
├───────────────────────┤                                      │
│ Efecte speciale     ↗ │                                      │
└───────────────────────┴──────────────────────────────────────┘
```

- Lista ocupă aproximativ 34–38% din lățime, iar fotografia restul.
- Prima gamă este activă la încărcare.
- Hoverul și focusul pe o gamă actualizează fotografia și descrierea din scenă.
- Clickul pe nume sau pe scenă deschide `/pachete?categorie=...` folosind exact valorile CMS curente.
- Toate gamele rămân vizibile simultan; nu există săgeți de carusel și nici informație ascunsă necesară navigării.

## Layout mobil și tabletă

Sub 760 px, selectorul nu depinde de hover. Fiecare gamă devine o scenă verticală completă, cu fotografia pe lățime, titlul și acțiunea suprapuse în partea inferioară. Scenele sunt separate de spațiu și linii fine, nu de rame groase.

Pe tabletă portret se folosește aceeași structură verticală, dar cu imagini mai late și text pe maximum două rânduri. Zonele interactive au minimum 44 px, iar titlurile nu ies din viewport.

## Imagini curate și nerepetate

Se folosesc numai fișiere existente, fără imagini generate și fără logo-uri ori denumiri de oraș vizibile:

- Artificii de noapte: `gallery-import-110` — compoziția albă amplă, cu public și profunzime.
- Artificii de zi: `gallery-import-003` — evantai colorat, clar și diferit de fotografia de zi din galeria landingului.
- Spectacole de drone: `gallery-import-drone-076` — formație abstractă roșu-aurie, fără siglă sau oraș; înlocuiește cadrul roșu deja folosit în video-ul hero.
- Efecte speciale: `gallery-import-019` — cadru dinamic cu culoare și scântei, distinct de celelalte trei.

Fiecare imagine are `object-position` ajustat individual, astfel încât subiectul principal rămâne vizibil atât în scena panoramică, cât și în cropul mobil.

## Interacțiune, accesibilitate și performanță

- Legăturile păstrează navigarea nativă și funcționează fără JavaScript pentru click.
- Starea activă este sincronizată la hover și focus; tastatura primește același rezultat vizual ca mouse-ul.
- Focusul este vizibil și folosește accentul existent al site-ului.
- Tranziția este dezactivată când utilizatorul preferă mișcare redusă.
- Imaginile rămân WebP, primesc dimensiuni responsive prin utilitarul existent și nu introduc biblioteci noi.
- Pe desktop, cadrul activ este prioritar; imaginile secundare rămân lazy. Pe mobil, prima scenă poate fi încărcată prioritar, restul lazy.
- Nu se adaugă parallax, canvas, WebGL sau animații continue.

## Componente și date

- `HomePackages.jsx` continuă să primească textele, gamele și deep-linkurile din conținutul administrat.
- O mapare locală de imagini recomandate pentru landing separă selecția vizuală de `imageMediaId` al pachetelor individuale, astfel încât Adminul și pagina `/pachete` nu sunt afectate accidental.
- `category-navigation.css` primește stilurile selectorului, limitate sub `.fa-packages`, pentru a nu modifica filtrele paginilor Pachete și Galerie.
- Logica existentă de ordine a categoriilor și eticheta publică „Spectacole de drone” rămân neschimbate.

## Verificare

1. Test unitar: ordinea, deep-linkurile și textul „Vezi mai multe opțiuni” rămân corecte.
2. Test unitar nou: hoverul/focusul schimbă cadrul activ și fiecare gamă primește o sursă de imagine distinctă.
3. Teste vizuale Playwright la desktop, mobil și iPad Pro: fără overflow, fără imagini tăiate greșit și fără dependență de hover pe touch.
4. Build de producție și verificare `prefers-reduced-motion`.
5. După push, verificare live a celor patru deep-linkuri și a încărcării imaginilor.

## În afara scopului

- Nu schimbăm structura sau conținutul paginii `/pachete` în acest pas.
- Nu modificăm catalogul, prețurile, videoclipurile sau formularul de ofertă.
- Nu publicăm imagini noi și nu schimbăm secțiunile Hero, Galerie ori Despre noi.

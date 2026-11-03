---
name: "FireArtRo — Admin Operate"
description: "Sistemul vizual al spațiului autentificat /admin: compact, întunecat, în română, cu accent albastru."
colors:
  primary: "#84b9ff"
  primary-fill: "#275fa9"
  primary-border: "#477fbf"
  primary-soft: "#162c46"
  control-selected: "#193451"
  control-selected-border: "#5687c4"
  control-selected-ink: "#d5e8ff"
  workspace-bg: "#0b1018"
  surface: "#101722"
  surface-muted: "#172131"
  sidebar: "#0e141e"
  sidebar-hover: "#151e31"
  ink: "#f2f5fa"
  muted: "#a3aec0"
  border: "#293447"
  field-bg: "#0b121c"
  button-bg: "#111b29"
  button-hover: "#1a2a40"
  button-hover-border: "#526d91"
  canvas-bg: "#070b11"
  danger: "#ffaaa0"
  saved: "#55d69e"
  pending: "#f8bd62"
  invalid: "#ff8277"
  white: "#fff"
typography:
  headline:
    fontFamily: 'Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "27px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-.025em"
  title:
    fontFamily: 'Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "19px"
    fontWeight: 600
  section:
    fontFamily: 'Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "17px"
    fontWeight: 600
    letterSpacing: "-.015em"
  body:
    fontFamily: 'Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "14px"
    lineHeight: 1.45
  supporting:
    fontFamily: 'Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "13px"
    lineHeight: 1.5
  label:
    fontFamily: 'Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "12px"
    fontWeight: 500
rounded:
  thumbnail: "4px"
  field: "6px"
  control: "7px"
  media-choice: "8px"
  canvas: "9px"
  collection: "10px"
  dialog: "12px"
spacing:
  tight: "4px"
  compact: "8px"
  small: "12px"
  medium: "16px"
  panel: "20px"
  workspace: "24px"
  wide: "28px"
components:
  button-primary:
    backgroundColor: "{colors.primary-fill}"
    textColor: "{colors.white}"
    rounded: "{rounded.control}"
    padding: "8px 11px"
  button-secondary:
    backgroundColor: "{colors.button-bg}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "8px 11px"
  button-secondary-hover:
    backgroundColor: "{colors.button-hover}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
  button-danger-quiet:
    backgroundColor: "{colors.button-bg}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "8px 11px"
  text-field:
    backgroundColor: "{colors.field-bg}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.field}"
    padding: "9px 10px"
  navigation:
    backgroundColor: "{colors.sidebar}"
    rounded: "{rounded.field}"
    padding: "8px 10px"
  device-choice:
    rounded: "{rounded.field}"
    padding: "8px 11px"
  device-choice-selected:
    backgroundColor: "{colors.control-selected}"
    textColor: "{colors.control-selected-ink}"
    rounded: "{rounded.field}"
  collection-row:
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "9px 7px"
  media-choice:
    textColor: "{colors.ink}"
    rounded: "{rounded.media-choice}"
    padding: "8px"
  frame-controls:
    textColor: "{colors.ink}"
---

# Design System: FireArtRo — Admin Operate

## Overview

**Creative North Star: "Operate"**

Acest document descrie exclusiv spațiul de lucru autentificat de la `/admin`, inclusiv selectorul media, dialogurile de lucru și cadrul exterior al previzualizării. Nu redefinește stilurile site-ului public cinematic FireArtRo și nu autorizează un redesign public. Ecranul de autentificare are propriile tratamente și nu este modelul acestei suprafețe.

Direcția confirmată păstrează identitatea întunecată și accentul albastru FireArtRo într-o interfață compactă, în română. Densitatea vine din ierarhia scurtă, separatoare și apropierea listei de editor. Fotografiile reale sunt conținut de ales și încadrat; suprafețele din jur rămân calme pentru a face selecția și starea draftului ușor de înțeles.

**Key Characteristics:**

- Suprafețe întunecate, mate, delimitate prin ton și borduri discrete.
- Albastru pentru selecție, focus și acțiunea principală de publicare.
- Listă și editor alăturate pe ecrane largi; un singur panou de colecție pe ecrane înguste.
- Media vizuală și reglaje independente pentru Telefon, Tabletă și Desktop.
- Draftul, previzualizarea și publicarea au stări explicite și distincte.

Sursa normativă pentru valorile extrase este `frontend/src/admin/admin-workspace.css`, încărcat după `frontend/src/admin.css` în `frontend/src/pages/AdminPage.jsx`. Frontmatter-ul păstrează paleta și scările reutilizate; rețetele complete, pragurile și excepțiile sunt în `.impeccable/design.json`. Contractul aprobat este `docs/plans/2026-11-02-admin-workspace-design.md`; contextul produsului este `PRODUCT.md`.

## Colors

Paleta este un albastru luminos de control peste suprafețe bleumarin aproape negre. Primitivii din frontmatter sunt valorile CSS existente, nu o nouă paletă pentru site-ul public.

### Primary

- **Albastru de focus** (`primary`): conturul tastaturii, accentul de selecție și indicatoarele interactive.
- **Albastru de publicare** (`primary-fill`, `primary-border`): acțiunea principală; fundal opac, text alb.
- **Albastru de selecție** (`primary-soft`, `control-selected`, `control-selected-border`, `control-selected-ink`): navigarea curentă, rândul ales și dispozitivul activ.

### Neutral

- **Fundal de lucru** (`workspace-bg`) și **bară laterală** (`sidebar`): structură stabilă în jurul conținutului.
- **Suprafață** (`surface`, `surface-muted`): containere și straturi apropiate; nu sunt panouri decorative.
- **Text principal** (`ink`), **text secundar** (`muted`) și **separatoare** (`border`): ierarhie și delimitare.
- **Câmp**, **buton** și **pânză media** (`field-bg`, `button-bg`, `canvas-bg`): funcții diferite, cu contraste discrete.
- **Trecere peste control** (`button-hover`, `button-hover-border`, `sidebar-hover`): feedback local, fără mișcare decorativă.

### Status

- **Salvat** (`saved`), **în așteptare** (`pending`) și **invalid / conflict / eroare** (`invalid`): punctele de stare păstrate din `admin.css` însoțesc textul românesc.
- **Acțiune sensibilă** (`danger`): tokenul păstrat pentru tratamentele sensibile moștenite. În cascada workspace-ului, „Șterge” primește aceeași culoare de text ca butonul secundar; numele și confirmarea explică acțiunea.

**The Accent With Meaning Rule.** Folosește albastrul pentru selecție, focus și acțiuni; nu îl extinde în suprafețe decorative sau gradiente ale editorului.

## Typography

**Body Font:** Inter, cu stiva de rezervă din frontmatter. Titlurile și controalele folosesc aceeași familie; nu există un font display separat pentru acest spațiu de lucru.

Caracterul este direct și compact. Titlurile identifică locul curent; etichetele folosesc propoziții în română și diferențe moderate de greutate, fără majuscule decorative. Scara este extrasă din rolurile existente și nu presupune un raport modular nou.

### Hierarchy

- **Headline:** titlul paginii, rolul `headline`; pe ecrane de cel mult 620 px scade la 25 px.
- **Title:** numele elementului din editor, rolul `title`.
- **Section:** grupuri precum imaginile categoriilor și sarcinile din panou, rolul `section`.
- **Body:** câmpuri și text de lucru, rolul `body`.
- **Supporting:** explicații de pagină, rolul `supporting`, cu lățime de cel mult 75ch în antet.
- **Label:** etichete de câmp, rolul `label`. Metadatele din liste și selector folosesc 11–12 px; numele din listă folosesc 13 px, cu greutate 550. Butoanele generale folosesc 13 px, cu greutatea 400 moștenită prin regula de font a controalelor din `admin.css`.

La cel mult 620 px, câmpurile text, selecturile și zonele de text folosesc 16 px pentru citire și introducere pe telefon. Valorile numerice ale încadrării folosesc cifre tabulare.

## Layout

Bara superioară este sticky, cu înălțime minimă de 60 px. Bara laterală are 208 px, iar panoul principal este fluid, cu `minmax(0,1fr)`. Lățimea maximă a editorului și a panoului principal este 1600 px. Spațiul de lucru folosește în mod repetat pașii din frontmatter, cu ajustări funcționale de 5–7 px pentru grupurile de controale.

Pe desktop, conținutul are padding 24 px / 28 px / 60 px. Colecția folosește o listă de 234 px lângă editor. Lista este sticky la 80 px și derulează în limita `calc(100dvh - 100px)`. Editorul are padding 20 px / 22 px / 28 px; formularul are două coloane și gap 14 px / 18 px. De la 1600 px, padding-ul principal devine 28 px / 36 px / 70 px, iar lista are 260 px.

Pragurile au scopuri distincte:

| Prag | Comportament existent |
| --- | --- |
| Cel mult 1100 px | Încadrarea imaginii trece într-o coloană; reglajele pot avea două coloane. Numele sesiunii este ascuns. |
| Cel mult 1050 px | Navigarea laterală este înlocuită de sertarul cu meniu; contextul din bara de sus este ascuns. Din nou de la 1051 px, navigarea laterală este disponibilă. |
| Cel mult 900 px | Colecția arată lista sau editorul, cu „Înapoi la listă”; grila selectorului media are trei coloane. |
| Cel mult 620 px | Formular și reglaje într-o coloană, câmpuri de minimum 44 px, selector media în două coloane și filtre pe rânduri. Bara de sus păstrează iconurile de anulare, previzualizare și publicare plus starea scurtă. |
| De la 1600 px | Spațiu de lucru mai generos, păstrând densitatea și limita de lățime existente. |

Sertarul are lățime `min(320px,calc(100vw - 24px))`. Selectorul media este centrat, cu lățime `min(1040px,calc(100% - 40px))` și înălțime maximă 88dvh; pe telefon folosește `calc(100% - 16px)` și 94dvh. Antetul, selecția curentă, filtrele și subsolul nu se comprimă; grila derulează independent și păstrează vizibilă selecția curentă.

**The Two Breakpoint Systems Rule.** Pragurile interfeței de lucru nu aleg setările imaginii publice. `frontend/src/styles/image-frame.css` aplică Telefon sub 600 px, Tabletă de la 600 la 1023 px și Desktop de la 1024 px. Aceste limite sunt distincte de 620 / 900 / 1050 / 1100 px din admin.

Previzualizarea folosește un viewport real de 1440 × 900 px, 834 × 1112 px sau 390 × 844 px, scalat vizual în spațiul disponibil. Nu înlocui viewport-ul iframe-ului cu lățimea vizuală micșorată.

## Elevation & Depth

Adâncimea vine din diferențele de ton, bordurile de un pixel și suprapunerea dialogurilor. Containerele de editare nu primesc umbre decorative. Bara de sus păstrează din stilul de bază umbra foarte discretă `0 1px 0 rgba(18, 28, 33, .02)` și `backdrop-filter: blur(12px)`; fundalul opac al acestei versiuni face ca bara să fie percepută ca o suprafață solidă. Overlay-ul dialogurilor folosește `rgba(0, 0, 0, .78)`, iar blurul overlay-ului este dezactivat de `admin-workspace.css`.

Stivuirea existentă este: bară superioară 1000; overlay dialog 9990; dialog standard 9991; selector media și sertar 9992; previzualizare 10000 și antetul ei 10001. Focusul este un contur albastru de 2 px, cu offset 3 px. Câmpurile păstrează și tratamentul de focus de bază; acesta nu înlocuiește conturul vizibil.

Tranzițiile moștenite ale butoanelor schimbă doar bordura, fundalul și culoarea în 0.16 s, `ease`. Cadrul de previzualizare nu are tranziție de lățime. Preferința pentru mișcare redusă dezactivează tranzițiile și derularea animată în spațiul de lucru și selector.

## Shapes

Colțurile sunt moderate: câmpurile și alegerile de dispozitiv folosesc `field`, butoanele și rândurile `control`, selecția media `media-choice`, pânza `canvas`, colecția `collection`, dialogurile `dialog`. Miniaturile rămân discret rotunjite. Cadrul imaginii are colțuri de 5 px și decupează conținutul; proporțiile lui exprimă setarea imaginii, nu o rază nouă pentru toate cardurile.

Bordurile separă listele, câmpurile și grupurile de formular. Secțiunile de câmpuri folosesc separatoare orizontale, iar panoul de sarcini folosește rânduri cu linie de bază, fără o grilă de carduri ornamentale.

## Components

### Buttons

Butoanele au formă compactă, text explicit și iconuri de 16 px acolo unde există. Rețetele sunt `button-primary`, `button-secondary` și `button-danger-quiet`. Înălțimea minimă generală este 36 px, padding-ul 8 px / 11 px, raza `control`; butoanele din bara de sus păstrează padding-ul 8 px / 12 px din selectorul mai specific al stilului de bază.

Butonul principal folosește umplerea albastră și text alb. În cascada actuală, regula lui de fundal și bordură rămâne prioritară inclusiv la hover. Butonul secundar schimbă local fundalul și bordura. Starea dezactivată are opacitate 0.45 și cursor `not-allowed`. Focusul păstrează conturul comun. Pe telefon, acțiunile de rând și de încadrare au înălțime minimă de 44 px; bara de sus folosește ținte compacte și nume accesibile pentru acțiunile afișate doar ca icon.

### Inputs / Fields

Câmpurile au fundal `field-bg`, bordură `border`, rază `field`, padding 9 px / 10 px și înălțime minimă 38 px pe desktop. Eticheta este permanentă; placeholder-ul nu o înlocuiește. Erorile folosesc bordura `invalid` și text de ajutor. Selecturile și textarea păstrează aceleași suprafețe. Pe telefon au minimum 44 px și text de 16 px.

### Navigation

Navigarea este grupată și căutabilă. Rândurile au minimum 36 px, padding 8 px / 10 px, rază `field` și iconuri discrete. Fundalul `primary-soft` și textul mai luminos identifică secțiunea curentă, împreună cu `aria-current`. Hover-ul folosește `sidebar-hover`. Sertarul mobil păstrează aceleași grupuri și oferă închidere și ieșire din cont.

### Chips

Alegerile de categorie și de dispozitiv sunt butoane cu bordură și `aria-pressed`. Nu sunt etichete pasive. Starea activă folosește rețeta `device-choice-selected`; minimum 38 px pe desktop și 44 px pentru dispozitive pe telefon. Grupul se poate împărți pe rânduri pentru categorii.

### Cards / Containers

Colecția este un container cu bordură, rază `collection` și listă alăturată editorului. Rândurile de listă au minimum 58 px, padding 9 px / 7 px, miniatură, nume și metadate. Hover-ul și selecția adaugă fundalul `primary-soft` și bordura comună. Pe telefon rândul are minimum 62 px. Panoul principal arată modificările nepublicate reale și scurtături; scurtăturile sunt rânduri de minimum 76 px și se reduc de la două coloane la una.

### Media Choice and Picker

Selecția media este un buton pe toată lățimea, cu miniatură de 64 × 48 px, nume și explicație. Selectorul deschis păstrează vizibil materialul curent deasupra filtrelor. Rezultatele folosesc miniaturi 4:3, titlu și categorie; selecția are bordură albastră și bifă. Căutarea și filtrele de categorie / tip reduc grila, iar lipsa rezultatelor oferă resetare. Tipurile imaginii și videoclipului păstrează metadatele existente; nu inventa fotografii sau active comerciale pentru previzualizarea componentelor.

### Image Framing and Preview

Încadrarea combină cadrul vizual, alegerea dispozitivului, poziție orizontală / verticală, zoom, așezare și formă. Pânza are fundal `canvas-bg`, bordură comună și rază `canvas`. Lățimea maximă vizuală a cadrului este 205 px pentru Telefon, 330 px pentru Tabletă și 520 px pentru Desktop. În grila largă, pânza și reglajele folosesc `minmax(0,1.3fr) minmax(210px,.8fr)`, cu gap 24 px.

Tragerea imaginii are aceleași rezultate ca reglajele accesibile. Poziția rămâne între 0 și 100, zoomul între 1 și 3, iar raportul personalizat între 0.4 și 3; opțiunea automată păstrează cadrul paginii. Resetarea dispozitivului și aplicarea pe toate dispozitivele sunt acțiuni separate. Lipsa unei setări Tabletă / Telefon moștenește Desktop; reglajul explicit creează o valoare proprie. Aceasta este încadrare la utilizare, nu transformare a fișierului original.

Previzualizarea este un dialog privat, cu pagină și dispozitiv selectabile, dimensiuni reale afișate și canvas public doar pentru citire. Bara și controalele sale aparțin adminului; pagina din iframe își păstrează designul public.

## Do's and Don'ts

### Do:

- **Do** păstrează toate regulile acestui document în suprafața autentificată `/admin` și în portalurile ei.
- **Do** folosește valorile extrase și componentele existente înainte de a introduce un nou tratament vizual.
- **Do** păstrează etichete în română, starea draftului și focusul vizibil în orice densitate.
- **Do** tratează pragurile navigării și pragurile încadrării media ca sisteme distincte.
- **Do** păstrează selecția explicită a fotografiei și reglajele independente pe utilizare și dispozitiv.
- **Do** verifică lista, editorul, selectorul media și previzualizarea cu tastatura și la 320, 390, 768, 1280 și 1920 px.

### Don't:

- **Don't** aplica aceste suprafețe, scări sau rețete ca redesign al site-ului public cinematic FireArtRo.
- **Don't** introduce gradiente decorative, sticlă decorativă, text uriaș, indicatori inventați sau animații care întârzie editarea în workspace.
- **Don't** micșora toate coloanele de colecție pe telefon; păstrează alternanța listă / editor.
- **Don't** ascunde acțiunile esențiale, materialul selectat sau starea salvării sub conținutul care derulează.
- **Don't** înlocui automat imaginea aleasă sau modifica originalul când utilizatorul resetează încadrarea.
- **Don't** prezenta un draft salvat sau o previzualizare ca publicare confirmată.

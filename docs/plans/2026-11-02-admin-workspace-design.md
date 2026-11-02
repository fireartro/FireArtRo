# Admin FireArtRo — propunere de lucru

Stare: utilizatorul a aprobat varianta recomandată la 2 noiembrie 2026. Implementarea urmează planul asociat. Documentul este păstrat în docs/plans, directorul de documentație urmărit de acest proiect; docs/superpowers este exclus din Git.

## Obiectiv și context verificat

Proprietarul trebuie să poată modifica rapid conținutul, alege imaginile și controla încadrarea lor pe telefon, tabletă și desktop, apoi verifica și publica rezultatul. Interfața rămâne în română și folosește identitatea FireArtRo existentă, cu suprafețe întunecate și accent albastru.

În implementarea actuală, AdminField folosește un select text pentru media. HomePackages acordă prioritate unor imagini fixate în cod, iar selectHomeGallery poate înlocui selecțiile pentru a evita repetițiile. Modelele CMS nu au reglaje de poziție sau zoom. Salvarea automată în draft, istoricul publicărilor, protejarea fișierelor folosite și prevenirea conflictelor există și trebuie păstrate.

## Variante și alegere recomandată

1. **Editor cu previzualizare — recomandat:** listă compactă de elemente în stânga, formular organizat în secțiuni și previzualizare vizuală pentru imaginile selectate. Permite controlul precis cerut fără navigare repetată între pagini.
2. **Tabel compact:** foarte bun pentru multe înregistrări și editări text, dar încadrarea imaginilor ar necesita deschiderea repetată a unui dialog.
3. **Editare în pași:** ghidează prima utilizare, dar încetinește modificările zilnice și comparația dintre dispozitive.

## Structura adminului

- Bară superioară fixă, joasă: secțiunea curentă, starea salvării, Anulează, Previzualizează și o singură acțiune de publicare.
- Navigare laterală mai îngustă, grupată; căutare a secțiunilor și acces rapid la Prima pagină, Pachete, Galerie, Parteneri, Cereri și Mesaje.
- Panoul principal arată modificările reale nepublicate și sarcinile utile, fără statistici sau indicatori inventați.
- Colecțiile au căutare, filtre relevante, miniaturi și listă cu selecție stabilă; duplicatele și reordonarea păstrează identificatorii corecți.
- Formularele au grupuri pliabile și câmpuri esențiale la vedere. SEO, legături și detalii tehnice sunt grupate separat.
- Pe telefon se vede lista sau editorul, cu întoarcere clară și controale tactile; nu se micșorează toate coloanele pe același ecran.

## Alegerea și încadrarea imaginilor

- Selector vizual cu miniaturi, căutare, categorie și tip de fișier; selecția curentă rămâne vizibilă.
- Pentru imaginile din secțiunile Pachete și Galerie de pe homepage și pentru imaginile pachetelor/galeriei: previzualizare Telefon / Tabletă / Desktop.
- Imaginea se poate repoziționa prin tragere; aceleași reglaje sunt disponibile prin controale accesibile pentru poziția orizontală, verticală și zoom.
- Opțiuni clare: Umple cadrul și Imagine completă; dimensiunea cadrului se poate regla pe dispozitiv în limite validate. Valorile implicite păstrează forma actuală până la o editare explicită.
- Resetare, copierea reglajelor între dispozitive și legarea/dezlegarea valorilor evită introducerea repetată a acelorași setări.
- Reglajele aparțin utilizării imaginii, nu fișierului original. Aceeași fotografie poate avea altă încadrare într-un pachet și într-un cadru al galeriei.
- O selecție explicită din admin are prioritate pe site. Prevenirea duplicatelor devine avertizare explicabilă pentru selecțiile controlate de proprietar, nu înlocuire ascunsă.
- Nu se modifică fișierele foto/video originale și nu se creează exporturi media noi pentru aceste reglaje.

## Salvare, publicare și stări

- Modificările rămân în draft până la publicare; previzualizarea folosește draftul real.
- Stările de încărcare, lipsă rezultate, fișier indisponibil, salvare, eroare de validare și conflict au explicație și acțiune concretă.
- Publicarea arată secțiunile schimbate; erorile duc la câmpul relevant. Controalele nu pretind succes înainte de răspunsul serverului.
- Schema backend și schema frontend acceptă numai reglaje finite, cu limite. Documentele vechi fără aceste câmpuri rămân valide și își păstrează aspectul.
- Solicitările, mesajele, blogul, integrările și istoricul rămân funcționale și primesc aceeași densitate și ierarhie vizuală.

## Reguli vizuale

Interfață de lucru, cu text lizibil, spații de 4/8 px, separatoare discrete, colțuri moderate și accent albastru pentru selecție și acțiunea principală. Fără gradient decorativ, efecte de sticlă, text uriaș, grile de statistici fără utilitate sau animații care întârzie editarea. Densitatea mai mare nu reduce țintele tactile și vizibilitatea focusului.

## Verificare și criterii de acceptare

1. Aleg o imagine pentru categoria de pachete de pe homepage și site-ul respectă alegerea.
2. Reglez imaginea și cadrul pe telefon fără să schimb încadrarea independentă de pe desktop sau altă utilizare a fișierului.
3. Resetarea și anularea restabilesc valorile; schimbarea filtrului sau numelui nu editează alt element.
4. Draftul se salvează și poate fi reîncărcat fără pierderea reglajelor; publicarea și restaurarea unei versiuni păstrează schema validă.
5. Previzia și afișarea publică folosesc aceeași logică pentru încadrare și aceleași praguri responsive.
6. Editorul, selectorul media și publicarea sunt utilizabile cu tastatura și la 320, 390, 768, 1280 și 1920 px, fără depășire orizontală sau controale ascunse.
7. Testele verifică persistența datelor, limitele invalide, documentele vechi și comportamentul componentelor; verificarea vizuală folosește date izolate, fără a publica modificări de conținut în contul real.

## Pași și stare

- [x] Inspecția structurii actuale și a modului în care sunt alese imaginile.
- [x] Propunere concretă cu alternative și criterii de acceptare.
- [x] Confirmarea direcției și a limitelor intervenției.
- [ ] Plan de implementare, schemă compatibilă și teste de persistență.
- [ ] Editor de încadrare, selector media și aplicarea setărilor pe site.
- [ ] Compactarea adminului și verificarea completă a fluxurilor.
- [ ] Build, review vizual, commit și publicare verificate.

# Verificarea adminului și a încadrării imaginilor

Verificare încheiată local la 3 noiembrie 2026, înaintea publicării. Testele de editare, publicare și restaurare au folosit un server loopback cu o copie publică detașată, păstrată numai în memorie. Nu au modificat conținutul real.

## Verificări automate

| Verificare | Rezultat |
|---|---|
| Backend, cu versiunile FastAPI/Starlette din requirements | 526 teste trecute, 10 omise de configurația existentă |
| Frontend | 77 suite, 515 teste trecute |
| API și configurația deploymentului | 81 teste trecute |
| Artefacte de producție, metadate și limite de bundle | 38 teste trecute |
| Build client și renderer public | Compilare reușită, fără avertismente |

Testele noi acoperă contractul opțional și compatibilitatea documentelor vechi, valori finite și limite, selecția manuală independentă de resetarea cadrului, copiere/moștenire/resetare pe dispozitive, drag cu o singură intrare în Undo, atașarea atomică a unui material din catalog, ciclul de viață al iframe-urilor și focusul la închiderea previzualizării.

## Fluxuri în browser

Chrome și WebKit au verificat alegerea sursei, setări independente desktop/telefon, salvarea și reîncărcarea, previzualizarea reală la 1440/834/390 px, derularea, publicarea și restaurarea locală. Încadrările au fost verificate separat în categoriile de pe homepage, imaginile promovate, miniaturile galeriei și fotografiile pachetelor.

Editorul a fost verificat la 320, 390, 768, 901, 1000, 1050, 1100, 1280 și 1920 px: fără depășire orizontală, coloană principală îngustată accidental sau stare de salvare ascunsă. Pe telefon au fost exercitate navigarea, căutarea secțiunilor, trecerea listă/editor și revenirea din selectorul media.

Previzualizarea a trecut Tab în iframe, Page Down, Tab înapoi la controale, Escape și revenirea focusului la butonul de deschidere, inclusiv în WebKit. Selectorul păstrează materialul curent vizibil când filtrele nu întorc rezultate, filtrează materialele mixte după tip și resetează toate filtrele.

Capturile finale au fost făcute după încărcarea interfeței, stabilirea geometriei și decodarea imaginilor. Review-ul independent a încheiat cu verdictul **ship pentru cele trei corecții vizuale cerute**: selecție persistentă, filtrare după tip și eliminarea supratitlului din panoul principal. Review-ul de cod a confirmat remedierea constatărilor importante.

## Limite ale verificării

WebKit local verifică motorul folosit de Safari, fără a constitui un test pe un iPhone sau Mac fizic. Verificările nu pretind audit complet cu un cititor de ecran. Integrarea cu servicii externe și conținutul comercial real nu au fost modificate pentru testare.

## Utilizare

Instrucțiunile pentru proprietar sunt în `docs/admin-image-editing.md`. Contractul aprobat și planul de implementare se află în `docs/plans/2026-11-02-admin-workspace-*.md`. Dovezile locale și capturile sunt în directorul ignorat `output/`.

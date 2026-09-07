# FireArtRo: activarea Turnstile și Google Analytics

Ambele integrări sunt pregătite să rămână inactive până când valorile lor sunt configurate complet. Nu activa o integrare doar pe jumătate.

## Cloudflare Turnstile

1. Creează în Cloudflare un widget pentru `fireart.ro` și păstrează separat cheia publică și cheia secretă.
2. În Vercel, adaugă pentru același mediu:

   - `REACT_APP_TURNSTILE_SITE_KEY` — cheia publică;
   - `TURNSTILE_SECRET_KEY` — cheia secretă;
   - `TURNSTILE_ENABLED=true`.

3. Redeploy-uiește mediul. Verifică `/api/health`, apoi trimite o cerere reală de test din formular.
4. Dacă una dintre chei nu este încă disponibilă, păstrează explicit `TURNSTILE_ENABLED=false` și lasă cele două chei neconfigurate.

Tokenul Turnstile este verificat numai pe server și nu este salvat împreună cu solicitarea. Documentația oficială pentru verificarea pe server este la [Cloudflare Siteverify](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).

## Google Analytics 4

1. Creează proprietatea GA4 și fluxul Web pentru `https://fireart.ro`.
2. Adaugă în Vercel `REACT_APP_GA_MEASUREMENT_ID` în formatul `G-...`, apoi redeploy-uiește.
3. Testează într-o fereastră privată:

   - înainte de acceptarea categoriei Analiză nu trebuie încărcat scriptul Google;
   - după acceptare trebuie înregistrată o vizualizare pentru calea paginii;
   - Admin și mediile Preview nu trebuie măsurate;
   - după retragerea acordului nu trebuie trimise evenimente noi.

Integrarea folosește consimțământ explicit și păstrează stocarea pentru publicitate, semnalele Google și personalizarea reclamelor dezactivate. Referința oficială este [Google consent mode](https://developers.google.com/tag-platform/security/concepts/consent-mode).

## Ordine sigură de activare

1. Configurează valorile în Preview.
2. Rulează verificările funcționale și de confidențialitate în Preview.
3. Copiază exact configurația aprobată în Production.
4. Redeploy-uiește și verifică din nou `/api/health`, formularul și bannerul de cookies.
5. Publică în Admin versiunile juridice actualizate numai după revizuirea proprietarului sau a unui specialist juridic.

# FireArtRo: conectarea Vercel pentru CMS

Această procedură se face o singură dată, după ce codul este aprobat. O publicare din Admin nu mai cere apoi Git, push sau un nou deploy.

## Înainte de conectare

1. Păstrează proiectul Vercel la rădăcina repository-ului, nu în `frontend/`.
2. Verifică existența fișierelor `vercel.json`, `requirements.txt`, `package.json` și `frontend/yarn.lock` în repository.
3. Folosește un proiect Preview pentru prima validare. Nu porni direct producția.
4. Creează o parolă bcrypt local, interactiv:

   ```powershell
   python scripts\hash_admin_password.py
   ```

   Comanda nu pune parola în istoric și afișează numai hashul final.

5. Rulează verificarea locală înainte de orice conectare. Din rădăcina
   repository-ului, cu mediul virtual de dezvoltare deja instalat:

   ```powershell
   $env:PYTHONPATH = "$PWD\backend"
   .\.venv-cms\Scripts\python.exe -m pytest backend/tests -q
   yarn.cmd --cwd frontend test --watchAll=false --runInBand
   npm.cmd run test:api
   ```

   Prima comandă păstrează atât modulele FastAPI din `backend/`, cât și
   entrypoint-ul Vercel din `api/` în aceeași suită. Nu cere autentificare,
   conectare sau deploy Vercel.

## Resurse Vercel

1. Conectează repository-ul la proiectul Vercel existent.
2. În Storage, conectează MongoDB Atlas. Folosește baze distincte:

   - Preview: `fireartro_preview`
   - Production: `fireartro_production`

3. Creează un Vercel Blob **Public**. Imaginile și clipurile acestui site sunt publice; documentele sau datele clienților nu se urcă aici.
4. Creează variabilele de mai jos pentru Preview și Production. Marchează parolele, hashurile și tokenurile ca Sensitive.

| Variabilă | Tip | Observație |
| --- | --- | --- |
| `MONGODB_URI` | secret | furnizat de Atlas; integrarea Vercel poate crea automat `MONGO_MONGODB_URI`, acceptat direct de aplicație |
| `DB_NAME` | normal | diferit în Preview și Production |
| `ADMIN_USERNAME` | secret | operatorul Admin |
| `ADMIN_PASSWORD_HASH` | secret | rezultatul utilitarului bcrypt |
| `ADMIN_SESSION_SECRET` | secret | minimum 32 bytes aleatori |
| `BLOB_READ_WRITE_TOKEN` | secret | furnizat de Blob |
| `VERCEL_BLOB_MEDIA_ORIGIN` | normal | de exemplu `https://store-id.public.blob.vercel-storage.com` |
| `CORS_ORIGINS` | normal | domeniul final și, dacă e nevoie, cel Preview |
| `GOOGLE_PLACES_API_KEY`, `GOOGLE_PLACE_ID` | secret | opțional; fără ambele Google rămâne ascuns |
| `META_PAGE_ID`, `META_PAGE_ACCESS_TOKEN` | secret | opțional; fără ambele Facebook rămâne ascuns |
| `META_GRAPH_API_VERSION` | normal | opțional; păstrează versiunea aprobată |

Nu crea niciodată variabile `REACT_APP_*` pentru secrete. Browserul nu primește parole, hashuri, tokenuri Blob sau tokenuri Google/Meta.
Fișierele locale `backend/.env` sunt excluse explicit din pachetul Python; nu le urca și nu le folosi ca mecanism de configurare în Vercel.

## Validare Preview

1. Creează un Preview deployment din branchul de lucru.
2. Rulează din repository:

   ```powershell
   .\scripts\verify-vercel-cms.ps1 -Environment preview
   ```

   Scriptul verifică numai numele variabilelor și nu le afișează.
3. Deschide `/api/health`. Starea trebuie să fie `ready` și fără `configuration_errors`.
4. Deschide `/admin`, autentifică-te, inițializează conținutul o singură dată și verifică:

   - panoul „Starea integrărilor”: MongoDB funcțional, Blob configurat și furnizorii de recenzii în starea așteptată;
   - autosave în draft;
   - previzualizare desktop/tabletă/telefon;
   - publicare și refresh public;
   - istoric și restaurare ca draft;
   - încărcare media, Blog și cereri de ofertă;
   - recenziile rămân invizibile când lipsesc cheile fiecărui furnizor.

5. Abia după această verificare repetă variabilele pentru Production și promovează deploymentul validat.

## Rute și build

- `frontend/build` este site-ul public și interfața `/admin`.
- `api/index.py` servește FastAPI sub `/api/*`.
- `api/admin/blob-upload.js` este funcția Node separată pentru tokenurile Vercel Blob.
- Precedența filesystem-ului Vercel păstrează funcția de upload înainte de rewrite-ul API general; fallbackul SPA se aplică numai după API.
- CSP permite doar aceeași origine, YouTube și domeniile publice Vercel Blob pentru imagini/video și încărcări. Nu lărgi `connect-src` sau `media-src` la `https:` generic.

## După conectare

Păstrează acest runbook cu acces de administrator. Dacă se schimbă Blob store-ul, actualizează `VERCEL_BLOB_MEDIA_ORIGIN` în toate mediile înainte de orice încărcare nouă.

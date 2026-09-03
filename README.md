# FireArtRo

Website-ul FireArtRo pentru spectacole cu drone, artificii și efecte scenice.

## Structură

- \`frontend/\` — aplicația publică React și interfața Admin;
- \`backend/\` — API FastAPI pentru conținut, autentificare Admin, cereri de ofertă, blog, media și integrarea recenziilor;
- \`api/\` — punctele de intrare Vercel;
- \`docs/runbooks/\` — pașii de operare pentru CMS și configurarea Vercel.

Configurația de producție folosește [\`vercel.json\`](./vercel.json) din rădăcina repository-ului. Nu seta proiectul Vercel cu \`frontend/\` ca Root Directory.

## Rulare locală

Cerințe: Node.js 20.19+ (22 recomandat), Corepack/Yarn și Python 3.12.

\`\`\`powershell
npm ci
corepack enable
corepack yarn --cwd frontend install --frozen-lockfile

py -3.12 -m venv .venv
.\\.venv\\Scripts\\Activate.ps1
pip install -r backend/requirements-dev.txt

Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
\`\`\`

Pentru dezvoltare locală cu API separat, setează \`REACT_APP_BACKEND_URL=http://localhost:8000\` în \`frontend/.env\`.

În două terminale:

\`\`\`powershell
# API
cd backend
..\\.venv\\Scripts\\python -m uvicorn server:app --reload --port 8000

# Frontend
corepack yarn --cwd frontend start
\`\`\`

## Verificări

\`\`\`powershell
$env:PYTHONPATH = "$PWD\\backend"
.\\.venv\\Scripts\\python -m pytest backend/tests -q

npm run test:api
$env:CI = "true"
corepack yarn --cwd frontend test --watchAll=false --runInBand

$env:NODE_OPTIONS = "--max-old-space-size=8192"
corepack yarn --cwd frontend build
\`\`\`

Verificările de mai sus rulează automat și în GitHub Actions la fiecare push și pull request.

## Configurare producție

Păstrează toate secretele exclusiv în variabilele de mediu Vercel:

- MongoDB: \`MONGODB_URI\`, \`DB_NAME\`;
- Admin: \`ADMIN_USERNAME\`, \`ADMIN_PASSWORD_HASH\`, \`ADMIN_SESSION_SECRET\`;
- Media: \`BLOB_READ_WRITE_TOKEN\`, \`VERCEL_BLOB_MEDIA_ORIGIN\`;
- Recenzii: \`GOOGLE_PLACES_API_KEY\`, \`GOOGLE_PLACE_ID\`, \`META_PAGE_ID\`, \`META_PAGE_ACCESS_TOKEN\`.

Nu publica aceste valori în \`REACT_APP_*\` și nu le adăuga în Git. Pentru lista completă de pași, citește:

- [configurarea Vercel](./docs/runbooks/fireartro-vercel-setup.md);
- [operarea CMS-ului](./docs/runbooks/fireartro-cms-operations.md).

# FireArtRo — activarea recenziilor Google și Facebook

Stare verificată în Chrome la 2 noiembrie 2026. Acest document nu conține chei, tokenuri, parole sau recenzii de clienți.

## Ce este pregătit

- Gateway public: `GET /api/reviews`; carduri Google/Facebook cu sursa, autorul, data și nota numai când furnizorul o oferă.
- Cererile Places sunt făcute de server, în română (`languageCode=ro`). Datele Google nu sunt păstrate într-un cache comun. Facebook folosește cache-ul scurt existent.
- Sursele care nu răspund sau nu au recenzii cu text nu produc carduri goale și nu blochează cealaltă sursă.
- Admin → Starea integrărilor indică numele variabilelor lipsă, fără valorile lor, și diferențiază un răspuns gol de o eroare de acces/provider.
- Admin → Setări recenzii controlează afișarea și limita; Google Places întoarce cel mult cinci recenzii. Arhiva de testimoniale manuale nu alimentează benzile externe.
- Proiect Cloud existent: `vital-charger-508519-f0` / **FireArtRo Google Reviews**. Places API (New) este deja activ. Nu crea un proiect sau un profil Business duplicat.

## Pașii proprietarului

1. **Google Business:** profilul existent apare neconfirmat. Google oferă „Trimite un videoclip al companiei”, cu locația, echipamentul și dovada gestionării. Proprietarul trebuie să facă filmarea reală prin fluxul Google: https://business.google.com/locations . Nu trimite o filmare de spectacol sau un montaj drept dovadă a administrării.
2. **Google Cloud:** proiectul nu are cont de facturare asociat. Proprietarul alege și asociază contul de facturare și stabilește consumul acceptat: https://console.cloud.google.com/billing/linkedaccount?project=vital-charger-508519-f0 . Nu porni automat un trial sau o plată. O alertă de buget nu este o limită de cheltuială.
3. **Google key:** lista Credentials nu conține chei API. După decizia de facturare, creează sau autorizează explicit crearea unei chei restricționate la Places API (New), cu cotele potrivite. Cheia este pentru server; o restricție HTTP-referrer de browser nu se aplică gateway-ului Python. Transferă cheia direct în Vercel, fără chat, capturi sau Git.
4. **Meta:** în Chrome nu există sesiune Facebook autentificată. Proprietarul se autentifică pe https://developers.facebook.com/apps/ cu un cont care administrează pagina FireArtRo. Verifică aplicația existentă și accesul permis înainte să creezi o altă aplicație sau un token nou.

Nu este necesară trimiterea parolelor către agent. Verificarea fizică, autentificarea și alegerea facturării se fac în paginile oficiale. După acești pași, identificatorii publici și configurarea tehnică pot fi finalizate în aceeași sesiune.

## Configurarea finală în Vercel Production

| Variabilă | Valoare necesară | Protecție |
| --- | --- | --- |
| `GOOGLE_PLACE_ID` | Place ID al profilului public FireArtRo, verificat; nu codul intern Business și nu un ID ghicit | server-only |
| `GOOGLE_PLACES_API_KEY` | Cheia restricționată din proiectul Cloud de mai sus | Sensitive, server-only |
| `META_PAGE_ID` | ID numeric al paginii FireArtRo administrate | server-only |
| `META_PAGE_ACCESS_TOKEN` | Token de pagină valid, cu acces confirmat la recenzii | Sensitive, server-only |
| `META_GRAPH_API_VERSION` | Versiunea folosită și validată pentru aplicație; implicitul actual este `v23.0` | server-only |

Nu introduce valori demonstrative sau variabile goale doar ca integrarea să pară configurată. Pentru Preview folosește credențiale de test distincte sau lasă furnizorii neconfigurați. Niciun secret de recenzii nu are prefix `REACT_APP_`.

După configurare:

1. Completează URL-ul public Google în Admin → Companie, fără să publici alte modificări de draft independente.
2. Fă un deployment al codului curent pe Production pentru a aplica variabilele.
3. Admin → Starea integrărilor → Verifică din nou: confirmă conectarea și existența recenziilor cu text. Un răspuns fără recenzii este posibil și nu trebuie înlocuit cu un testimonial inventat.
4. Verifică `/api/reviews`: numai recenzii publice, fără credențiale. Compară autorul, textul, nota, data și linkul cu platforma sursă.
5. Verifică telefon, desktop, texte lungi, linkuri, animație și răspunsul cu un singur furnizor disponibil. Testele locale au fixtures izolate; ele nu dovedesc accesul real Google/Meta.
6. Adaugă linkul de lăsat o recenzie numai după ce profilul public corect este verificat. Colectarea directă pe site nu este implementată de acest gateway.

## Surse oficiale

- [Configurarea Places API (New)](https://developers.google.com/maps/documentation/places/web-service/get-api-key)
- [Parametrii Place Details, inclusiv limba](https://developers.google.com/maps/documentation/places/web-service/place-details)
- [Limita și ordinea recenziilor Places](https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places)
- [Confirmarea companiei](https://support.google.com/business/answer/7107242)

# FireArtRo — activarea recenziilor Google și Facebook

Constatările despre conturile Google datează din 2 și 4 noiembrie 2026.

## Ce este pregătit

- Gateway-ul public `GET /api/reviews` furnizează recenziile Google Places. Serverul le solicită în română (`languageCode=ro`) și le livrează cu sursa, autorul, data și nota atunci când Google le oferă. Conținutul Google este cerut proaspăt.
- Recenziile Facebook apar prin widgetul Elfsight după acordul pentru Conținut extern. Dacă widgetul este indisponibil, vizitatorii pot deschide recenziile direct pe Facebook.
- Admin → Setări → Integrări indică numele variabilelor Google care lipsesc și diferențiază un răspuns gol de o eroare de acces. Cardul Elfsight trimite către verificarea pe site.
- Admin → Recenzii controlează afișarea ambelor surse și limita Google Places. Google întoarce cel mult cinci recenzii. Testimonialele manuale se gestionează în arhiva din Admin.
- Proiect Cloud existent: `vital-charger-508519-f0` / **FireArtRo Google Reviews**. Places API (New) este deja activ. Nu crea un proiect sau un profil Business duplicat.

## Protecția consumului de recenzii — 4 noiembrie 2026

Gateway-ul aplică următoarele limite înaintea fiecărui apel nou către Google Places.

- Cel mult 10 apeluri pe minut pentru același client.
- Cel mult 60 de apeluri pe minut și 1.000 într-o zi, cumulate între toate instanțele.
- Un singur apel în curs, cu un lease Mongo de 15 secunde și termen absolut de 5 secunde pentru cererea externă.
- Pauză comună de 30 de secunde după o eroare a furnizorului.

Ferestrele sunt glisante. Colecția `review_provider_budgets` păstrează timpi, identificatori HMAC ai clienților și metadate de lease și de pauză pentru Google. Indexul TTL pe `expires_at` este creat la pornire și permite expirarea eventualelor documente Facebook istorice.

Cererile simultane din același event loop reutilizează apelul aflat în curs. Alte instanțe și event loop-uri folosesc același lease și aceleași cote în Mongo. Clientul HTTP aparține apelului comun, astfel încât ceilalți vizitatori pot primi rezultatul dacă un vizitator întrerupe cererea. Verificarea din Admin folosește aceeași protecție.

Când cota, lease-ul sau pauza oprește o cerere Google, gateway-ul întoarce HTTP 429 cu `Retry-After`. Dacă protecția comună este indisponibilă, gateway-ul întoarce HTTP 503 și oprește apelul extern. Ambele răspunsuri au `Cache-Control: no-store, private`. Fără configurarea Google, gateway-ul răspunde cu HTTP 200 și `providers: []`. Widgetul Facebook se încarcă independent.

În Google Cloud verifică separat cota strictă a metodei Places Details din proiectul existent și restricția cheii la Places API (New). O cotă externă de cel mult 60 de cereri/minut este un al doilea prag, independent de plafonul glisant de 1.000/zi din aplicație. Nu activa facturare, trial-uri sau chei noi pentru această verificare. Alertele de buget nu opresc consumul. Limitele aplicației nu dovedesc că aceste setări externe sunt deja aplicate; consemnează separat verificarea live.

Verificare live în Chrome la 4 noiembrie 2026: proiectul afișează „This project has no billing account”. Pagina cotelor Places redirecționează către Maps onboarding și cere „Verify your account to use Maps APIs and services”, cu telefon și date de plată. Cotele externe și restricțiile cheilor nu au putut fi inspectate/aplicate prin această pagină; nu s-au activat facturare, trial-uri sau chei.

## Pașii proprietarului

1. **Google Business:** profilul existent apare neconfirmat. Google oferă „Trimite un videoclip al companiei”, cu locația, echipamentul și dovada gestionării. Proprietarul trebuie să facă filmarea reală prin fluxul Google: https://business.google.com/locations . Nu trimite o filmare de spectacol sau un montaj drept dovadă a administrării.
2. **Google Cloud:** proiectul nu are cont de facturare asociat. Proprietarul alege și asociază contul de facturare și stabilește consumul acceptat: https://console.cloud.google.com/billing/linkedaccount?project=vital-charger-508519-f0 . Nu porni automat un trial sau o plată. O alertă de buget nu este o limită de cheltuială.
3. **Google key:** lista Credentials nu conține chei API. După decizia de facturare, creează sau autorizează explicit crearea unei chei restricționate la Places API (New), cu cotele potrivite. Cheia este pentru server; o restricție HTTP-referrer de browser nu se aplică gateway-ului Python. Transferă cheia direct în Vercel, fără chat, capturi sau Git.

Nu este necesară trimiterea parolelor către agent. Verificarea fizică, autentificarea și alegerea facturării se fac în paginile oficiale. După acești pași, identificatorii publici și configurarea tehnică pot fi finalizate în aceeași sesiune.

## Configurarea finală în Vercel Production

| Variabilă | Valoare necesară | Protecție |
| --- | --- | --- |
| `GOOGLE_PLACE_ID` | Place ID al profilului public FireArtRo, verificat; nu codul intern Business și nu un ID ghicit | server-only |
| `GOOGLE_PLACES_API_KEY` | Cheia restricționată din proiectul Cloud de mai sus | Sensitive, server-only |

Pentru Preview folosește credențiale Google de test distincte sau lasă integrarea neconfigurată. Păstrează cheia Google Places în configurația serverului.

După configurare:

1. Completează URL-ul public Google în Admin → Companie, fără să publici alte modificări de draft independente.
2. Fă un deployment al codului curent pe Production pentru a aplica variabilele.
3. Admin → Starea integrărilor → Verifică din nou: confirmă conectarea și existența recenziilor cu text. Un răspuns fără recenzii este posibil și nu trebuie înlocuit cu un testimonial inventat.
4. Verifică `/api/reviews`: numai recenzii publice, fără credențiale. Compară autorul, textul, nota, data și linkul cu platforma sursă.
5. Verifică pe telefon și desktop textele lungi, linkurile și dialogul recenziilor Google. Verifică widgetul Facebook pe site după acordul pentru Conținut extern, apoi retrage acordul și confirmă că linkul Facebook rămâne disponibil. Confirmă accesul real separat de testele locale cu răspunsuri simulate.
6. Adaugă linkul de lăsat o recenzie numai după ce profilul public corect este verificat. Colectarea directă pe site nu este implementată de acest gateway.

## Surse oficiale

- [Configurarea Places API (New)](https://developers.google.com/maps/documentation/places/web-service/get-api-key)
- [Parametrii Place Details, inclusiv limba](https://developers.google.com/maps/documentation/places/web-service/place-details)
- [Limita și ordinea recenziilor Places](https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places)
- [Confirmarea companiei](https://support.google.com/business/answer/7107242)

# FireArtRo: monitorizare și recuperare

## Monitorizare fără servicii plătite

Workflow-ul GitHub `Production uptime` rulează la minutele 17 și 47 ale fiecărei ore și poate fi pornit și manual. El verifică fără date personale:

- aplicația publică de la `https://fireart.ro/`;
- starea bazei de date și a indicilor prin `/api/health`;
- sitemap-ul dinamic prin `/api/sitemap.xml`;
- legătura dintre `robots.txt` și sitemap.

Aceeași verificare se poate rula local din rădăcina proiectului cu `npm run verify:production`. Un eșec apare în GitHub Actions; notificările contului GitHub trebuie activate de fiecare operator care dorește emailuri.

Workflow-urile programate ale repository-urilor publice pot fi dezactivate de GitHub după o perioadă lungă fără activitate. Verifică lunar că ultimul job programat există și a trecut.

## Diagnosticarea unui incident

1. Deschide deploymentul curent în Vercel și verifică dacă funcțiile raportează erori.
2. Deschide `/api/health`. Nu copia în tichete URL-uri de bază de date, tokenuri, cookie-uri sau conținutul cererilor.
3. Verifică Atlas pentru disponibilitate și limite, apoi Resend dacă incidentul privește emailul.
4. Dacă numai conținutul este greșit, restaurează o versiune anterioară ca draft în Admin, verific-o și public-o explicit.
5. Dacă deploymentul este cauza, folosește deploymentul Vercel anterior sau un commit `git revert`. Nu folosi `git reset --hard` pe producție.

## Backup și restaurare

Clusterul Atlas gratuit nu oferă backup automat. Până la alegerea unui plan cu backup, proprietarul trebuie să stabilească un export periodic criptat, locul de păstrare, durata de retenție și persoana responsabilă. Nu exporta date personale pe un calculator partajat și nu folosi repository-ul Git ca backup.

Media publică din Vercel Blob trebuie inventariată separat. Un backup este complet numai dacă include atât datele MongoDB, cât și fișierele media, iar o restaurare a fost testată într-un mediu Preview izolat.

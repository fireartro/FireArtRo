import { SITE_DETAILS, BUSINESS_HOURS } from "./businessContent";

const EMAIL = SITE_DETAILS.email;
const UPDATED = "26 septembrie 2026";
const IDENTITY = `${SITE_DETAILS.legalName}, CUI ${SITE_DETAILS.taxId}, nr. Registrul Comerțului ${SITE_DETAILS.registrationNumber}, cu sediul social în ${SITE_DETAILS.registeredOffice}`;

// Shared source for defaults and the targeted CMS publication. See the legal-review runbook.
export const LEGAL_PAGE_PRESENTATION = {
  confidentialitate: {
    path: "/confidentialitate", eyebrow: "Protecția datelor", title: "Politica de confidențialitate",
    description: "Cum sunt folosite datele tale când vizitezi site-ul sau contactezi FireArtRo.",
    updated: UPDATED,
    sections: [
      { title: "Operatorul și contactul", body: [
        `Operatorul datelor pentru fireart.ro și solicitările adresate mărcii FireArtRo este ${IDENTITY}.`,
        `Pentru întrebări și exercitarea drepturilor ne poți scrie la ${EMAIL} sau la sediul social. Telefon: +40 787 602 144.`,
      ] },
      { title: "Datele prelucrate și sursa lor", body: [
        "Prin formularul de ofertă primim datele completate de tine: nume, prenume, telefon, email, localitatea, locația și data evenimentului, tipul evenimentului, serviciile sau pachetul ales și mesajul. Câmpurile obligatorii sunt necesare analizării cererii; fără ele formularul nu poate fi trimis. Poți discuta cu noi și prin telefon sau email.",
        "Pentru mesajele primite prin email și răspunsurile noastre prelucrăm expeditorul, destinatarii, subiectul, conținutul, data, identificatorii de livrare și metadatele atașamentelor. Nu trimite CNP, copii ale actelor sau date sensibile care nu sunt necesare solicitării.",
        "Găzduirea și securitatea implică date tehnice precum IP, browser, pagini accesate și momentele accesării. Limitatorul formularului transformă IP-ul într-un identificator pseudonimizat prin HMAC; nu îl păstrează în clar în înregistrarea de limitare. Infrastructura de găzduire poate însă prelucra IP-ul pentru livrarea și protecția serviciului.",
        "Dacă este configurat Cloudflare Turnstile, acesta verifică semnale tehnice despre browser și trafic. Serverul validează tokenul și IP-ul prin Cloudflare; tokenul nu este stocat în cererea de ofertă, iar câmpurile formularului nu sunt transmise prin această verificare.",
      ] },
      { title: "Scopuri și temeiuri juridice", body: [
        "Răspunsul la cerere, pregătirea ofertei și organizarea serviciilor solicitate se bazează pe demersuri precontractuale și executarea contractului (art. 6 alin. (1) lit. b GDPR). Pentru reprezentanții companiilor folosim datele profesionale în interesul legitim de a gestiona relația comercială (lit. f). Bifarea informării din formular nu reprezintă acord pentru publicitate.",
        "Evidențele fiscale și comunicările impuse de autorități se bazează pe obligații legale (lit. c). Protejarea site-ului, prevenirea spamului, controlul accesului Admin și apărarea drepturilor în litigii se bazează pe interesul legitim de securitate și protejare a activității (lit. f), cu respectarea drepturilor persoanelor vizate.",
        "Google Analytics 4 și activarea playerelor YouTube sunt opționale și se bazează pe consimțământul exprimat în setările cookies (lit. a). Refuzul nu împiedică solicitarea unei oferte. Nu înscriem automat solicitanții la newsletter sau campanii publicitare.",
      ] },
      { title: "Destinatarii datelor", body: [
        "Accesul este limitat la persoanele autorizate care gestionează cererile și evenimentele. După caz, datele necesare pot fi comunicate contabilului, consultanților, prestatorilor implicați în eveniment sau autorităților, pentru executarea colaborării ori respectarea legii. Nu vindem date personale.",
        "Vercel găzduiește aplicația, MongoDB Atlas stochează solicitările, mesajele primite și răspunsurile Admin, iar Resend procesează trimiterea și primirea emailurilor pentru contact@fireart.ro. Notificările și mesajele sunt retransmise și către căsuța operațională fireartro@gmail.com, găzduită de Google.",
        "Cloudflare poate furniza Turnstile; Google furnizează Analytics, YouTube și, dacă integrarea este activă, recenzii Google Places. Meta poate furniza recenzii publice Facebook când integrarea este configurată. Rolul furnizorului depinde de serviciu; platformele externe pot prelucra unele date și în scopuri proprii, conform politicilor lor.",
        "Vercel Blob este destinat imaginilor și clipurilor publice. Solicitările și mesajele clienților nu sunt publicate în această bibliotecă.",
      ] },
      { title: "Transferuri internaționale", body: [
        "Furnizorii pot utiliza infrastructură și personal în afara Spațiului Economic European, inclusiv în SUA. O regiune europeană pentru baza de date nu exclude accesul de suport sau procesarea tehnică din alte țări.",
        `În funcție de furnizor și serviciu, transferurile pot avea la bază o decizie de adecvare sau garanții precum clauzele contractuale standard și măsuri suplimentare. Documentația furnizorilor este indicată mai jos. Poți solicita la ${EMAIL} informații despre mecanismul aplicabil datelor tale și o copie a garanțiilor relevante. Consimțământul pentru cookies nu înlocuiește garanțiile necesare transferurilor.`,
      ] },
      { title: "Perioade de păstrare", body: [
        "Pentru cereri și corespondență, perioada se stabilește în funcție de durata discuției, data evenimentului, existența unei colaborări și necesitatea soluționării reclamațiilor sau apărării drepturilor. Datele fără utilitate pentru aceste scopuri trebuie șterse sau anonimizate. Aplicația nu aplică în prezent o ștergere automată cu termen unic pentru toate cererile și emailurile; gestionarea lor necesită intervenția operatorului.",
        "Documentele contractuale și fiscal-contabile se păstrează pe termenele impuse de lege categoriei respective. Într-o dispută, se păstrează numai informațiile necesare până la soluționare și împlinirea termenelor aplicabile. Copiile din email, logurile și backupurile au cicluri distincte; ștergerea din aplicație nu elimină automat toate copiile furnizorilor.",
        "Identificatorii limitatorului cererilor și tentativele de autentificare sunt temporare, în ferestre de aproximativ 10 minute. Sesiunile Admin expiră după 12 ore. Ștergerea înregistrărilor expirate din MongoDB poate avea un decalaj tehnic. Termenul preferințelor cookies este explicat în politica de cookies.",
      ] },
      { title: "Recenzii și imagini publice", body: [
        "Când sunt afișate recenzii Google Maps sau Facebook, sursa este profilul public al autorului. Datele pot include numele public, fotografia, evaluarea, textul, data și linkul sursei. Le folosim pentru informarea despre experiențele clienților, în interesul legitim de prezentare a serviciilor. Selecția nu reprezintă obligatoriu totalitatea recenziilor.",
        "API-urile de recenzii sunt apelate de server, fără transmiterea explicită a IP-ului vizitatorului. Fotografiile autorilor și miniaturile YouTube încărcate direct de la Google creează însă conexiuni ale browserului către acel furnizor, inclusiv înainte de pornirea unui player. Aceste conexiuni nu reprezintă activarea Analytics.",
        `Dacă apari într-un material sau într-o recenzie și ai o solicitare privind datele tale, scrie-ne la ${EMAIL} și indică materialul. Verificăm solicitarea și temeiul publicării. Modificarea recenziei originale se face și prin platforma unde aceasta a fost publicată.`,
      ] },
      { title: "Drepturi și solicitări", body: [
        "În condițiile GDPR ai dreptul la acces, rectificare, ștergere, restricționare și portabilitate. Te poți opune prelucrării bazate pe interes legitim din motive legate de situația ta particulară. Drepturile nu sunt absolute: unele documente trebuie păstrate prin lege.",
        `Trimite solicitarea la ${EMAIL} sau la sediul social. Răspundem de regulă în cel mult o lună; dacă sunt necesare până la două luni suplimentare din cauza complexității ori numărului cererilor, te informăm și motivăm prelungirea în prima lună. Putem solicita informații proporționale pentru verificarea identității, fără colectarea inutilă a actelor.`,
        "Îți poți retrage consimțământul din Setări cookies. Retragerea nu afectează legalitatea operațiunilor anterioare și nu oprește prelucrările cu alt temei legal. Nu luăm decizii exclusiv automatizate, inclusiv profilare, care să producă efecte juridice sau similare semnificative asupra ta.",
        "Poți depune plângere la ANSPDCP, www.dataprotection.ro, B-dul G-ral Gheorghe Magheru nr. 28-30, sector 1, București, ori la autoritatea competentă din statul UE al reședinței, locului de muncă sau presupusei încălcări. Rămân disponibile căile judiciare prevăzute de lege.",
      ] },
      { title: "Actualizări", body: ["Publicăm aici modificările și data actualizării. Pentru scopuri noi incompatibile ori funcții care necesită un acord nou, informăm persoanele vizate și solicităm consimțământul când este necesar."] },
    ],
    sources: [
      { label: "GDPR — ANSPDCP", href: "https://www.dataprotection.ro/?page=noua+_pagina_regulamentul_GDPR" },
      { label: "Depune o plângere la ANSPDCP", href: "https://www.dataprotection.ro/?page=Plangeri_RGPD&lang=ro" },
      { label: "Protecția datelor — Vercel", href: "https://vercel.com/legal/dpa" },
      { label: "Protecția datelor — MongoDB", href: "https://www.mongodb.com/legal/data-processing-agreement" },
      { label: "Protecția datelor — Resend", href: "https://resend.com/legal/dpa" },
      { label: "Confidențialitate Google", href: "https://policies.google.com/privacy?hl=ro" },
      { label: "Confidențialitate Cloudflare", href: "https://www.cloudflare.com/privacypolicy/" },
      { label: "Confidențialitate Meta", href: "https://www.facebook.com/privacy/policy/" },
    ],
  },
  termeni: {
    path: "/termeni-si-conditii", eyebrow: "Condiții de utilizare", title: "Termeni și condiții",
    description: "Informații despre furnizor, solicitarea unei oferte și drepturile clienților FireArtRo.",
    updated: UPDATED,
    sections: [
      { title: "Furnizorul și contactul", body: [
        `Serviciile sub marca FireArtRo sunt furnizate de ${IDENTITY}. EUID: ROONRC.J12/3784/2020.`,
        `Contact: ${EMAIL}, +40 787 602 144. ${BUSINESS_HOURS.label}. Adresa de lucru comunicată pentru Seini: ${SITE_DETAILS.mainOffice}, distinctă de sediul social. Disponibilitatea pentru evenimente se stabilește în funcție de dată și locație.`,
      ] },
      { title: "Rolul site-ului", body: [
        "Site-ul prezintă show-uri de artificii profesionale, show-uri de drone și alte efecte pirotehnice și permite solicitarea unei oferte. Nu este magazin de vânzare directă a articolelor pirotehnice și nu procesează comenzi sau plăți online.",
        "Materialele din pachete și galerie ilustrează posibilitățile serviciilor. Nu garantează reproducerea acelorași efecte, durate sau configurații la orice eveniment. Serviciul concret este cel acceptat în ofertă și contract.",
      ] },
      { title: "Oferte și rezervări", body: [
        "Trimiterea formularului este gratuită, nu rezervă data și nu încheie automat un contract. Confirmarea tehnică a primirii nu este acceptarea unei comenzi. Poți corecta datele înainte de trimitere sau ne poți contacta dacă observi ulterior o eroare.",
        "Verificăm disponibilitatea, locația și cerințele tehnice înainte de oferta finală. Oferta precizează serviciile, valabilitatea și condițiile rezervării. Rezervarea devine fermă după îndeplinirea condițiilor acceptate de părți, inclusiv avansul numai dacă acesta a fost prevăzut.",
        "Înaintea asumării unei obligații de plată comunicăm informațiile și condițiile proiectului. Pentru contractele la distanță, confirmarea și documentele relevante sunt transmise pe suport durabil, de exemplu prin email. Limba uzuală este româna; o altă limbă poate fi convenită.",
      ] },
      { title: "Preț, taxe și plată", body: [
        "Oferta se calculează în funcție de locație, durată, timpul rămas până la eveniment, tipul spectacolului, efecte și echipamente, preferințe, cerințe de siguranță, transport, personal și logistică. Nu există un preț unic pentru toate evenimentele.",
        "Oferta către consumatori precizează prețul total, moneda, taxele aplicabile, inclusiv TVA dacă este datorată, și costurile suplimentare cunoscute. Dacă un cost nu poate fi calculat rezonabil în avans, se comunică metoda de calcul. Serviciile și costurile opționale necesită acordul clientului.",
        "Avansul, soldul, scadențele, modalitatea de plată și facturarea sunt stabilite în documentele individuale înainte de contractare. Nu solicităm date de card prin formularul de contact.",
      ] },
      { title: "Siguranță și condiții de prestare", body: [
        "Prestarea este condiționată de cerințele de siguranță, acces, distanțe, restricții ale locației, condiții de zbor și avizele sau autorizațiile aplicabile. Responsabilitățile pentru documente, acces și relația cu organizatorul sau proprietarul locației se clarifică înainte de contractare.",
        "Vântul, precipitațiile, restricțiile autorităților sau de spațiu aerian pot impune adaptarea, amânarea ori anularea unei componente. Comunicăm opțiunile și efectele financiare conform contractului și legii; o mențiune generală despre vreme nu înlătură automat drepturile clientului.",
      ] },
      { title: "Reprogramare, anulare și restituiri", body: [
        `Solicită modificarea sau anularea în scris la ${EMAIL}, indicând contractul și evenimentul. Data alternativă trebuie verificată și acceptată de ambele părți.`,
        "Condițiile de anulare, eventualele costuri justificate, tratamentul avansului și termenele de restituire sunt comunicate înainte de contractare. Nu declarăm toate avansurile nerambursabile. Condițiile individuale trebuie să respecte drepturile obligatorii și interdicția clauzelor abuzive.",
      ] },
      { title: "Dreptul legal de retragere", body: [
        "Pentru contractele de servicii la distanță sau în afara spațiilor comerciale, când se aplică OUG nr. 34/2014 și nu există o excepție legală, consumatorul are în mod obișnuit 14 zile de la încheiere pentru retragere, fără motiv. Termenele speciale prevăzute de lege rămân aplicabile. O simplă solicitare de ofertă nu încheie un contract și nu necesită retragerea din el.",
        "Art. 16 lit. l din OUG nr. 34/2014 prevede o excepție pentru anumite servicii privind activități de agrement la o dată sau perioadă precisă. Aplicabilitatea la serviciul concret și absența dreptului, dacă este cazul, trebuie comunicate înainte de contractare; nu extindem automat excepția la orice serviciu doar pentru că este personalizat.",
        `Când dreptul se aplică, transmite înainte de expirarea termenului o declarație neechivocă la ${EMAIL} sau la sediul social, cu numele și identificarea contractului. Poți folosi formularul-model comunicat cu documentele contractuale, dar nu este obligatoriu. Sumele datorate se restituie în termenul legal, în mod obișnuit în cel mult 14 zile de la informare.`,
        "Începerea prestării în perioada de retragere necesită cererea expresă prevăzută de lege. La retragere poate fi datorată partea proporțională deja prestată, în condițiile legii. Pierderea dreptului după executarea integrală necesită informarea și acordurile legale distincte; acești termeni nu le înlocuiesc.",
      ] },
      { title: "Materiale și recenzii", body: [
        "Textele, identitatea vizuală, fotografiile și clipurile sunt protejate prin drepturile titularilor. Reutilizarea comercială fără acord nu este permisă, cu excepțiile prevăzute de lege. Nu transmite informații false, nu accesa neautorizat Admin și nu perturba funcționarea site-ului.",
        "Recenziile externe sunt însoțite de sursă și, când sunt disponibile, de autor și link. Selecția nu reprezintă obligatoriu toate recenziile. Nu afirmăm că fiecare autor a cumpărat serviciile dacă acest lucru nu a fost verificat; autenticitatea este supusă și regulilor platformei sursă.",
      ] },
      { title: "Răspundere și drepturi obligatorii", body: [
        "Pot apărea indisponibilități sau erori tehnice. Corectăm informațiile inexacte după identificare și clarificăm oferta înainte de acceptare. Actualizarea site-ului nu modifică retroactiv contractele încheiate.",
        "Acești termeni nu exclud răspunderea care nu poate fi limitată prin lege, nu înlătură drepturile legale privind serviciile și nu restrâng dreptul la reclamație ori accesul la justiție.",
      ] },
      { title: "Reclamații, ANPC și SAL", body: [
        `Poți trimite reclamații la ${EMAIL}, descriind situația și documentele relevante. Încercăm soluționarea amiabilă fără a condiționa exercitarea drepturilor legale de această etapă.`,
        "Consumatorii pot sesiza ANPC prin eservicii.anpc.ro și pot consulta procedura de soluționare alternativă a litigiilor (SAL) la reclamatiisal.anpc.ro. Accesul la SAL se face în condițiile procedurii competente și nu împiedică accesul la instanță.",
        "Se aplică legislația română, fără înlăturarea protecției obligatorii recunoscute consumatorului de normele aplicabile. Competența instanțelor se determină potrivit legii, inclusiv regulilor speciale pentru consumatori; nu impunem exclusiv instanța de la sediul nostru.",
      ] },
    ],
    sources: [
      { label: "Formular reclamație ANPC", href: "https://eservicii.anpc.ro/" },
      { label: "Soluționare alternativă a litigiilor — SAL", href: "https://reclamatiisal.anpc.ro/" },
    ],
  },
  cookies: {
    path: "/cookies", eyebrow: "Preferințe și stocare locală", title: "Politica de cookies",
    description: "Ce păstrează site-ul în browser, serviciile externe folosite și controlul preferințelor.",
    updated: UPDATED,
    sections: [
      { title: "Operatorul și alegerile tale", body: [
        `Site-ul este administrat de ${IDENTITY}. Contact: ${EMAIL}.`,
        "Folosim cookie-uri, localStorage pentru preferințe și sessionStorage pentru date temporare. Tehnologiile strict necesare susțin funcționarea cerută; analiza și conținutul extern sunt opționale și dezactivate implicit. Refuzul lor nu blochează solicitarea unei oferte.",
      ] },
      { title: "Stocare strict necesară", body: [
        "fireartro-cookie-consent-v1 (localStorage, domeniul site-ului): categoriile acceptate, data salvării și expirarea. Termenul configurat este de 180 de zile. După expirare, alegerea nu mai autorizează funcțiile opționale. localStorage nu se șterge singur la termen; înregistrarea poate rămâne până la înlocuire sau ștergerea datelor browserului.",
        "fireartro-contact-prefill (sessionStorage): serviciul sau pachetul selectat pentru precompletare. Se elimină după citirea reușită sau încheierea sesiunii tabului. Nu este folosit pentru urmărire.",
        "fireartro_admin_session (cookie pentru /api/admin): sesiunea administratorului, maximum 12 ore, Secure, HttpOnly, SameSite=Strict. Creat numai la autentificare și eliminat la deconectare; nu este un cookie de analiză sau publicitate.",
        "fireartro-managed-content-v1 (localStorage): poate exista ca urmă a vechiului CMS local, fără expirare automată. Codul actual nu îl creează pentru vizitatori; doar instrumentul autentificat de migrare îl poate citi. Poate fi eliminat din Admin sau din browser.",
      ] },
      { title: "Google Analytics 4 — analiză opțională", body: [
        "Categoria Analiză este dezactivată implicit. Google Analytics 4 se încarcă numai după acceptul explicit, cu un ID valid și pe domeniul public de producție, nu în Admin sau Preview. Funcțiile de publicitate și personalizare rămân dezactivate în această integrare.",
        "După acord se pot transmite calea paginii, titlul și semnale tehnice ale browserului. Evenimentele explicite ale aplicației elimină parametrii și fragmentul URL și nu includ câmpurile formularului. Cookie-urile _ga și _ga_ID (unde ID identifică integrarea) pot păstra identificatori de analiză; durata depinde de configurația Google, în mod implicit până la 2 ani, cu posibilitatea reînnoirii la interacțiune. Refuzul sau expirarea acordului site-ului are prioritate pentru activarea măsurării.",
        "Retragerea din Setări cookies oprește măsurarea viitoare. Poți elimina și datele deja stocate prin setările browserului. Retragerea nu șterge retroactiv informațiile deja primite de Google; pentru datele personale poți exercita drepturile din politica de confidențialitate.",
      ] },
      { title: "YouTube, miniaturi și recenzii", body: [
        "Playerul YouTube necesită atât categoria Conținut extern și marketing, cât și apăsarea butonului de redare. Folosim youtube-nocookie.com, ceea ce nu înseamnă absența oricărei prelucrări. Refuzul păstrează playerul blocat; retragerea acordului îl închide.",
        "Miniaturile pot fi încărcate de la img.youtube.com, iar fotografiile autorilor recenziilor de la Google, înainte de pornirea playerului și fără activarea Analytics. Aceste imagini creează conexiuni către furnizor și expun informațiile tehnice necesare livrării. Stocarea folosită ulterior de platformele externe este descrisă în politicile lor.",
        "Categoria Conținut extern și marketing nu activează în prezent un pixel publicitar. Integrarea oricărui nou instrument trebuie documentată și condiționată de acordul necesar înainte de activare.",
      ] },
      { title: "Protecție anti-abuz", body: [
        "Când este configurat, Cloudflare Turnstile se poate încărca odată cu formularul, independent de opțiunile de analiză și marketing, pentru prevenirea spamului și atacurilor. Nu îl folosim pentru publicitate. Prelucrarea și stocarea furnizorului sunt descrise în documentația sa oficială.",
      ] },
      { title: "Modificarea sau retragerea alegerii", body: [
        "Deschide Setări cookies din subsolul paginii. Poți alege Doar necesare, toate opțiunile sau o selecție. Refuzul nu afectează accesul la informațiile firmei și formularul de ofertă.",
        "Poți șterge cookie-urile și datele locale din browser; poate fi necesară o nouă autentificare Admin, iar bannerul va reapărea. Preferințele sunt specifice browserului și dispozitivului. Ștergerea locală nu elimină automat datele deja transmise furnizorilor.",
      ] },
      { title: "Actualizări", body: ["Inventarul este revizuit când se modifică funcțiile site-ului. Pentru destinatari, transferuri și drepturi consultă și politica de confidențialitate. Data versiunii este afișată la începutul paginii."] },
    ],
    sources: [
      { label: "Confidențialitate FireArtRo", href: "/confidentialitate" },
      { label: "Cookies Google", href: "https://policies.google.com/technologies/cookies?hl=ro" },
      { label: "Cookies Google Analytics", href: "https://support.google.com/analytics/answer/11397207?hl=ro" },
      { label: "Confidențialitate Cloudflare", href: "https://www.cloudflare.com/privacypolicy/" },
    ],
  },
};

export const LEGAL_PAGES_DEFAULT = Object.fromEntries(
  [["privacy", "confidentialitate"], ["terms", "termeni"], ["cookies", "cookies"]].map(([key, route]) => {
    const page = LEGAL_PAGE_PRESENTATION[route];
    return [key, {
      title: page.title, updatedLabel: `Actualizat la ${page.updated}`,
      sections: page.sections.map((section, index) => ({
        id: `${key}-section-${index + 1}`, heading: section.title, paragraphs: section.body,
      })),
    }];
  }),
);

import { SITE_DETAILS } from "./businessContent";

const EMAIL = SITE_DETAILS.email;

// Exact approved legal wording. Route-only presentation stays outside SiteContent.
export const LEGAL_PAGE_PRESENTATION = {
  confidentialitate: {
    path: "/confidentialitate",
    eyebrow: "Protecția datelor",
    title: "Politica de confidențialitate",
    description:
      "Cum colectează, folosește și protejează FireArtRo datele transmise prin site.",
    updated: "7 septembrie 2026",
    sections: [
      {
        title: "Operatorul datelor",
        body: [
          `Site-ul FireArtRo este operat de ${SITE_DETAILS.legalName}, CUI ${SITE_DETAILS.taxId}, înregistrată la Registrul Comerțului sub nr. ${SITE_DETAILS.registrationNumber}, cu sediul social în ${SITE_DETAILS.registeredOffice}.`,
          `Activitatea este coordonată din sediul principal din ${SITE_DETAILS.mainOffice}. Pentru solicitări privind datele personale ne poți scrie la ${EMAIL}.`,
        ],
      },
      {
        title: "Datele pe care le colectăm",
        body: [
          "Prin formularul de ofertă putem colecta numele, prenumele, telefonul, emailul, localitatea, locația și data evenimentului, tipul evenimentului, serviciile selectate, pachetul preferat și mesajul transmis.",
          "Colectăm numai informațiile necesare pentru a analiza solicitarea și a continua discuția comercială.",
          "Pentru protecția formularului împotriva folosirii abuzive, mecanismul de limitare generează din adresa IP un identificator pseudonimizat prin HMAC. Mecanismul nu păstrează IP-ul în clar; identificatorul și numărul de trimiteri sunt stocate temporar în MongoDB, într-o fereastră de 10 minute, apoi expiră automat.",
          "Dacă protecția Cloudflare Turnstile este activată, widgetul prelucrează semnale tehnice despre browser și vizitator, inclusiv adresa IP, strict pentru diferențierea utilizării legitime de traficul automat. Tokenul rezultat este verificat de server și nu este păstrat împreună cu solicitarea; Cloudflare nu primește prin această integrare câmpurile completate în formular.",
        ],
      },
      {
        title: "Scopul și temeiul prelucrării",
        body: [
          "Folosim datele pentru a răspunde solicitărilor, a pregăti o ofertă, a planifica serviciile cerute și a păstra evidențele necesare colaborării.",
          "Prelucrarea se bazează pe demersurile făcute la cererea ta înaintea încheierii unui contract, pe executarea contractului, pe obligații legale sau pe consimțământ, după caz.",
        ],
      },
      {
        title: "Păstrare și destinatari",
        body: [
          "Datele sunt păstrate numai cât este necesar pentru scopul comunicat și pentru obligațiile legale aplicabile. Nu vindem date personale.",
          "Solicitările de ofertă, mesajele primite la adresa de contact și răspunsurile trimise din Admin pot fi stocate în baza de date a aplicației. Vercel găzduiește aplicația, MongoDB Atlas furnizează baza de date, iar Resend procesează trimiterea și primirea emailurilor pentru contact@fireart.ro.",
          "Cloudflare poate furniza verificarea anti-abuz a formularului atunci când aceasta este activată. Google poate furniza măsurarea Google Analytics 4 numai după consimțământul explicit pentru categoria Analiză și numai pe domeniul public de producție.",
          "Biblioteca Vercel Blob este destinată materialelor publice ale site-ului, precum imagini și clipuri. Documentele clienților și atașamentele mesajelor nu sunt publicate în această bibliotecă.",
          "Accesul este limitat la operatorii autorizați și la furnizorii tehnici strict necesari operării site-ului și comunicării, conform rolului lor.",
        ],
      },
      {
        title: "Drepturile tale",
        body: [
          "Poți solicita accesul, rectificarea, ștergerea, restricționarea sau portabilitatea datelor și te poți opune anumitor prelucrări. Îți poți retrage consimțământul atunci când acesta este temeiul utilizat.",
          "Ai și dreptul de a depune o plângere la Autoritatea Națională de Supraveghere a Prelucrării Datelor cu Caracter Personal.",
        ],
      },
      {
        title: "Revizuirea documentului",
        body: [
          "Acest document descrie fluxurile tehnice configurate la data actualizării. Retenția finală, temeiurile aplicabile fiecărei colaborări și textul juridic trebuie validate periodic de operator și, înaintea acceptării finale, de un specialist juridic.",
        ],
      },
    ],
    sources: [
      {
        label: "Informații oficiale ANSPDCP despre GDPR",
        href: "https://www.dataprotection.ro/?page=noua+_pagina_regulamentul_GDPR",
      },
      {
        label: "Cum depui o plângere la ANSPDCP",
        href: "https://www.dataprotection.ro/?page=Plangeri_RGPD&lang=ro",
      },
    ],
  },
  termeni: {
    path: "/termeni-si-conditii",
    eyebrow: "Condiții de utilizare",
    title: "Termeni și condiții",
    description:
      "Regulile generale pentru utilizarea site-ului și solicitarea serviciilor FireArtRo.",
    updated: "7 septembrie 2026",
    sections: [
      {
        title: "Furnizorul serviciilor",
        body: [
          `Serviciile prezentate sub marca FireArtRo sunt furnizate de ${SITE_DETAILS.legalName}, CUI ${SITE_DETAILS.taxId}, nr. Registrul Comerțului ${SITE_DETAILS.registrationNumber}. Sediul social este în ${SITE_DETAILS.registeredOffice}, iar sediul principal de lucru este în ${SITE_DETAILS.mainOffice}.`,
        ],
      },
      {
        title: "Rolul site-ului",
        body: [
          "Site-ul prezintă serviciile FireArtRo și permite trimiterea unei solicitări de ofertă. Informațiile au caracter general și pot fi actualizate pe măsură ce serviciile evoluează.",
        ],
      },
      {
        title: "Oferte și rezervări",
        body: [
          "Trimiterea formularului nu reprezintă o rezervare și nu creează automat o obligație contractuală. Oferta finală este stabilită după verificarea locației, datei, cerințelor tehnice și condițiilor de siguranță.",
          "O rezervare devine fermă numai după acceptarea condițiilor comerciale și tehnice comunicate de FireArtRo.",
        ],
      },
      {
        title: "Siguranță, avize și condiții meteo",
        body: [
          "Spectacolele se realizează numai dacă pot fi respectate normele de siguranță, restricțiile locației și autorizările aplicabile.",
          "Vântul, precipitațiile, restricțiile de spațiu aerian sau alte situații independente pot impune adaptarea, amânarea ori anularea unei componente a spectacolului.",
        ],
      },
      {
        title: "Proprietate intelectuală",
        body: [
          "Textele, identitatea vizuală, conceptele, fotografiile și materialele video publicate pe site sunt protejate. Reutilizarea lor comercială fără acord scris nu este permisă.",
        ],
      },
      {
        title: "Limitarea răspunderii",
        body: [
          "FireArtRo urmărește menținerea informațiilor corecte și a site-ului disponibil, dar nu poate garanta funcționarea neîntreruptă sau lipsa completă a erorilor tehnice.",
          "Condițiile specifice fiecărui proiect sunt cele prevăzute în oferta și documentele acceptate de părți.",
        ],
      },
      {
        title: "Soluționarea litigiilor",
        body: [
          `Dacă ai o nemulțumire legată de serviciile FireArtRo, te încurajăm să ne scrii mai întâi direct la ${EMAIL}, ca să găsim împreună o soluție pe cale amiabilă.`,
          "Te poți adresa și Autorității Naționale pentru Protecția Consumatorilor (ANPC) — telefon 021 9551 sau formularul de pe eservicii.anpc.ro — ori sistemului național de soluționare alternativă a litigiilor (SAL), disponibil la reclamatiisal.anpc.ro.",
        ],
      },
      {
        title: "Legea aplicabilă",
        body: [
          "Acești termeni sunt guvernați de legislația română. Orice litigiu care nu poate fi soluționat pe cale amiabilă sau prin procedurile de mai sus este de competența instanțelor române.",
        ],
      },
      {
        title: "Revizuirea documentului",
        body: [
          "Acești termeni descriu utilizarea tehnică și comercială generală a site-ului la data actualizării. Condițiile contractuale concrete și textul juridic final trebuie validate de operator și de un specialist juridic înaintea acceptării definitive.",
        ],
      },
    ],
    sources: [
      {
        label: "Sesizare SAL (ANPC)",
        href: "https://reclamatiisal.anpc.ro/",
      },
      {
        label: "Formular reclamație ANPC",
        href: "https://eservicii.anpc.ro/",
      },
    ],
  },
  cookies: {
    path: "/cookies",
    eyebrow: "Preferințe și stocare locală",
    title: "Politica de cookies",
    description:
      "Ce tehnologii de stocare poate utiliza site-ul FireArtRo și cum le poți controla.",
    updated: "7 septembrie 2026",
    sections: [
      {
        title: "Ce stocăm în browser",
        body: [
          "Site-ul poate folosi cookie-uri și localStorage, adică mecanisme prin care browserul păstrează preferințe tehnice. FireArtRo folosește aceste mecanisme numai pentru funcții explicate în această politică.",
          "Alegerea făcută în bannerul de consimțământ este salvată local timp de maximum 180 de zile, după care site-ul solicită din nou preferințele.",
        ],
      },
      {
        title: "Cookie-uri strict necesare",
        body: [
          "Categoria strict necesară păstrează alegerea de consimțământ și susține funcțiile esențiale ale interfeței. Nu poate fi dezactivată din banner deoarece fără ea preferința ar trebui solicitată la fiecare vizită.",
          "Aceste date nu sunt folosite pentru publicitate comportamentală și nu creează un profil comercial al vizitatorului.",
        ],
      },
      {
        title: "Analiză opțională",
        body: [
          "Categoria Analiză este dezactivată implicit. Integrarea pregătită pentru Google Analytics 4 se poate activa numai după acceptul explicit al vizitatorului: nu încarcă scriptul Google și nu transmite date înainte de această alegere, iar fără un identificator de măsurare configurat nu pornește deloc.",
          "După acceptare, măsurarea poate transmite către Google calea paginii fără parametrii din adresă, titlul paginii și date tehnice generate de browser. Nu este activată în Admin sau în mediile Preview, nu trimitem deliberat câmpurile formularului ori alți identificatori personali și păstrăm funcțiile de publicitate și personalizare dezactivate.",
          "Când Google Analytics 4 este activ, poate crea identificatori de analiză în cookie-uri precum _ga. Dacă alegerea este retrasă din Setări cookies, site-ul oprește evenimentele viitoare de măsurare.",
        ],
      },
      {
        title: "YouTube și conținut extern",
        body: [
          "Galeria afișează inițial doar posterul videoclipului. Playerul YouTube nu este încărcat la deschiderea paginii, ci numai după ce utilizatorul apasă pe un material video.",
          "După pornirea playerului, YouTube poate prelucra date tehnice conform propriei politici. Folosim domeniul youtube-nocookie.com pentru o integrare cu expunere redusă înainte de interacțiune.",
        ],
      },
      {
        title: "Marketing și servicii viitoare",
        body: [
          "Categoria Conținut extern și marketing este dezactivată implicit. Orice pixel, instrument publicitar sau integrare nouă trebuie documentată aici și condiționată de consimțământ înainte de activare.",
          "FireArtRo nu activează automat publicitate personalizată doar pentru că vizitatorul deschide site-ul.",
        ],
      },
      {
        title: "Cum modifici sau retragi alegerea",
        body: [
          "Poți redeschide oricând panoul din linkul Setări cookies aflat în footer și poți alege Doar necesare sau alte preferințe.",
          "Poți șterge și datele site-ului direct din setările browserului. La următoarea vizită, bannerul va fi afișat din nou.",
        ],
      },
      {
        title: "Lista actuală a stocării locale",
        body: [
          "fireartro-cookie-consent-v1: păstrează categoriile acceptate, data salvării și data expirării.",
          "fireartro-contact-prefill: folosește temporar sessionStorage pentru a transfera către pagina Contact pachetul sau serviciul ales; valoarea este eliminată după citire ori la închiderea sesiunii browserului.",
          "fireartro-managed-content-v1: poate exista numai ca urmă a vechii administrări locale și este citită exclusiv de instrumentul autentificat de migrare din Admin; nu controlează conținutul public și nu este folosită pentru urmărire.",
          "_ga și _ga_ID: pot fi create de Google Analytics 4 numai după acceptarea categoriei Analiză și numai dacă integrarea este configurată.",
          "Sesiunea de autentificare Admin folosește un cookie strict necesar, securizat și inaccesibil JavaScriptului. Acesta nu este creat pentru vizitatorii site-ului public.",
        ],
      },
      {
        title: "Revizuirea documentului",
        body: [
          "Lista trebuie revizuită înainte de activarea oricărui furnizor nou de analiză, marketing sau protecție anti-abuz și validată juridic înaintea acceptării finale.",
        ],
      },
    ],
  },
};


export const LEGAL_PAGES_DEFAULT = Object.fromEntries(
  [["privacy", "confidentialitate"], ["terms", "termeni"], ["cookies", "cookies"]].map(([key, route]) => {
    const page = LEGAL_PAGE_PRESENTATION[route];
    return [key, {
      title: page.title,
      updatedLabel: `Actualizat la ${page.updated}`,
      sections: page.sections.map((section, index) => ({
        id: `${key}-section-${index + 1}`,
        heading: section.title,
        paragraphs: section.body,
      })),
    }];
  }),
);

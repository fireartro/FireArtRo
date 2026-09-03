import {
  Plane,
  Flame,
  Sparkles,
  Zap,
  Wand2,
  ShieldCheck,
  HeartHandshake,
  Gauge,
  Layers,
  Settings2,
  Radio,
  MapPin,
  MessagesSquare,
  ClipboardList,
  Palette,
  Wrench,
  Rocket,
  Crown,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Cinematic media                                                    */
/* ------------------------------------------------------------------ */
export const HERO_POSTER = "/media/fireart-hero-wide.webp?v=20260902-safe-title";

export const HERO_MEDIA = {
  variants: {
    wide: {
      src: "/media/fireart-hero-wide.mp4?v=20260902-safe-title",
      poster: "/media/fireart-hero-wide.webp?v=20260902-safe-title",
      width: 1920,
      height: 1200,
    },
    ultrawide: {
      src: "/media/fireart-hero-ultrawide.mp4?v=20260902-safe-title",
      poster: "/media/fireart-hero-ultrawide.webp?v=20260902-safe-title",
      width: 1920,
      height: 900,
    },
    "tablet-landscape": {
      src: "/media/fireart-hero-tablet-landscape.mp4?v=20260902-safe-title",
      poster: "/media/fireart-hero-tablet-landscape.webp?v=20260902-safe-title",
      width: 1440,
      height: 1080,
    },
    "tablet-portrait": {
      src: "/media/fireart-hero-tablet-portrait.mp4?v=20260902-safe-title",
      poster: "/media/fireart-hero-tablet-portrait.webp?v=20260902-safe-title",
      width: 1080,
      height: 1440,
    },
    mobile: {
      src: "/media/fireart-hero-mobile.mp4?v=20260902-safe-title",
      poster: "/media/fireart-hero-mobile.webp?v=20260902-safe-title",
      width: 900,
      height: 1600,
    },
    "mobile-tall": {
      src: "/media/fireart-hero-mobile-tall.mp4?v=20260902-safe-title",
      poster: "/media/fireart-hero-mobile-tall.webp?v=20260902-safe-title",
      width: 900,
      height: 1950,
    },
  },
  label: "Spectacol cinematic FireArtRo cu drone, artificii și formații luminoase",
  position: "50% 50%",
};

// Curated cinematic stills (drone light shows · fireworks · cold sparks)
export const MEDIA = {
  fireworksSky: "/media/fireworks-sky.webp",
  droneShow: "/media/drone-show.webp",
  droneShow2: "/media/drone-show-2.webp",
  droneShow3: "/media/drone-show-3.webp",
  coldSparks: "/media/cold-sparks.webp",
  coldSparks2: "/media/cold-sparks-2.webp",
  coldSparks3: "/media/cold-sparks-3.webp",
  crowd: "/media/crowd.webp",
  crowd2: "/media/crowd-2.webp",
  crowd3: "/media/crowd-3.webp",
  wedding: "/media/wedding.webp",
  corporate: "/media/corporate.webp",
  hybrid: "/media/hybrid.webp",
};

export const IMG = {
  hero: MEDIA.fireworksSky,
  drone: MEDIA.droneShow,
  fireworks: MEDIA.fireworksSky,
  hybrid: MEDIA.hybrid,
  sparks: MEDIA.coldSparks,
};

/* ------------------------------------------------------------------ */
/*  Brand story / intro                                                */
/* ------------------------------------------------------------------ */
export const INTRO_BULLETS = [
  "Concept vizual unic, creat pentru povestea ta",
  "Drone, artificii și efecte sincronizate pe muzică",
  "Execuție sigură, autorizată și milimetrică",
];

/* ------------------------------------------------------------------ */
/*  Stats                                                              */
/* ------------------------------------------------------------------ */
export const STATS = [
  { value: 150, suffix: "+", label: "Spectacole regizate" },
  { value: 320, suffix: "+", label: "Drone sincronizate" },
  { value: 90, suffix: "+", label: "Evenimente & festivaluri" },
  { value: 24, suffix: "h", label: "Răspuns la cerere" },
];

/* ------------------------------------------------------------------ */
/*  Services                                                           */
/* ------------------------------------------------------------------ */
export const SERVICES = [
  {
    icon: Plane,
    title: "Spectacole cu drone",
    desc: "Coregrafii luminoase, forme și mesaje create pentru cerul evenimentului.",
    ideal: "Nunți · Corporate · Festivaluri · Lansări",
    benefits: ["Animații 3D personalizate", "Logo & mesaje în aer", "Zero zgomot, zero fum"],
    image: MEDIA.droneShow,
  },
  {
    icon: Flame,
    title: "Artificii profesionale",
    desc: "Spectacol pirotehnic regizat pe muzică pentru momentul central al serii.",
    ideal: "Nunți · Aniversări · Sărbători",
    benefits: ["Sincronizare pe muzică", "Efecte de mare înălțime", "Echipă autorizată"],
    image: MEDIA.fireworksSky,
  },
  {
    icon: Sparkles,
    title: "Drone + artificii sincronizate",
    desc: "Drone și artificii construite ca un singur final vizual.",
    ideal: "Evenimente premium · Festivaluri",
    benefits: ["Show hibrid premium", "Impact vizual maxim", "Regie tehnică completă"],
    image: MEDIA.hybrid,
  },
  {
    icon: Zap,
    title: "Cold sparks & efecte speciale",
    desc: "Scântei reci și efecte de scenă pentru intrări, dans și momente-cheie.",
    ideal: "Primul dans · Intrări · Scenă",
    benefits: ["Scântei reci, sigure", "Fum greu & lasere", "Montaj indoor & outdoor"],
    image: MEDIA.coldSparks,
  },
];

/* ------------------------------------------------------------------ */
/*  Showcase (Spectacole)                                              */
/* ------------------------------------------------------------------ */
export const PORTFOLIO = [
  { category: "Nunți", title: "Nuntă pe malul lacului", desc: "Drone show romantic și artificii pentru finalul serii.", image: MEDIA.wedding },
  { category: "Corporate", title: "Gală corporativă", desc: "Logo în aer și efecte sincronizate pentru un brand memorabil.", image: MEDIA.corporate },
  { category: "Festivaluri", title: "Festival de vară", desc: "Show de mare amploare, coordonat pentru mii de spectatori.", image: MEDIA.crowd },
  { category: "Lansări", title: "Lansare de produs", desc: "Moment de impact care pune produsul în lumina reflectoarelor.", image: MEDIA.fireworksSky },
  { category: "Evenimente private", title: "Aniversare privată", desc: "Cold sparks și artificii pentru un moment intim și spectaculos.", image: MEDIA.coldSparks2 },
  { category: "City events", title: "Eveniment de oraș", desc: "Spectacol public sincronizat, cu logistică și avize complete.", image: MEDIA.crowd2 },
];

export const SHOWCASE_CATEGORIES = ["Nunți", "Corporate", "Festivaluri", "Lansări", "Evenimente private", "City events"];

/* ------------------------------------------------------------------ */
/*  Storytelling — cinematic 8-scene journey                           */
/* ------------------------------------------------------------------ */
export const STORY = [
  { no: "01", kicker: "Momentul", title: "Noaptea așteaptă", text: "Luminile scad. Privirile se ridică.", image: MEDIA.crowd2, glow: "#3A86FF" },
  { no: "02", kicker: "Viziunea", title: "Ideea capătă formă", text: "Povestea evenimentului devine un concept vizual.", image: MEDIA.droneShow2, glow: "#5AA9FF" },
  { no: "03", kicker: "Design & tehnologie", title: "Ritmul devine lumină", text: "Muzica, spațiul și sistemele urmează aceeași coregrafie.", image: MEDIA.hybrid, glow: "#176BFF" },
  { no: "04", kicker: "Build-up", title: "Energia începe să urce", text: "Totul este verificat. Numărătoarea inversă începe.", image: MEDIA.coldSparks3, glow: "#8F6BFF" },
  { no: "05", kicker: "Spectacolul", title: "Cerul se deschide", text: "Lumină, ritm și profunzime într-un singur vârf vizual.", image: MEDIA.fireworksSky, glow: "#176BFF" },
  { no: "06", kicker: "Amintirea", title: "Lumina pleacă. Emoția rămâne.", text: "Reacția publicului devine partea care continuă povestea.", image: MEDIA.crowd, glow: "#5AA9FF" },
];

/* ------------------------------------------------------------------ */
/*  Storytelling chapters (legacy short version, kept for reference)   */
/* ------------------------------------------------------------------ */
export const CHAPTERS = [
  {
    no: "01",
    kicker: "Conceptul",
    title: "Totul începe cu o viziune",
    text: "Ascultăm povestea evenimentului tău și transformăm emoția într-un concept vizual unic, gândit pentru momentul și locația ta.",
    image: MEDIA.droneShow,
  },
  {
    no: "02",
    kicker: "Spectacolul",
    title: "Cerul prinde viață",
    text: "Drone, artificii și efecte speciale se sincronizează pe muzică într-o coregrafie care taie respirația invitaților.",
    image: MEDIA.fireworksSky,
  },
  {
    no: "03",
    kicker: "Emoția",
    title: "Un final pe care nu-l uită nimeni",
    text: "Ultima scânteie se stinge, dar amintirea rămâne — un moment despre care invitații vor vorbi mult timp după eveniment.",
    image: MEDIA.crowd,
  },
];

/* ------------------------------------------------------------------ */
/*  Why FireArtRo                                                      */
/* ------------------------------------------------------------------ */
export const WHY = [
  { icon: Wand2, title: "Design 100% personalizat", desc: "Fiecare spectacol este creat de la zero, în jurul poveștii evenimentului tău." },
  { icon: ShieldCheck, title: "Siguranță & autorizații", desc: "Echipă autorizată, planificare tehnică riguroasă și respectarea tuturor normelor." },
  { icon: Sparkles, title: "Impact vizual regizat", desc: "Momente construite pentru ritmul evenimentului și reacția publicului." },
  { icon: HeartHandshake, title: "Consultanță dedicată", desc: "Te ghidăm pas cu pas, din prima idee până la ultimul detaliu." },
  { icon: Gauge, title: "Execuție profesionistă", desc: "Tehnică de top, operatori cu experiență și o regie milimetrică." },
  { icon: Layers, title: "Show-uri combinate", desc: "Drone, artificii și efecte speciale, într-un singur spectacol coerent." },
];

/* ------------------------------------------------------------------ */
/*  Technology & trust                                                 */
/* ------------------------------------------------------------------ */
export const TECH = [
  { icon: Settings2, title: "Planificare tehnică", desc: "Analizăm locația, vântul, spațiul aerian și logistica pentru un show fără surprize." },
  { icon: Radio, title: "Sincronizare vizuală", desc: "Coregrafie sincronizată pe muzică — drone, artificii și efecte, exact pe beat." },
  { icon: ShieldCheck, title: "Siguranță & autorizații", desc: "Echipă autorizată, protocoale de siguranță și toate avizele necesare." },
  { icon: Sparkles, title: "Drone + artificii", desc: "Combinăm tehnologia dronelor cu artificiile clasice pentru impact maxim." },
  { icon: MapPin, title: "Efecte adaptate locației", desc: "Indoor sau outdoor, adaptăm efectele la spațiul și atmosfera evenimentului." },
  { icon: MessagesSquare, title: "Consultanță completă", desc: "Te ghidăm de la prima idee până la ultimul efect, pas cu pas." },
];

/* ------------------------------------------------------------------ */
/*  Process                                                            */
/* ------------------------------------------------------------------ */
export const PROCESS = [
  { step: "01", title: "Brief", desc: "Discutăm viziunea, locația și momentul cheie al evenimentului.", icon: ClipboardList },
  { step: "02", title: "Concept vizual", desc: "Creăm conceptul show-ului: coregrafie, culori și sincronizare pe muzică.", icon: Palette },
  { step: "03", title: "Planificare tehnică", desc: "Verificăm locația, obținem autorizațiile și pregătim echipamentul.", icon: Settings2 },
  { step: "04", title: "Pregătire & sincronizare", desc: "Montaj, testare și verificări de siguranță înainte de start.", icon: Wrench },
  { step: "05", title: "Spectacol", desc: "Rulăm show-ul live, coordonat atent pentru momentul central al evenimentului.", icon: Rocket },
];

/* ------------------------------------------------------------------ */
/*  Packages                                                           */
/* ------------------------------------------------------------------ */
export const PROCESS_ENHANCED = [
  {
    step: "01",
    title: "Brief eveniment",
    desc: "Stabilim tipul evenimentului, locația, publicul și momentul cheie pentru drone show, artificii sau efecte speciale.",
    result: "Direcție clară pentru ofertă",
    keywords: ["locație", "public", "moment"],
    icon: ClipboardList,
  },
  {
    step: "02",
    title: "Concept vizual",
    desc: "Transformăm ideea într-o coregrafie luminoasă: forme, culori, ritm, muzică și intensitatea potrivită atmosferei.",
    result: "Scenariu vizual propus",
    keywords: ["coregrafie", "muzică", "culori"],
    icon: Palette,
  },
  {
    step: "03",
    title: "Planificare tehnică",
    desc: "Verificăm spațiul, vizibilitatea, accesul, vântul, siguranța și condițiile reale pentru execuția spectacolului.",
    result: "Plan tehnic verificat",
    keywords: ["spațiu", "siguranță", "logistică"],
    icon: Settings2,
  },
  {
    step: "04",
    title: "Autorizări și sincronizare",
    desc: "Pregătim avizele, echipa, echipamentul și sincronizarea dintre drone, artificii, cold sparks și muzică.",
    result: "Show pregătit de execuție",
    keywords: ["avize", "echipă", "teste"],
    icon: Wrench,
  },
  {
    step: "05",
    title: "Execuție live",
    desc: "Rulăm spectacolul coordonat în timp real, cu atenție la siguranță, ritm și impactul vizual al momentului final.",
    result: "Moment memorabil pentru public",
    keywords: ["live", "impact", "final"],
    icon: Rocket,
  },
];

export const PACKAGES = [
  {
    icon: Flame,
    name: "Pachet Artificii",
    tagline: "Clasic & spectaculos",
    best: "Nunți și aniversări",
    impact: "Impact vizual ridicat",
    desc: "Final pirotehnic regizat pentru momentul-cheie.",
    features: ["Artificii sincronizate pe muzică", "Durată personalizată", "Echipă autorizată"],
    popular: false,
  },
  {
    icon: Plane,
    name: "Pachet Drone Show",
    tagline: "Modern & futurist",
    best: "Corporate & lansări",
    impact: "Impact vizual premium",
    desc: "Coregrafie de drone cu forme, mesaje și identitate vizuală.",
    features: ["Coregrafie 3D cu drone", "Logo & mesaje în aer", "Zero zgomot, zero fum"],
    popular: true,
  },
  {
    icon: Crown,
    name: "Pachet Combinat Premium",
    tagline: "Experiența supremă",
    best: "Evenimente premium",
    impact: "Impact vizual maxim",
    desc: "Drone, artificii și cold sparks într-un singur scenariu.",
    features: ["Drone + artificii sincronizate", "Cold sparks la momentele cheie", "Regie tehnică completă"],
    popular: false,
  },
  {
    icon: Sparkles,
    name: "Pachet Efecte Speciale",
    tagline: "Accent & atmosferă",
    best: "Intrări, dans, scenă",
    impact: "Moment vizual precis",
    desc: "Cold sparks și efecte adaptate momentelor-cheie.",
    features: ["Cold sparks", "Configurație indoor / outdoor", "Integrare în desfășurător"],
    popular: false,
  },
];

export const PRICING_FACTORS = [
  "Locația și accesul",
  "Durata spectacolului",
  "Complexitatea designului",
  "Numărul de drone",
  "Tipul de artificii și efecte",
  "Siguranță și logistică",
  "Cerințele specifice ale evenimentului",
];

/* ------------------------------------------------------------------ */
/*  Gallery                                                            */
/* ------------------------------------------------------------------ */
export const GALLERY = [
  { image: MEDIA.fireworksSky, alt: "Explozie colorată de artificii pe cerul nopții", category: "Artificii", big: true },
  { image: MEDIA.droneShow, alt: "Formație de drone luminoase pe cerul nopții", category: "Drone" },
  { image: MEDIA.coldSparks, alt: "Fântâni de scântei reci la un eveniment", category: "Cold sparks" },
  { image: MEDIA.crowd, alt: "Artificii spectaculoase deasupra unei mulțimi", category: "Festival" },
  { image: MEDIA.crowd2, alt: "Public la un spectacol de lumini și artificii", category: "City event", big: true },
  { image: MEDIA.coldSparks2, alt: "Cold sparks la momentul cheie al serii", category: "Eveniment privat" },
  { image: MEDIA.droneShow2, alt: "Drone show colorat pe cer", category: "Drone" },
  { image: MEDIA.crowd3, alt: "Artificii vibrante luminând cerul nopții", category: "Artificii" },
];

/* ------------------------------------------------------------------ */
/*  Social proof                                                       */
/* ------------------------------------------------------------------ */
// Populate only with verified client-approved testimonials and partner names.
export const TESTIMONIALS = [];
export const PARTNERS = [];

/* ------------------------------------------------------------------ */
/*  FAQ                                                                */
/* ------------------------------------------------------------------ */
export const FAQS = [
  { q: "Cu cât timp înainte trebuie rezervat spectacolul?", a: "Recomandăm rezervarea cu minim 3–4 săptămâni înainte, pentru planificare tehnică și obținerea autorizațiilor. Pentru evenimente mari sau date populare (sezon de nunți), ideal este să ne contactezi cu 1–2 luni înainte." },
  { q: "Se pot combina dronele cu artificiile?", a: "Da. Pachetul Combinat Premium rulează drone show și artificii sincronizate, pentru un impact vizual maxim și un final memorabil." },
  { q: "Ce se întâmplă dacă vremea este nefavorabilă?", a: "Siguranța este prioritară. În caz de vânt puternic sau condiții nefavorabile, replanificăm spectacolul sau adaptăm tehnic show-ul, conform unui plan stabilit împreună din timp." },
  { q: "Sunt necesare autorizații?", a: "Da, iar noi ne ocupăm de partea tehnică și de avizele necesare. Echipa noastră este autorizată și respectă toate normele de siguranță în vigoare." },
  { q: "Se pot face spectacole pentru nunți?", a: "Absolut. Nunțile sunt printre cele mai solicitate evenimente — de la primul dans cu cold sparks, până la drone show sau artificii pentru finalul serii." },
  { q: "Se pot face spectacole corporate sau festivaluri?", a: "Da. Realizăm show-uri custom pentru branduri, lansări de produs, gale corporate și festivaluri, la scară mică sau mare." },
  { q: "Cât durează un spectacol?", a: "În funcție de pachet și concept, un spectacol durează de regulă între 3 și 12 minute. Durata se personalizează în funcție de moment și buget." },
  { q: "Ce informații trebuie trimise pentru ofertă?", a: "Tipul evenimentului, data, locația aproximativă și ce tip de show îți dorești (drone, artificii sau combinat). Restul detaliilor le stabilim împreună la consultanță." },
  { q: "Sunt disponibile efecte speciale indoor?", a: "Da, în funcție de locație și condițiile tehnice. Cold sparks și alte efecte de scenă se aleg după verificarea spațiului, a distanțelor și a regulilor locației." },
  { q: "De ce prețul este personalizat?", a: "Costul depinde de locație, durată, complexitatea designului, numărul de drone, tipul efectelor, cerințele de siguranță și logistica necesară." },
];

/* ------------------------------------------------------------------ */
/*  Forms & nav                                                        */
/* ------------------------------------------------------------------ */
export const SERVICE_OPTIONS = [
  "Spectacole cu drone",
  "Artificii profesionale",
  "Drone + artificii sincronizate",
  "Cold sparks / efecte speciale",
  "Nu sunt sigur(ă) încă",
];

export const EVENT_TYPES = ["Nuntă", "Corporate", "Festival", "Lansare de produs", "Aniversare / Eveniment privat", "Eveniment de oraș", "Altul"];

export const NAV_LINKS = [
  { label: "Acasă", href: "#acasa" },
  { label: "Despre noi", href: "#intro" },
  { label: "Pachete", href: "/pachete" },
  { label: "Galerie", href: "/galerie" },
  { label: "Întrebări", href: "/intrebari-frecvente" },
  { label: "Blog", href: "/blog" },
  { label: "Contact", href: "/contact" },
];

// Unused icon kept to avoid tree-shake surprises in data consumers

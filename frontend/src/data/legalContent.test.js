import { LEGAL_PAGE_PRESENTATION, updatePriorLegalCopy } from "./legalContent";


const pageText = (key) => LEGAL_PAGE_PRESENTATION[key].sections
  .flatMap((section) => [section.title, ...section.body])
  .join(" ");


test("privacy copy describes the production data and email flows without the old in-memory claim", () => {
  const text = pageText("confidentialitate");

  expect(text).toMatch(/formularul de ofertă/i);
  expect(text).toMatch(/identificator pseudonimizat/i);
  expect(text).toMatch(/MongoDB Atlas/i);
  expect(text).toMatch(/Resend/i);
  expect(text).toMatch(/Cloudflare Turnstile/i);
  expect(text).toMatch(/mesajele primite/i);
  expect(text).toMatch(/dreptur/i);
  expect(text).not.toMatch(/în memoria serverului și nu în baza de date/i);
});


test("cookie copy covers consent, temporary contact prefill, and consent-gated GA4", () => {
  const text = pageText("cookies");

  expect(text).toMatch(/localStorage/i);
  expect(text).toMatch(/sessionStorage/i);
  expect(text).toMatch(/fireartro-cookie-consent-v1/i);
  expect(text).toMatch(/fireartro-contact-prefill/i);
  expect(text).toMatch(/dezactivată implicit/i);
  expect(text).toMatch(/Google Analytics 4/i);
  expect(text).toMatch(/numai după acceptul explicit/i);
  expect(text).toMatch(/Setări cookies/i);
  expect(text).toMatch(/revizuit/i);
});


test.each(["confidentialitate", "termeni", "cookies"])(
  "%s shows the current technical-copy review date",
  (key) => {
    expect(LEGAL_PAGE_PRESENTATION[key].updated).toBe("22 noiembrie 2026");
  },
);

test("updates the published baseline while preserving an edited CMS section", () => {
  const original = {
    title: "Politica FireArtRo",
    updatedLabel: "Actualizat la 28 septembrie 2026",
    sections: [
      { id: "withdrawal", heading: "Cum îți alegi setările", paragraphs: [
        "Deschide Setări cookies din subsolul paginii. Poți alege Doar necesare, toate opțiunile sau o selecție. Refuzul nu afectează accesul la informațiile firmei și formularul de ofertă.",
        "Un paragraf personalizat în Admin.",
      ] },
    ],
  };
  const updated = updatePriorLegalCopy(original);
  expect(updated.updatedLabel).toBe("Actualizat la 22 noiembrie 2026");
  expect(updated.title).toBe(original.title);
  expect(updated.sections[0].heading).toBe(original.sections[0].heading);
  expect(updated.sections[0].paragraphs[0]).toMatch(/retrage direct acordul/);
  expect(updated.sections[0].paragraphs.at(-1)).toBe(original.sections[0].paragraphs[1]);
  expect(updatePriorLegalCopy(updated)).toBe(updated);
});

test("informs visitors about server consent proof and how withdrawal works", () => {
  const cookies = pageText("cookies");
  const privacy = pageText("confidentialitate");

  expect(cookies).toMatch(/confirmarea serverului/);
  expect(cookies).toMatch(/referință aleatorie/);
  expect(cookies).toMatch(/versiunea 3/);
  expect(cookies).toMatch(/ora de primire a retragerii/);
  expect(cookies).toMatch(/dezactivează imediat/);
  expect(cookies).toMatch(/MongoDB Atlas/);
  expect(cookies).toMatch(/365 de zile/);
  expect(privacy).toMatch(/dovedirea consimțământului/);
  expect(privacy).toMatch(/365 de zile/);
});

test("replaces the prior consent storage copy in a published document without overwriting custom paragraphs", () => {
  const original = {
    title: "Politica personalizată",
    updatedLabel: "Versiunea anterioară",
    sections: [{
      id: "cookies-section-2",
      heading: "Cum funcționează stocarea",
      paragraphs: [
        "fireartro-cookie-consent-v1 (localStorage, fireart.ro) păstrează categoriile alese, versiunea informării, data alegerii și expirarea. Durata este afișată în panoul Setări cookies. După expirare, preferința nu mai activează funcțiile opționale. Dacă browserul blochează salvarea, opțiunile rămân dezactivate.",
        "Un paragraf personalizat în Admin.",
      ],
    }],
  };
  const updated = updatePriorLegalCopy(original);
  expect(updated.title).toBe(original.title);
  expect(updated.sections[0].heading).toBe(original.sections[0].heading);
  expect(updated.sections[0].paragraphs.join(" ")).toMatch(/referință aleatorie/);
  expect(updated.sections[0].paragraphs.at(-1)).toBe(original.sections[0].paragraphs[1]);
  expect(updatePriorLegalCopy(updated)).toBe(updated);
});

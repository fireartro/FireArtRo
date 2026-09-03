import {
  ADMIN_DEFAULTS,
  ADMIN_MODULES,
  MODULE_ORDER,
  makeAdminItem,
} from "@/admin/adminConfig";

const requiredModules = [
  "siteDetails",
  "contactSettings",
  "businessHours",
  "socialLinks",
  "navigation",
  "footer",
  "homePage",
  "galleryPage",
  "packagesPage",
  "faqPage",
  "contactPage",
  "blogPage",
  "mediaItems",
  "packages",
  "faqs",
  "testimonials",
  "partners",
  "reviewSettings",
  "cookieSettings",
  "legalPages",
];

const collectionModules = [
  "socialLinks",
  "mediaItems",
  "packages",
  "faqs",
  "testimonials",
  "partners",
];

describe("Admin managed-content configuration", () => {
  test.each(requiredModules)("%s has a v1 fallback and editor definition", (key) => {
    expect(ADMIN_DEFAULTS[key]).toBeDefined();
    expect(ADMIN_MODULES[key]).toBeDefined();
    expect(MODULE_ORDER).toContain(key);
  });

  test("the fallback is a complete CMS v1 snapshot rather than browser-only fragments", () => {
    expect(ADMIN_DEFAULTS.schema_version).toBe(1);
    expect(ADMIN_DEFAULTS.navigation.links.length).toBeGreaterThan(0);
    expect(ADMIN_DEFAULTS.footer.legalLinks.length).toBeGreaterThan(0);
    expect(ADMIN_DEFAULTS.homePage.hero.titleLead).toBeTruthy();
    expect(ADMIN_DEFAULTS.contactPage.eventTypes.length).toBeGreaterThan(0);
    expect(ADMIN_DEFAULTS.legalPages.privacy.sections[0].id).toBeTruthy();
  });

  test.each(collectionModules)("%s creates items with a stable ID and fields represented by its template", (key) => {
    const module = ADMIN_MODULES[key];
    const next = makeAdminItem(key, 0);

    expect(module.kind).toBe("collection");
    expect(module.template.id).toBeTruthy();
    expect(next.id).toMatch(new RegExp(`^${module.template.id}-`));
    module.fields.forEach((field) => {
      expect(Object.prototype.hasOwnProperty.call(module.template, field.key)).toBe(true);
    });
  });

  test.each(requiredModules)("%s exposes every nested default through a typed editor", (key) => {
    const inspect = (definition, value) => {
      expect(["object", "collection"]).toContain(definition.type);
      if (definition.type === "collection") {
        expect(definition.template.id).toMatch(/^[a-z0-9][a-z0-9-]{0,79}$/);
        const items = [definition.template, ...value];
        items.forEach((item) => inspect({ type: "object", fields: definition.fields }, item));
        expect(new Set(value.map((item) => item.id)).size).toBe(value.length);
        return;
      }
      expect(definition.fields.map((field) => field.key).sort()).toEqual(Object.keys(value).sort());
      definition.fields.forEach((field) => {
        if (["object", "collection"].includes(field.type)) inspect(field, value[field.key]);
        if (field.key.endsWith("MediaId") || field.key === "mediaId") expect(field.type).toBe("mediaId");
      });
    };
    inspect(ADMIN_MODULES[key], ADMIN_DEFAULTS[key]);
  });

  test("rapid additions do not create colliding IDs or share nested arrays", () => {
    const first = makeAdminItem("packages");
    const second = makeAdminItem("packages");
    expect(first.id).not.toBe(second.id);
    first.highlights.push("Doar în primul element");
    expect(second.highlights).toEqual([]);
    expect(ADMIN_MODULES.packages.template.highlights).toEqual([]);
  });
});

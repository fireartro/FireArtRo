import { CMS_DEFAULTS } from "@/data/cmsDefaults";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Mail, MessageCircle, Phone } from "lucide-react";
import NightButton from "@/components/night/NightButton";
import { buildWhatsappLink } from "@/lib/constants";
import { readContactPrefill } from "@/lib/contactNavigation";
import useManagedContent from "@/hooks/useManagedContent";

const BACKEND_URL = (process.env.REACT_APP_BACKEND_URL || "").replace(/\/$/, "");
const API = `${BACKEND_URL}/api`;
const REQUEST_TIMEOUT_MS = 12_000;

const EMPTY_FORM = {
  first_name: "",
  last_name: "",
  phone: "",
  email: "",
  locality: "",
  event_location: "",
  event_date: "",
  event_type: "",
  services: [],
  package_id: "",
  package_title: "",
  message: "",
  consent: false,
  company_website: "",
};

const postQuote = async (payload) => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${API}/quotes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const error = new Error("Cererea nu a putut fi trimisă.");
      error.status = response.status;
      throw error;
    }

    return response.json();
  } finally {
    window.clearTimeout(timeout);
  }
};

const freshForm = () => ({ ...EMPTY_FORM, services: [] });

const queryPrefill = (showOptions) => {
  if (typeof window === "undefined") return {};
  const requestedService = new URLSearchParams(window.location.search).get("service");
  const service = showOptions.find(
    (item) => item.label.localeCompare(requestedService || "", "ro", { sensitivity: "base" }) === 0,
  );
  return service ? { services: [service.label] } : {};
};

export const QuoteForm = () => {
  const [form, setForm] = useState(freshForm);
  const [errors, setErrors] = useState({});
  const [announcement, setAnnouncement] = useState("");
  const [submissionError, setSubmissionError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const packages = useManagedContent("packages", CMS_DEFAULTS.packages);
  const siteDetails = useManagedContent("siteDetails", CMS_DEFAULTS.siteDetails);
  const businessHours = useManagedContent("businessHours", CMS_DEFAULTS.businessHours);
  const contactSettings = useManagedContent("contactSettings", CMS_DEFAULTS.contactSettings);
  const contactPage = useManagedContent("contactPage", CMS_DEFAULTS.contactPage);
  const eventTypes = useMemo(() => contactPage.eventTypes || [], [contactPage.eventTypes]);
  const showOptions = useMemo(() => contactPage.showOptions || [], [contactPage.showOptions]);
  const phoneDisplay = contactSettings.phoneDisplay || "";
  const phoneHref = contactSettings.phoneTel || phoneDisplay.replace(/\s/g, "");
  const whatsAppHref = buildWhatsappLink(contactSettings.whatsappNumber);
  const email = siteDetails.email || "contact@fireart.ro";
  const minimumDate = useMemo(() => new Date().toISOString().slice(0, 10), []);

  useEffect(() => {
    const storedPrefill = readContactPrefill();
    const urlPrefill = queryPrefill(showOptions);
    if (Object.keys(storedPrefill).length || Object.keys(urlPrefill).length) {
      setForm((current) => ({
        ...current,
        ...storedPrefill,
        ...urlPrefill,
        services: [...new Set([
          ...(current.services || []),
          ...(storedPrefill.services || []),
          ...(urlPrefill.services || []),
        ])],
      }));
    }

    const handlePackagePrefill = (event) => {
      const item = event.detail;
      setForm((current) => ({
        ...current,
        package_id: item.id || "",
        package_title: item.title || String(item),
        services: item.category
          ? [...new Set([...(current.services || []), item.category])]
          : current.services,
      }));
    };

    window.addEventListener("prefill-package", handlePackagePrefill);
    return () => window.removeEventListener("prefill-package", handlePackagePrefill);
  }, [showOptions]);

  const update = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setSubmissionError("");
  };

  const updateService = (service) => {
    setForm((current) => ({ ...current, services: service ? [service] : [] }));
    setErrors((current) => ({ ...current, services: undefined }));
    setSubmissionError("");
  };

  const updatePackage = (packageId) => {
    const item = packages.find((entry) => entry.id === packageId);
    setForm((current) => ({
      ...current,
      package_id: packageId,
      package_title: item?.title || "",
    }));
    setSubmissionError("");
  };

  const validate = () => {
    const nextErrors = {};
    if (!form.event_type) nextErrors.event_type = "Alege tipul evenimentului.";
    if (!form.event_date) nextErrors.event_date = "Completează data evenimentului.";
    if (form.locality.trim().length < 2) nextErrors.locality = "Completează localitatea.";
    if (!form.services.length) nextErrors.services = "Alege spectacolul dorit sau cere o recomandare.";
    if (form.first_name.trim().length < 2) nextErrors.first_name = "Completează numele.";
    if (form.last_name.trim().length < 2) nextErrors.last_name = "Completează prenumele.";
    if (form.phone.trim().length < 7) nextErrors.phone = "Introdu un număr de telefon valid.";
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) nextErrors.email = "Introdu o adresă de email validă.";
    if (!form.consent) nextErrors.consent = "Acceptă prelucrarea datelor pentru a trimite cererea.";

    if (!Object.keys(nextErrors).length) return true;

    const focusOrder = [
      ["event_type", "quote-event-type"],
      ["event_date", "quote-date"],
      ["locality", "quote-locality"],
      ["services", "quote-service"],
      ["first_name", "quote-first-name"],
      ["last_name", "quote-last-name"],
      ["phone", "quote-phone"],
      ["email", "quote-email"],
      ["consent", "quote-consent"],
    ];
    const firstInvalidId = focusOrder.find(([key]) => nextErrors[key])?.[1];

    setErrors(nextErrors);
    setAnnouncement("Completează câmpurile obligatorii înainte de trimitere.");
    window.requestAnimationFrame(() => document.getElementById(firstInvalidId)?.focus());
    return false;
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setAnnouncement("");
    setSubmissionError("");
    try {
      await postQuote(form);
      setDone(true);
      setForm(freshForm());
      toast.success("Cererea a fost trimisă.");
    } catch (error) {
      const message = error.status === 429
        ? "Ai trimis mai multe solicitări într-un interval scurt. Încearcă mai târziu."
        : error.name === "AbortError"
          ? "Trimiterea a durat prea mult. Încearcă din nou sau contactează-ne direct."
          : "Nu am putut trimite cererea. Datele au rămas în formular.";
      setSubmissionError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const restart = () => {
    setDone(false);
    setErrors({});
    setAnnouncement("");
    setSubmissionError("");
    setForm(freshForm());
  };

  const fieldError = (key) => errors[key]
    ? <small className="nr-contact-error" id={`quote-${key}-error`}>{errors[key]}</small>
    : null;

  return (
    <section className="nr-contact-main" data-testid="contact-section" aria-labelledby="contact-title">
      <div className="nr-shell nr-contact-layout">
        <header className="nr-contact-intro">
          <p className="nr-contact-kicker">{contactPage.eyebrow}</p>
          <h1 id="contact-title">{contactPage.title}</h1>
          <p className="nr-contact-lead">{contactPage.description}</p>

          <div className="nr-contact-direct" aria-label="Contact direct">
            {phoneDisplay && (
              <NightButton
                href={`tel:${phoneHref}`}
                variant="secondary"
                showArrow={false}
                className="nr-contact-direct__action"
                aria-label={`Sună la ${phoneDisplay}`}
              >
                <Phone aria-hidden="true" />
                <span>Telefon</span>
              </NightButton>
            )}
            <NightButton
              href={`mailto:${email}`}
              variant="secondary"
              showArrow={false}
              className="nr-contact-direct__action"
              aria-label={`Trimite email la ${email}`}
            >
              <Mail aria-hidden="true" />
              <span>Email</span>
            </NightButton>
            {whatsAppHref && (
              <NightButton
                href={whatsAppHref}
                target="_blank"
                rel="noopener noreferrer"
                variant="secondary"
                showArrow={false}
                className="nr-contact-direct__action"
                aria-label="Scrie pe WhatsApp"
              >
                <MessageCircle aria-hidden="true" />
                <span>WhatsApp</span>
              </NightButton>
            )}
          </div>
          <p className="nr-contact-hours">{businessHours.label}</p>
        </header>

        <div className="nr-contact-form-wrap">
          <span className="nr-contact-main__rail" data-testid="contact-form-rail" aria-hidden="true" />
          {done ? (
            <div className="nr-contact-success" data-testid="quote-success" role="status">
              <CheckCircle2 aria-hidden="true" />
              <h2>Cererea a fost trimisă.</h2>
              <p>Revenim după ce verificăm data și locația.</p>
              <NightButton as="button" onClick={restart} variant="secondary">Trimite altă cerere</NightButton>
            </div>
          ) : (
            <form onSubmit={submit} data-testid="quote-form" aria-busy={loading} noValidate>
              <div className="nr-contact-form-heading">
                <p>{contactPage.formTitle}</p>
                <span>Câmpurile marcate sunt obligatorii.</span>
              </div>
              <p className="nr-contact-announcement" role="alert" aria-live="polite">{announcement}</p>

              <fieldset className="nr-contact-form-group" data-contact-form-group>
                <legend>Eveniment</legend>
                <div className="nr-contact-fields">
                <div className="nr-contact-field">
                  <label htmlFor="quote-event-type">Tip eveniment *</label>
                  <select id="quote-event-type" value={form.event_type} onChange={(event) => update("event_type", event.target.value)} aria-invalid={Boolean(errors.event_type)} aria-describedby={errors.event_type ? "quote-event_type-error" : undefined}>
                    <option value="">Alege tipul</option>
                    {eventTypes.map((item) => <option key={item.id} value={item.label}>{item.label}</option>)}
                  </select>
                  {fieldError("event_type")}
                </div>

                <div className="nr-contact-field">
                  <label htmlFor="quote-date">Data evenimentului *</label>
                  <input id="quote-date" type="date" min={minimumDate} value={form.event_date} onChange={(event) => update("event_date", event.target.value)} aria-invalid={Boolean(errors.event_date)} aria-describedby={errors.event_date ? "quote-event_date-error" : undefined} />
                  {fieldError("event_date")}
                </div>

                <div className="nr-contact-field">
                  <label htmlFor="quote-locality">Localitatea *</label>
                  <input id="quote-locality" autoComplete="address-level2" maxLength={120} value={form.locality} onChange={(event) => update("locality", event.target.value)} aria-invalid={Boolean(errors.locality)} aria-describedby={errors.locality ? "quote-locality-error" : undefined} placeholder="Ex. Cluj-Napoca" />
                  {fieldError("locality")}
                </div>

                <div className="nr-contact-field">
                  <label htmlFor="quote-service">Spectacol dorit *</label>
                  <select id="quote-service" value={form.services[0] || ""} onChange={(event) => updateService(event.target.value)} aria-invalid={Boolean(errors.services)} aria-describedby={errors.services ? "quote-services-error" : undefined}>
                    <option value="">Alege o opțiune</option>
                    {showOptions.map((item) => <option key={item.id} value={item.label}>{item.label}</option>)}
                  </select>
                  {errors.services && <small className="nr-contact-error" id="quote-services-error">{errors.services}</small>}
                </div>
                </div>
              </fieldset>

              <fieldset className="nr-contact-form-group" data-contact-form-group>
                <legend>Date de contact</legend>
                <div className="nr-contact-fields">
                <div className="nr-contact-field">
                  <label htmlFor="quote-first-name">Nume *</label>
                  <input id="quote-first-name" autoComplete="family-name" maxLength={80} value={form.first_name} onChange={(event) => update("first_name", event.target.value)} aria-invalid={Boolean(errors.first_name)} aria-describedby={errors.first_name ? "quote-first_name-error" : undefined} />
                  {fieldError("first_name")}
                </div>

                <div className="nr-contact-field">
                  <label htmlFor="quote-last-name">Prenume *</label>
                  <input id="quote-last-name" autoComplete="given-name" maxLength={80} value={form.last_name} onChange={(event) => update("last_name", event.target.value)} aria-invalid={Boolean(errors.last_name)} aria-describedby={errors.last_name ? "quote-last_name-error" : undefined} />
                  {fieldError("last_name")}
                </div>

                <div className="nr-contact-field">
                  <label htmlFor="quote-phone">Telefon *</label>
                  <input id="quote-phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={30} value={form.phone} onChange={(event) => update("phone", event.target.value)} aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? "quote-phone-error" : undefined} placeholder="07xx xxx xxx" />
                  {fieldError("phone")}
                </div>

                <div className="nr-contact-field">
                  <label htmlFor="quote-email">Email *</label>
                  <input id="quote-email" type="email" autoComplete="email" maxLength={160} value={form.email} onChange={(event) => update("email", event.target.value)} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "quote-email-error" : undefined} />
                  {fieldError("email")}
                </div>
                </div>
              </fieldset>

              <details className="nr-contact-optional" data-testid="quote-optional-details">
                <summary>
                  <span>Adaugă detalii</span>
                  <small>{form.package_title || "Opțional"}</small>
                </summary>
                <div className="nr-contact-optional__fields">
                  <div className="nr-contact-field">
                    <label htmlFor="quote-event-location">Locația exactă</label>
                    <input id="quote-event-location" maxLength={180} value={form.event_location} onChange={(event) => update("event_location", event.target.value)} placeholder="Adresă, sală sau reper" />
                  </div>

                  <div className="nr-contact-field">
                    <label htmlFor="quote-package">Pachet selectat</label>
                    <select id="quote-package" value={form.package_id} onChange={(event) => updatePackage(event.target.value)}>
                      <option value="">Fără pachet selectat</option>
                      {packages.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                    </select>
                  </div>

                  <div className="nr-contact-field nr-contact-field--wide">
                    <label htmlFor="quote-message">Mesaj</label>
                    <textarea id="quote-message" rows={3} maxLength={3000} value={form.message} onChange={(event) => update("message", event.target.value)} placeholder="Orice detaliu care ne ajută să înțelegem momentul" />
                  </div>
                </div>
              </details>

              <div className="nr-contact-honeypot" aria-hidden="true">
                <label htmlFor="company-website">Website companie</label>
                <input id="company-website" tabIndex={-1} autoComplete="off" value={form.company_website} onChange={(event) => update("company_website", event.target.value)} />
              </div>

              <label className="nr-contact-consent" htmlFor="quote-consent">
                <input id="quote-consent" type="checkbox" checked={form.consent} onChange={(event) => update("consent", event.target.checked)} aria-invalid={Boolean(errors.consent)} aria-describedby={errors.consent ? "quote-consent-error" : undefined} />
                <span>{contactPage.consentLabel} <a href="/confidentialitate">politicii de confidențialitate</a>.</span>
              </label>
              {fieldError("consent")}

              {submissionError && (
                <div className="nr-contact-submit-error" data-testid="quote-error" role="alert">
                  <strong>Cererea nu a fost trimisă.</strong>
                  <p>{submissionError}</p>
                </div>
              )}

              <div className="nr-contact-submit-row">
                <p>Datele sunt folosite doar pentru această solicitare.</p>
                <NightButton as="button" type="submit" disabled={loading} showArrow={!loading}>
                  {loading ? <><Loader2 className="nr-contact-spinner" aria-hidden="true" /> Se trimite...</> : contactPage.submitLabel}
                </NightButton>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
};

export default QuoteForm;

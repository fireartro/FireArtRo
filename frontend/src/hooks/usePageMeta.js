import { useEffect } from "react";
import { SITE_DETAILS } from "@/data/businessContent";
import useManagedContent from "@/hooks/useManagedContent";

const ensureMeta = (selector, attributes) => {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement("meta");
    document.head.appendChild(element);
  }
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
};

export default function usePageMeta({
  title,
  description,
  path,
  image = "/media/fireart-hero-poster.webp",
  schema,
  noindex = false,
}) {
  const siteDetails = useManagedContent("siteDetails", SITE_DETAILS);
  const schemaText = schema ? JSON.stringify(schema).replace(/</g, "\\u003c") : "";

  useEffect(() => {
    const canonicalUrl = `${siteDetails.siteUrl}${path}`;
    const imageUrl = image.startsWith("http") ? image : `${siteDetails.siteUrl}${image}`;
    document.title = title;

    ensureMeta('meta[name="description"]', { name: "description", content: description });
    ensureMeta('meta[name="robots"]', {
      name: "robots",
      content: noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large",
    });
    ensureMeta('meta[property="og:title"]', { property: "og:title", content: title });
    ensureMeta('meta[property="og:description"]', { property: "og:description", content: description });
    ensureMeta('meta[property="og:url"]', { property: "og:url", content: canonicalUrl });
    ensureMeta('meta[property="og:image"]', { property: "og:image", content: imageUrl });
    ensureMeta('meta[name="twitter:title"]', { name: "twitter:title", content: title });
    ensureMeta('meta[name="twitter:description"]', { name: "twitter:description", content: description });
    ensureMeta('meta[name="twitter:image"]', { name: "twitter:image", content: imageUrl });

    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", canonicalUrl);

    const schemaId = "page-structured-data";
    document.getElementById(schemaId)?.remove();
    if (schemaText) {
      const script = document.createElement("script");
      script.id = schemaId;
      script.type = "application/ld+json";
      script.textContent = schemaText;
      document.head.appendChild(script);
    }

    return () => document.getElementById(schemaId)?.remove();
  }, [description, image, noindex, path, schemaText, siteDetails.siteUrl, title]);
}

import { createContext, useContext, useEffect } from "react";
import { CANONICAL_SITE_URL } from "@/data/businessContent";
import { DEFAULT_SEARCH_COVER, SEARCH_COVERS } from "@/data/searchCovers";

// A collector belongs to one server render; concurrent requests share no state.
export const PageMetadataContext = createContext(null);

const ensureMeta = (selector, attributes) => {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement("meta");
    document.head.appendChild(element);
  }
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
};

function withPrimaryImage(schema, canonicalUrl, imageUrl) {
  const { "@context": context, "@graph": graph, ...node } = schema || {};
  return {
    "@context": context || "https://schema.org",
    "@graph": [
      ...(graph || (schema ? [node] : [])),
      {
        "@type": "WebPage",
        "@id": `${canonicalUrl}#webpage`,
        url: canonicalUrl,
        primaryImageOfPage: { "@type": "ImageObject", url: imageUrl },
      },
    ],
  };
}

export default function usePageMeta({
  title,
  description,
  path,
  image,
  schema,
  noindex = false,
}) {
  const collector = useContext(PageMetadataContext);
  const selectedCover = image || SEARCH_COVERS[path];
  const resolvedImage = selectedCover || DEFAULT_SEARCH_COVER;
  const canonicalUrl = `${CANONICAL_SITE_URL}${path}`;
  const imageUrl = resolvedImage.startsWith("http") ? resolvedImage : `${CANONICAL_SITE_URL}${resolvedImage}`;
  const pageSchema = SEARCH_COVERS[path] && !noindex
    ? withPrimaryImage(schema, canonicalUrl, imageUrl)
    : schema;
  if (collector) collector.current = { title, description, path, image: resolvedImage, schema: pageSchema, noindex };
  const schemaText = pageSchema ? JSON.stringify(pageSchema).replace(/</g, "\\u003c") : "";

  useEffect(() => {
    if (window.location.pathname === "/admin") return;
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
  }, [canonicalUrl, description, imageUrl, noindex, schemaText, title]);
}

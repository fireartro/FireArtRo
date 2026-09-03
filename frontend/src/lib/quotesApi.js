export const QUOTE_STATUSES = {
  new: "Nouă", contacted: "Contactat", qualified: "Calificată", closed: "Închisă", spam: "Spam",
};

export function quoteFilters(params) {
  const page = Number(params.get("page") || 1);
  const status = params.get("status") || "";
  return {
    q: (params.get("q") || "").slice(0, 120).trim(),
    status: Object.hasOwn(QUOTE_STATUSES, status) ? status : "",
    page: Number.isInteger(page) && page >= 1 && page <= 1000 ? page : 1,
  };
}

export function listAdminQuotes(request, filters, options = {}) {
  const query = new URLSearchParams({ page: String(filters.page), page_size: "25" });
  if (filters.status) query.set("status", filters.status);
  if (filters.q) query.set("q", filters.q);
  return request(`/api/admin/quotes?${query}`, options);
}

export function getAdminQuote(request, id, options = {}) {
  return request(`/api/admin/quotes/${encodeURIComponent(id)}`, options);
}

export function updateAdminQuote(request, quote, values) {
  return request(`/api/admin/quotes/${encodeURIComponent(quote.id)}`, {
    method: "PATCH",
    body: JSON.stringify({ version: quote.version, status: values.status, internal_note: values.internal_note }),
  });
}

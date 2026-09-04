export const INBOX_CATEGORIES = {
  contact: "Contact",
  other_recipient: "Altă adresă",
};

export function listInboxMessages(request, filters, options = {}) {
  const search = String(filters.q || "").trim().slice(0, 200);
  const category = Object.hasOwn(INBOX_CATEGORIES, filters.category)
    ? filters.category
    : null;
  return request("/api/admin/inbox/search", {
    ...options,
    method: "POST",
    body: JSON.stringify({
      q: search,
      category,
      page: filters.page,
      page_size: 20,
    }),
  });
}

export function getInboxMessage(request, id, options = {}) {
  return request(`/api/admin/inbox/${encodeURIComponent(id)}`, options);
}

export function replyToInboxMessage(request, id, text, replyId) {
  return request(`/api/admin/inbox/${encodeURIComponent(id)}/reply`, {
    method: "POST",
    body: JSON.stringify({ text, reply_id: replyId }),
  });
}

export function retryInboxRelay(request, id) {
  return request(`/api/admin/inbox/${encodeURIComponent(id)}/relay/retry`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function createReplyId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return [...bytes].map((value, index) => {
    const separator = [4, 6, 8, 10].includes(index) ? "-" : "";
    return `${separator}${value.toString(16).padStart(2, "0")}`;
  }).join("");
}

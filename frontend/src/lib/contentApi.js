export async function fetchPublishedContent({ signal, revisionId } = {}) {
  const boot = typeof window !== 'undefined' ? window.__fireartContentBoot : null;
  if (boot) delete window.__fireartContentBoot;
  // Consume only on first mount, not on navigation/focus revalidation. No
  // persistent cache: Admin publications remain authoritative immediately.
  if (boot && !revisionId && Date.now() - boot.startedAt < 15_000) {
    const publication = await boot.request;
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (publication) return publication;
  }
  const response = await fetch('/api/content', { signal, credentials: 'omit', cache: 'no-cache',
    headers: revisionId && revisionId !== 'fallback' ? { 'If-None-Match': `"${revisionId}"` } : {},
  });
  if (response.status === 304) return null;
  if (!response.ok) throw new Error('Conținutul public nu a putut fi încărcat.');
  return response.json();
}

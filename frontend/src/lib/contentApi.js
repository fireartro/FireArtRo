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

export async function fetchPublishedRevision({signal, revisionId} = {}) {
  const response = await fetch('/api/content/revision', {
    signal, credentials: 'omit', cache: 'no-cache',
    headers: revisionId && revisionId !== 'fallback' ? {'If-None-Match': `"${revisionId}"`} : {},
  });
  if (response.status === 304) return null;
  if (!response.ok) throw new Error('Versiunea publică nu poate fi verificată.');
  const metadata = await response.json();
  if (typeof metadata.revision_id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,79}$/i.test(metadata.revision_id)
      || typeof metadata.published_at !== 'string' || !Number.isFinite(Date.parse(metadata.published_at))) {
    throw new Error('Versiune publică invalidă.');
  }
  return metadata;
}

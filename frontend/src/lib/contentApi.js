export async function fetchPublishedContent({ signal, revisionId } = {}) {
  const response = await fetch('/api/content', { signal, credentials: 'omit', cache: 'no-cache',
    headers: revisionId && revisionId !== 'fallback' ? { 'If-None-Match': `"${revisionId}"` } : {},
  });
  if (response.status === 304) return null;
  if (!response.ok) throw new Error('Conținutul public nu a putut fi încărcat.');
  return response.json();
}

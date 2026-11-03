import { useManagedContentSnapshot } from '@/content/ManagedContentProvider';
import { useMemo } from 'react';
import { localizePublicImages } from '@/lib/publicImageMetadata';

export const MANAGED_CONTENT_STORAGE_KEY = 'fireartro-managed-content-v1';

// Explicitly invoked by the authenticated import tool only, never by public hooks.
export function readManagedContent() {
  try { return JSON.parse(window.localStorage.getItem(MANAGED_CONTENT_STORAGE_KEY) || '{}'); }
  catch { return {}; }
}
export default function useManagedContent(key, fallback) {
  const { content } = useManagedContentSnapshot();
  const value = content?.[key] ?? fallback;
  return useMemo(() => localizePublicImages(value), [value]);
}

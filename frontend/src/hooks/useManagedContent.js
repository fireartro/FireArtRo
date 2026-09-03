import { useManagedContentSnapshot } from '@/content/ManagedContentProvider';

export const MANAGED_CONTENT_STORAGE_KEY = 'fireartro-managed-content-v1';

// Explicitly invoked by the authenticated import tool only, never by public hooks.
export function readManagedContent() {
  try { return JSON.parse(window.localStorage.getItem(MANAGED_CONTENT_STORAGE_KEY) || '{}'); }
  catch { return {}; }
}
export default function useManagedContent(key, fallback) {
  const { content } = useManagedContentSnapshot();
  return content?.[key] ?? fallback;
}

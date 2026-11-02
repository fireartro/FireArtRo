import { useCallback, useSyncExternalStore } from 'react';
import { useReducedMotion as useMotionPreference } from 'framer-motion';

const subscribe = () => () => {};
const serverPreference = () => false;

// Match the server during hydration, then retain Motion's live preference.
// Client-only renders still receive the preference on their first render.
export default function useReducedMotion() {
  const preference = useMotionPreference();
  const snapshot = useCallback(() => preference, [preference]);
  return useSyncExternalStore(subscribe, snapshot, serverPreference);
}

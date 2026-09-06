import { useEffect, useState } from 'react';

// Retain an initialized scene when it leaves view; its own lifecycle can pause
// rendering without repeatedly downloading/rebuilding expensive resources.
export default function useNearViewport(ref, rootMargin = '600px') {
  const [near, setNear] = useState(false);
  useEffect(() => {
    const target = ref.current;
    if (!target) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      setNear(true);
      return undefined;
    }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setNear(true);
        observer.disconnect();
      }
    }, { rootMargin });
    observer.observe(target);
    return () => observer.disconnect();
  }, [ref, rootMargin]);
  return near;
}

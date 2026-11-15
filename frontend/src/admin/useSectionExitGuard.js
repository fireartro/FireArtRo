import { useEffect } from "react";

export function useSectionExitGuard(onChange, { busy, dirty }) {
  useEffect(() => {
    if (!onChange) return undefined;
    onChange(busy ? "busy" : dirty ? "dirty" : "ready");
    return () => onChange("ready");
  }, [onChange, busy, dirty]);
}

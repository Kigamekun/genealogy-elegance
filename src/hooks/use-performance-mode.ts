import { useEffect, useState } from "react";

interface NavigatorWithPerformanceHints extends Navigator {
  deviceMemory?: number;
  connection?: {
    saveData?: boolean;
  };
}

function detectConstrainedMode(): boolean {
  if (typeof window === "undefined") return false;

  const navigatorHints = window.navigator as NavigatorWithPerformanceHints;
  const userAgent = navigatorHints.userAgent ?? "";
  const isAndroid = /Android/i.test(userAgent);
  const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const deviceMemory = typeof navigatorHints.deviceMemory === "number"
    ? navigatorHints.deviceMemory
    : 8;
  const cpuCores = typeof navigatorHints.hardwareConcurrency === "number"
    ? navigatorHints.hardwareConcurrency
    : 8;
  const saveDataEnabled = Boolean(navigatorHints.connection?.saveData);

  if (saveDataEnabled) return true;
  if (!isAndroid || !isCoarsePointer) return false;

  return deviceMemory <= 6 || cpuCores <= 6;
}

export function useIsConstrainedMode() {
  const [isConstrainedMode, setIsConstrainedMode] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(pointer: coarse)");
    const updateMode = () => {
      setIsConstrainedMode(detectConstrainedMode());
    };

    updateMode();
    mediaQuery.addEventListener("change", updateMode);

    return () => {
      mediaQuery.removeEventListener("change", updateMode);
    };
  }, []);

  return isConstrainedMode;
}

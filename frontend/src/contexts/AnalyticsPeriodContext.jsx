import { useEffect, useMemo, useState } from "react";
import { AnalyticsPeriodContext } from "./AnalyticsPeriodContext.shared";
import {
  DEFAULT_PERIOD,
  PRESET_PERIOD_KEYS,
  normalizePeriod,
} from "../utils/period";

const STORAGE_KEY = "viisync-selected-period";

export function AnalyticsPeriodProvider({ children }) {
  const [selectedPeriod, setSelectedPeriodState] = useState(() => {
    if (typeof window === "undefined") {
      return DEFAULT_PERIOD;
    }

    return normalizePeriod(window.localStorage.getItem(STORAGE_KEY));
  });

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, selectedPeriod);
  }, [selectedPeriod]);

  const value = useMemo(() => {
    return {
      selectedPeriod,
      setSelectedPeriod(nextPeriod) {
        setSelectedPeriodState(normalizePeriod(nextPeriod));
      },
      availablePeriods: PRESET_PERIOD_KEYS,
    };
  }, [selectedPeriod]);

  return (
    <AnalyticsPeriodContext.Provider value={value}>
      {children}
    </AnalyticsPeriodContext.Provider>
  );
}

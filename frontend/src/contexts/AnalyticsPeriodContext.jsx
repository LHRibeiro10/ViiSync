import { useEffect, useMemo, useState } from "react";
import { AnalyticsPeriodContext } from "./AnalyticsPeriodContext.shared";

const STORAGE_KEY = "viisync-selected-period";
const DEFAULT_PERIOD = "30d";
const VALID_PERIODS = ["7d", "30d", "90d"];

function normalizePeriod(value) {
  return VALID_PERIODS.includes(value) ? value : DEFAULT_PERIOD;
}

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
      availablePeriods: VALID_PERIODS,
    };
  }, [selectedPeriod]);

  return (
    <AnalyticsPeriodContext.Provider value={value}>
      {children}
    </AnalyticsPeriodContext.Provider>
  );
}
import { createContext, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "viisync-selected-period";
const DEFAULT_PERIOD = "30d";
const VALID_PERIODS = ["7d", "30d", "90d"];

const AnalyticsPeriodContext = createContext(null);

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

export function useAnalyticsPeriod() {
  const context = useContext(AnalyticsPeriodContext);

  if (!context) {
    throw new Error("useAnalyticsPeriod must be used within AnalyticsPeriodProvider.");
  }

  return context;
}

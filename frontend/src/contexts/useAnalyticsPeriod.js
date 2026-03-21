import { useContext } from "react";
import { AnalyticsPeriodContext } from "./AnalyticsPeriodContext.shared";

export function useAnalyticsPeriod() {
  const context = useContext(AnalyticsPeriodContext);

  if (!context) {
    throw new Error("useAnalyticsPeriod must be used within AnalyticsPeriodProvider.");
  }

  return context;
}

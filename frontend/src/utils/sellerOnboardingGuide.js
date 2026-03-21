const STORAGE_KEY = "viisync-seller-onboarding";
const ONBOARDING_EVENT = "viisync:seller-onboarding-change";

function dispatchOnboardingEvent() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(ONBOARDING_EVENT));
}

export function startSellerOnboardingGuide() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      status: "active",
      stepId: "dashboard",
    })
  );
  dispatchOnboardingEvent();
}

export function resetSellerOnboardingGuide() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
  dispatchOnboardingEvent();
}
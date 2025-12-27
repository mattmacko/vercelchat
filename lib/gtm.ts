export type SignupSource = "signup_page" | "upgrade_flow";

const SIGNUP_SOURCE_KEY = "gtm_signup_source";

export function setSignupSource(source: SignupSource) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(SIGNUP_SOURCE_KEY, source);
  } catch (_error) {}
}

export function getSignupSource(): SignupSource | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const value = window.localStorage.getItem(SIGNUP_SOURCE_KEY);

    if (value === "signup_page" || value === "upgrade_flow") {
      return value;
    }
  } catch (_error) {}

  return null;
}

export function clearSignupSource() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(SIGNUP_SOURCE_KEY);
  } catch (_error) {}
}

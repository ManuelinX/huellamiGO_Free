const sessionStorageKey = "huellamigo:auth-session";

export function getStoredAuthSession() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawSession = window.localStorage.getItem(sessionStorageKey);
    return rawSession ? JSON.parse(rawSession) : null;
  } catch (error) {
    return null;
  }
}

export function setStoredAuthSession(session) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(sessionStorageKey, JSON.stringify(session));
  window.dispatchEvent(new CustomEvent("huellamigo:auth-session-change"));
}

export function clearStoredAuthSession() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(sessionStorageKey);
  window.dispatchEvent(new CustomEvent("huellamigo:auth-session-change"));
}

export function getAuthToken() {
  return getStoredAuthSession()?.token ?? null;
}

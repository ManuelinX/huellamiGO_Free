import { apiFetch } from "@/lib/api";
import { clearStoredAuthSession } from "@/lib/auth-session";

function storeAuthResponse(data) {
  return {
    token: data.token,
    user: data.user,
  };
}

export async function registerWithEmail({ email, password, displayName }) {
  const data = await apiFetch("/api/auth/register", {
    method: "POST",
    body: {
      email,
      password,
      displayName,
    },
  });

  return storeAuthResponse(data);
}

export async function loginWithEmail({ email, password }) {
  const data = await apiFetch("/api/auth/login", {
    method: "POST",
    body: {
      email,
      password,
    },
  });

  return storeAuthResponse(data);
}

export async function requestPasswordReset({ email }) {
  return apiFetch("/api/auth/password-reset/request", {
    method: "POST",
    body: {
      email,
    },
  });
}

export async function confirmPasswordReset({ token, password }) {
  const data = await apiFetch("/api/auth/password-reset/confirm", {
    method: "POST",
    body: {
      token,
      password,
    },
  });

  return storeAuthResponse(data);
}

export async function changePassword({ currentPassword, nextPassword }) {
  return apiFetch("/api/auth/password/change", {
    method: "POST",
    auth: true,
    body: {
      currentPassword,
      nextPassword,
    },
  });
}

export async function requestEmailVerification() {
  return apiFetch("/api/auth/email-verification/request", {
    method: "POST",
    auth: true,
  });
}

export async function confirmEmailVerification({ token }) {
  const data = await apiFetch("/api/auth/email-verification/confirm", {
    method: "POST",
    body: {
      token,
    },
  });

  return storeAuthResponse(data);
}

export async function getCurrentAuthUser() {
  const data = await apiFetch("/api/auth/me", {
    auth: true,
  });

  return data.user;
}

export function logout() {
  clearStoredAuthSession();
}

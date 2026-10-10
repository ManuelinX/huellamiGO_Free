import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LockKeyhole } from "lucide-react";

import {
  betaAccessCookieName,
  canGrantBetaAccess,
  createBetaAccessToken,
  getBetaAccessCookieOptions,
  isBetaShieldEnabled,
} from "@/beta-shield/server";

export const dynamic = "force-dynamic";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

async function redeemBetaInvite({ email, inviteCode }) {
  const response = await fetch(`${apiBaseUrl}/api/beta-invites/redeem`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      code: inviteCode,
    }),
    cache: "no-store",
  });

  return response.ok;
}

async function isPersistedBetaTester(email) {
  const response = await fetch(`${apiBaseUrl}/api/beta-invites/check-email`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    return false;
  }

  const payload = await response.json().catch(() => null);

  return Boolean(payload?.allowed);
}

async function grantBetaAccess(formData) {
  "use server";

  if (!isBetaShieldEnabled()) {
    redirect("/");
  }

  const email = formData.get("email")?.toString().trim().toLowerCase();
  const accessCode = formData.get("accessCode")?.toString().trim();
  const inviteCode = formData.get("invite")?.toString().trim();
  const nextPath = formData.get("next")?.toString() || "/";
  const hasInviteAccess = inviteCode
    ? await redeemBetaInvite({ email, inviteCode })
    : false;
  const hasPersistedTesterAccess = hasInviteAccess
    ? false
    : await isPersistedBetaTester(email);

  if (!hasInviteAccess && !hasPersistedTesterAccess && !canGrantBetaAccess({ email, accessCode })) {
    redirect(`/beta-access?error=denied${nextPath ? `&next=${encodeURIComponent(nextPath)}` : ""}`);
  }

  const cookieStore = await cookies();

  cookieStore.set(betaAccessCookieName, createBetaAccessToken(email), getBetaAccessCookieOptions());
  redirect(nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/");
}

export default async function BetaAccessPage({ searchParams }) {
  if (!isBetaShieldEnabled()) {
    redirect("/");
  }

  const params = await searchParams;
  const denied = params?.error === "denied";
  const nextPath = typeof params?.next === "string" ? params.next : "/";
  const inviteCode = typeof params?.invite === "string" ? params.invite : "";

  return (
    <main className="betaAccessPage">
      <section className="betaAccessPanel" aria-labelledby="beta-access-title">
        <div className="betaAccessIcon">
          <LockKeyhole size={24} />
        </div>
        <p className="eyebrow">Beta cerrada</p>
        <h1 id="beta-access-title">Acceso HuellamiGO</h1>
        <p>
          Escribe el correo invitado o el codigo beta para entrar a esta version.
        </p>

        <form className="authForm" action={grantBetaAccess}>
          <input name="next" type="hidden" value={nextPath} />
          <input name="invite" type="hidden" value={inviteCode} />

          <label>
            Correo
            <input autoComplete="email" name="email" placeholder="tu@email.com" type="email" required />
          </label>

          <label>
            Codigo beta
            <input
              autoComplete="one-time-code"
              disabled={Boolean(inviteCode)}
              name="accessCode"
              placeholder={inviteCode ? "QR beta detectado" : "Opcional si tu correo esta invitado"}
            />
          </label>

          <button className="primaryButton fullWidth" type="submit">
            Entrar a la beta
          </button>
        </form>

        {denied ? (
          <p className="formMessage">
            Ese correo o codigo no tiene acceso beta.
          </p>
        ) : null}
      </section>
    </main>
  );
}

"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { RefreshCcw } from "lucide-react";

import { generateBetaInvite, getActiveBetaInvite } from "@/lib/beta-invites";

function getInviteUrl(code) {
  if (!code || typeof window === "undefined") {
    return "";
  }

  const url = new URL("/beta-access", window.location.origin);
  url.searchParams.set("invite", code);

  return url.toString();
}

function getQrImageUrl(value) {
  if (!value) {
    return "";
  }

  const params = new URLSearchParams({
    size: "260x260",
    margin: "12",
    data: value,
  });

  return `https://api.qrserver.com/v1/create-qr-code/?${params.toString()}`;
}

function getRemainingSeconds(expiresAt) {
  if (!expiresAt) {
    return 0;
  }

  return Math.max(0, Math.ceil(expiresAt - (Date.now() / 1000)));
}

export function BetaQrAdminPanel() {
  const [invite, setInvite] = useState(null);
  const [error, setError] = useState("");
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [isPending, startTransition] = useTransition();
  const inviteUrl = useMemo(() => getInviteUrl(invite?.code), [invite?.code]);
  const qrImageUrl = useMemo(() => getQrImageUrl(inviteUrl), [inviteUrl]);

  useEffect(() => {
    let mounted = true;

    getActiveBetaInvite()
      .then((payload) => {
        if (mounted && payload.invite) {
          setInvite(payload.invite);
        }
      })
      .catch(() => {
        if (mounted) {
          setInvite(null);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const tick = () => {
      setRemainingSeconds(getRemainingSeconds(invite?.expiresAt));
    };

    tick();
    const interval = window.setInterval(tick, 1000);

    return () => window.clearInterval(interval);
  }, [invite?.expiresAt]);

  function regenerateInvite() {
    setError("");
    startTransition(async () => {
      try {
        const payload = await generateBetaInvite();
        setInvite(payload.invite);
      } catch (nextError) {
        setError(nextError.message || "No se pudo generar el QR beta.");
      }
    });
  }

  return (
    <main className="betaAccessPage">
      <section className="betaAccessPanel" aria-labelledby="beta-qr-title">
        <p className="eyebrow">Admin beta</p>
        <h1 id="beta-qr-title">QR de acceso beta</h1>
        <p>
          Genera un QR temporal. Dura 150 segundos y al regenerarlo se invalida el anterior.
        </p>

        {invite?.code && remainingSeconds > 0 ? (
          <div className="betaQrPreview">
            <img alt="QR beta temporal" src={qrImageUrl} />
            <p className="formMessage">Expira en {remainingSeconds}s</p>
            <code>{inviteUrl}</code>
          </div>
        ) : (
          <p className="formMessage">No hay QR activo.</p>
        )}

        <button className="primaryButton fullWidth" disabled={isPending} onClick={regenerateInvite} type="button">
          <RefreshCcw size={18} />
          {isPending ? "Generando..." : "Generar nuevo QR"}
        </button>

        {error ? (
          <p className="formMessage">{error}</p>
        ) : null}
      </section>
    </main>
  );
}

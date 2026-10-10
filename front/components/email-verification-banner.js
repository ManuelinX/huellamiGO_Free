"use client";

import { useState, useTransition } from "react";
import { MailCheck } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { requestEmailVerification } from "@/lib/auth";
import { getUserErrorMessage } from "@/lib/user-messages";

export function EmailVerificationNotice({
  className = "verificationBanner",
  text = "Confirma tu correo para aumentar la confianza de tus reportes.",
}) {
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleResend = () => {
    startTransition(async () => {
      setMessage("");

      try {
        const data = await requestEmailVerification();
        setMessage(data.verificationUrl
          ? `Enlace de prueba: ${data.verificationUrl}`
          : data.message || "Enviamos un nuevo enlace de verificación.");
      } catch (error) {
        setMessage(getUserErrorMessage(error, "No pudimos enviar el enlace de verificación."));
      }
    });
  };

  return (
    <section className={className} aria-label="Verificación de correo">
      <MailCheck size={20} />
      <div>
        <strong>Verifica tu correo</strong>
        <p>{message || text}</p>
      </div>
      <button disabled={isPending} onClick={handleResend} type="button">
        {isPending ? "Enviando..." : "Reenviar"}
      </button>
    </section>
  );
}

export function EmailVerificationBanner() {
  const { user } = useAuth();

  if (!user || user.emailVerified) {
    return null;
  }

  return <EmailVerificationNotice />;
}

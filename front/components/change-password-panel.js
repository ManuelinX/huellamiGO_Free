"use client";

import { useState, useTransition } from "react";
import { KeyRound } from "lucide-react";
import { changePassword } from "@/lib/auth";
import { PasswordInput } from "@/components/password-input";
import { getUserErrorMessage } from "@/lib/user-messages";

export function ChangePasswordPanel() {
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const currentPassword = formData.get("currentPassword")?.toString();
    const nextPassword = formData.get("nextPassword")?.toString();
    const confirmPassword = formData.get("confirmPassword")?.toString();

    if (!currentPassword || !nextPassword || !confirmPassword) {
      setMessage("Completa todos los campos.");
      return;
    }

    if (nextPassword.length < 6) {
      setMessage("La nueva contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (nextPassword !== confirmPassword) {
      setMessage("Las contraseñas no coinciden.");
      return;
    }

    startTransition(async () => {
      setMessage("");

      try {
        const data = await changePassword({
          currentPassword,
          nextPassword,
        });

        form.reset();
        setMessage(data.message || "Contraseña actualizada.");
      } catch (error) {
        setMessage(getUserErrorMessage(error, "No pudimos cambiar la contraseña."));
      }
    });
  };

  return (
    <form className="profileForm" onSubmit={handleSubmit}>
      <label>
        Contraseña actual
        <PasswordInput autoComplete="current-password" name="currentPassword" />
      </label>

      <label>
        Nueva contraseña
        <PasswordInput autoComplete="new-password" name="nextPassword" />
      </label>

      <label>
        Confirmar nueva contraseña
        <PasswordInput autoComplete="new-password" name="confirmPassword" />
      </label>

      <button className="primaryButton fullWidth" disabled={isPending} type="submit">
        <KeyRound size={18} />
        {isPending ? "Guardando..." : "Cambiar contraseña"}
      </button>

      {message ? <p className="formMessage">{message}</p> : null}
    </form>
  );
}

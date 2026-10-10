"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, KeyRound, LogIn, LogOut, Mail, UserPlus, X } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { PasswordInput } from "@/components/password-input";
import {
  confirmEmailVerification,
  confirmPasswordReset,
  loginWithEmail,
  registerWithEmail,
  requestEmailVerification,
  requestPasswordReset,
} from "@/lib/auth";
import { getUserErrorMessage } from "@/lib/user-messages";

export function AuthButton() {
  const { user, isAuthLoading, clearAuthSession, setAuthSession } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState("login");
  const [message, setMessage] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [verificationToken, setVerificationToken] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("resetToken");
    const emailToken = params.get("verifyEmailToken");

    if (token || emailToken) {
      clearAuthTokensFromUrl();
    }

    if (token) {
      setResetToken(token);
      setMode("reset");
      setIsOpen(true);
      return;
    }

    if (emailToken) {
      setVerificationToken(emailToken);
      setMode("verifyEmail");
      setIsOpen(true);
    }
  }, []);

  useEffect(() => {
    const handleOpenAuth = (event) => {
      setMode(event.detail?.mode === "register" ? "register" : "login");
      setMessage("");
      setIsOpen(true);
    };

    window.addEventListener("huellamigo:open-auth", handleOpenAuth);

    return () => {
      window.removeEventListener("huellamigo:open-auth", handleOpenAuth);
    };
  }, []);

  useEffect(() => {
    if (mode !== "verifyEmail" || !verificationToken) {
      return;
    }

    startTransition(async () => {
      setMessage("Verificando correo...");

      try {
        const nextSession = await confirmEmailVerification({ token: verificationToken });

        setAuthSession(nextSession);
        clearVerificationTokenFromUrl();
        setVerificationToken("");
        setMessage("Correo verificado.");
        closeModal();
      } catch (error) {
        setMessage(getUserErrorMessage(error, "No pudimos verificar tu correo. Solicita un enlace nuevo."));
      }
    });
  }, [mode, verificationToken]);

  const closeModal = () => {
    setIsOpen(false);
    setMessage("");
  };

  const clearAuthTokensFromUrl = () => {
    const url = new URL(window.location.href);

    url.searchParams.delete("resetToken");
    url.searchParams.delete("verifyEmailToken");
    window.history.replaceState({}, "", url.toString());
  };

  const clearResetTokenFromUrl = () => {
    const url = new URL(window.location.href);

    url.searchParams.delete("resetToken");
    window.history.replaceState({}, "", url.toString());
  };

  const clearVerificationTokenFromUrl = () => {
    const url = new URL(window.location.href);

    url.searchParams.delete("verifyEmailToken");
    window.history.replaceState({}, "", url.toString());
  };

  const handleSignOut = () => {
    startTransition(async () => {
      clearAuthSession();
    });
  };

  const handlePasswordResetRequest = (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = formData.get("email")?.toString().trim();

    if (!email) {
      setMessage("Escribe tu correo.");
      return;
    }

    startTransition(async () => {
      setMessage("");

      try {
        const data = await requestPasswordReset({ email });
        setMessage(data.resetUrl
          ? `Te dejamos el enlace de prueba: ${data.resetUrl}`
          : data.message || "Si el correo existe, enviaremos instrucciones.");
      } catch (error) {
        setMessage(getUserErrorMessage(error, "No pudimos enviar el enlace de recuperación."));
      }
    });
  };

  const handlePasswordResetConfirm = (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const password = formData.get("password")?.toString();
    const confirmPassword = formData.get("confirmPassword")?.toString();

    if (!resetToken || !password || !confirmPassword) {
      setMessage("Completa la nueva contraseña.");
      return;
    }

    if (password.length < 6) {
      setMessage("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Las contraseñas no coinciden.");
      return;
    }

    startTransition(async () => {
      setMessage("");

      try {
        const nextSession = await confirmPasswordReset({ token: resetToken, password });

        setAuthSession(nextSession);
        clearResetTokenFromUrl();
        setResetToken("");
        closeModal();
      } catch (error) {
        setMessage(getUserErrorMessage(error, "No pudimos cambiar la contraseña."));
      }
    });
  };

  const handleEmailVerificationConfirm = () => {
    if (!verificationToken) {
      setMessage("El enlace de verificación no está completo.");
      return;
    }

    startTransition(async () => {
      setMessage("");

      try {
        const nextSession = await confirmEmailVerification({ token: verificationToken });

        setAuthSession(nextSession);
        clearVerificationTokenFromUrl();
        setVerificationToken("");
        closeModal();
      } catch (error) {
        setMessage(getUserErrorMessage(error, "No pudimos verificar tu correo. Solicita un enlace nuevo."));
      }
    });
  };

  const handleResendVerification = () => {
    startTransition(async () => {
      setMessage("");

      try {
        const data = await requestEmailVerification();
        setMessage(data.verificationUrl
          ? `Te dejamos el enlace de prueba: ${data.verificationUrl}`
          : data.message || "Enviamos un nuevo enlace de verificación.");
      } catch (error) {
        setMessage(getUserErrorMessage(error, "No pudimos enviar el enlace de verificación."));
      }
    });
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = formData.get("email")?.toString().trim();
    const password = formData.get("password")?.toString();
    const displayName = formData.get("displayName")?.toString().trim();

    if (!email || !password) {
      setMessage("Escribe correo y contraseña.");
      return;
    }

    if (password.length < 6) {
      setMessage("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    startTransition(async () => {
      setMessage("");

      try {
        const nextSession = mode === "register"
          ? await registerWithEmail({ email, password, displayName })
          : await loginWithEmail({ email, password });

        setAuthSession(nextSession);
        if (mode === "register" && !nextSession.user?.emailVerified) {
          setMode("verificationSent");
          setMessage("Te enviamos un enlace para verificar tu correo.");
          return;
        }

        closeModal();
      } catch (error) {
        setMessage(getUserErrorMessage(error, mode === "register"
          ? "No pudimos crear la cuenta. Intenta de nuevo."
          : "No pudimos iniciar sesión. Revisa tus datos."));
      }
    });
  };

  if (user) {
    return (
      <button className="authButton" disabled={isPending} onClick={handleSignOut} type="button">
        <LogOut size={17} />
        Salir
      </button>
    );
  }

  return (
    <>
      <button
        className="authButton authButtonPrimary"
        disabled={isAuthLoading}
        onClick={() => setIsOpen(true)}
        type="button"
      >
        <UserPlus size={17} />
        <span className="authLabelDesktop">Iniciar sesión / Registrarme</span>
        <span className="authLabelMobile">Entrar</span>
      </button>

      {isOpen ? createPortal((
        <div className="authOverlay" role="presentation">
          <section className="authModal" aria-labelledby="auth-title" role="dialog" aria-modal="true">
            <div className="authModalHeader">
              <div>
                <p className="eyebrow">
                  {mode === "register"
                    ? "Registro"
                    : mode === "forgot"
                      ? "Recuperacion"
                      : mode === "reset"
                        ? "Nueva contraseña"
                        : mode === "verifyEmail" || mode === "verificationSent"
                          ? "Verificación"
                          : "Acceso"}
                </p>
                <h2 id="auth-title">
                  {mode === "register"
                    ? "Crear cuenta"
                    : mode === "forgot"
                      ? "Recuperar acceso"
                      : mode === "reset"
                        ? "Restablecer contraseña"
                        : mode === "verifyEmail"
                          ? "Verificar correo"
                          : mode === "verificationSent"
                            ? "Revisa tu correo"
                            : "Entrar a HuellamiGO"}
                </h2>
              </div>
              <button className="ghostIcon" onClick={closeModal} type="button" aria-label="Cerrar">
                <X size={19} />
              </button>
            </div>

            {mode === "verifyEmail" ? (
              <div className="authForm">
                <p className="authHelp">Confirma tu correo para marcar tu cuenta como verificada.</p>
                <button className="primaryButton fullWidth" disabled={isPending} onClick={handleEmailVerificationConfirm} type="button">
                  <CheckCircle2 size={18} />
                  {isPending ? "Verificando..." : "Verificar correo"}
                </button>
              </div>
            ) : mode === "verificationSent" ? (
              <div className="authForm">
                <p className="authHelp">Te enviamos un enlace de verificación. Abre tu correo para completar el proceso.</p>
                <button className="primaryButton fullWidth" disabled={isPending} onClick={handleResendVerification} type="button">
                  <Mail size={18} />
                  {isPending ? "Enviando..." : "Reenviar enlace"}
                </button>
              </div>
            ) : mode === "forgot" ? (
              <form className="authForm" onSubmit={handlePasswordResetRequest}>
                <label>
                  Correo
                  <input autoComplete="email" name="email" placeholder="tu@email.com" type="email" />
                </label>

                <button className="primaryButton fullWidth" disabled={isPending} type="submit">
                  <Mail size={18} />
                  {isPending ? "Enviando..." : "Enviar enlace"}
                </button>
              </form>
            ) : mode === "reset" ? (
              <form className="authForm" onSubmit={handlePasswordResetConfirm}>
                <label>
                  Nueva contraseña
                  <PasswordInput autoComplete="new-password" name="password" />
                </label>

                <label>
                  Confirmar contraseña
                  <PasswordInput autoComplete="new-password" name="confirmPassword" />
                </label>

                <button className="primaryButton fullWidth" disabled={isPending} type="submit">
                  <KeyRound size={18} />
                  {isPending ? "Guardando..." : "Cambiar contraseña"}
                </button>
              </form>
            ) : (
              <form className="authForm" onSubmit={handleSubmit}>
                {mode === "register" ? (
                  <label>
                    Nombre visible
                    <input autoComplete="name" name="displayName" placeholder="Ej. Alex" />
                  </label>
                ) : null}

                <label>
                  Correo
                  <input autoComplete="email" name="email" placeholder="tu@email.com" type="email" />
                </label>

                <label>
                  Contraseña
                  <PasswordInput autoComplete={mode === "register" ? "new-password" : "current-password"} name="password" />
                </label>

                <button className="primaryButton fullWidth" disabled={isPending} type="submit">
                  {mode === "register" ? <UserPlus size={18} /> : <LogIn size={18} />}
                  {isPending ? "Procesando..." : mode === "register" ? "Registrarme" : "Entrar"}
                </button>
              </form>
            )}

            {message ? <p className="formMessage">{message}</p> : null}

            <div className="authLinks">
              {mode === "login" ? (
                <button
                  className="authSwitch"
                  onClick={() => {
                    setMode("forgot");
                    setMessage("");
                  }}
                  type="button"
                >
                  Olvidé mi contraseña
                </button>
              ) : null}

              {mode !== "reset" && mode !== "verifyEmail" && mode !== "verificationSent" ? (
                <button
                  className="authSwitch"
                  onClick={() => {
                    setMode(mode === "register" ? "login" : "register");
                    setMessage("");
                  }}
                  type="button"
                >
                  {mode === "register" ? "Ya tengo cuenta" : "Crear cuenta nueva"}
                </button>
              ) : null}

              {mode === "forgot" || mode === "reset" || mode === "verifyEmail" || mode === "verificationSent" ? (
                <button
                  className="authSwitch"
                  onClick={() => {
                    setMode("login");
                    setMessage("");
                    setResetToken("");
                    setVerificationToken("");
                    clearResetTokenFromUrl();
                    clearVerificationTokenFromUrl();
                  }}
                  type="button"
                >
                  Volver a entrar
                </button>
              ) : null}
            </div>
          </section>
        </div>
      ), document.body) : null}
    </>
  );
}

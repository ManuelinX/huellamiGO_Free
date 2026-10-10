"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Bell, CheckCircle2, KeyRound, Mail, QrCode, ShieldCheck, UserRound } from "lucide-react";
import { ChangePasswordPanel } from "@/components/change-password-panel";
import { ProfileEditPanel } from "@/components/profile-edit-panel";
import { NotificationPreferencesPanel } from "@/components/notification-preferences-panel";
import { useAuth } from "@/components/auth-provider";
import { getProfile } from "@/lib/profile";

export default function ProfilePage() {
  const { user, isAuthLoading } = useAuth();
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }

    let mounted = true;

    getProfile()
      .then((nextProfile) => {
        if (mounted) {
          setProfile(nextProfile);
        }
      })
      .catch(() => {
        if (mounted) {
          setProfile(null);
        }
      });

    return () => {
      mounted = false;
    };
  }, [user]);

  if (isAuthLoading) {
    return (
      <main className="profilePage">
        <div className="profileState">
          <UserRound size={22} />
          <p>Cargando perfil...</p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="profilePage">
        <Link className="detailNav" href="/">
          <ArrowLeft size={18} />
          Volver
        </Link>
        <section className="profileHero">
          <div>
            <p className="eyebrow">Cuenta</p>
            <h1>Perfil</h1>
            <p>Inicia sesión para configurar tus notificaciones y datos de cuenta.</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="profilePage">
      <Link className="detailNav" href="/">
        <ArrowLeft size={18} />
        Volver
      </Link>

      <section className="profileHero">
        <div>
          <p className="eyebrow">Cuenta</p>
          <h1>Perfil</h1>
          <p>Gestiona tus datos y la forma en que HuellamiGO te avisa sobre actividad importante.</p>
        </div>
        <div className="profileAvatar" aria-hidden="true">
          {profile?.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : <UserRound size={34} />}
        </div>
      </section>

      <section className="profileGrid">
        <article className="profilePanel">
          <div className="profilePanelHead">
            <div>
              <p className="eyebrow">Datos</p>
              <h2>Cuenta</h2>
            </div>
            <ShieldCheck size={21} />
          </div>

          <dl className="profileFacts">
            <div>
              <dt>Nombre</dt>
              <dd>{user.displayName || "Sin nombre visible"}</dd>
            </div>
            <div>
              <dt>Correo</dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt>Verificación</dt>
              <dd>
                {user.emailVerified ? (
                  <>
                    <CheckCircle2 size={16} />
                    Correo verificado
                  </>
                ) : (
                  <>
                    <Mail size={16} />
                    Pendiente
                  </>
                )}
              </dd>
            </div>
          </dl>

          <ProfileEditPanel />
        </article>

        {user.isBetaInviteAdmin ? (
          <article className="profilePanel">
            <div className="profilePanelHead">
              <div>
                <p className="eyebrow">Admin beta</p>
                <h2>Acceso QR</h2>
              </div>
              <QrCode size={21} />
            </div>

            <p className="authHelp">
              Genera un QR temporal para invitar testers a la beta cerrada.
            </p>

            <Link className="primaryButton fullWidth" href="/admin/beta-qr">
              Abrir generador QR
            </Link>
          </article>
        ) : null}

        <article className="profilePanel">
          <div className="profilePanelHead">
            <div>
              <p className="eyebrow">Alertas</p>
              <h2>Notificaciones</h2>
            </div>
            <Bell size={21} />
          </div>

          <NotificationPreferencesPanel />
        </article>

        <article className="profilePanel">
          <div className="profilePanelHead">
            <div>
              <p className="eyebrow">Seguridad</p>
              <h2>Contraseña</h2>
            </div>
            <KeyRound size={21} />
          </div>

          <ChangePasswordPanel />
        </article>
      </section>
    </main>
  );
}

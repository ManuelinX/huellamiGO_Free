"use client";

import { useEffect, useState, useTransition } from "react";
import { Camera, RefreshCw, Save, UserRound } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { getProfile, updateProfile, uploadProfileAvatar } from "@/lib/profile";
import { getUserErrorMessage } from "@/lib/user-messages";

function getProfileForm(profile, user) {
  return {
    displayName: profile?.displayName ?? user?.displayName ?? "",
    city: profile?.city ?? "",
    state: profile?.state ?? "",
    phone: profile?.phone ?? "",
    bio: profile?.bio ?? "",
  };
}

export function ProfileEditPanel() {
  const { user, session, setAuthSession } = useAuth();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(() => getProfileForm(null, user));
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const loadProfile = () => {
    startTransition(async () => {
      setMessage("");

      try {
        const nextProfile = await getProfile();
        setProfile(nextProfile);
        setForm(getProfileForm(nextProfile, user));
      } catch (error) {
        setMessage(getUserErrorMessage(error, "No pudimos cargar tu perfil."));
      }
    });
  };

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  const syncSessionUser = (nextProfile) => {
    if (!session?.token || !session?.user) {
      return;
    }

    setAuthSession({
      token: session.token,
      user: {
        ...session.user,
        displayName: nextProfile.displayName,
        username: nextProfile.username ?? session.user.username,
      },
    });
  };

  const updateField = (field, value) => {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    startTransition(async () => {
      setMessage("");

      try {
        const nextProfile = await updateProfile(form);
        setProfile(nextProfile);
        setForm(getProfileForm(nextProfile, user));
        syncSessionUser(nextProfile);
        setMessage("Perfil actualizado.");
      } catch (error) {
        setMessage(getUserErrorMessage(error, "No pudimos actualizar tu perfil."));
      }
    });
  };

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    startTransition(async () => {
      setMessage("");

      try {
        const nextProfile = await uploadProfileAvatar(file);
        setProfile(nextProfile);
        setForm(getProfileForm(nextProfile, user));
        setMessage("Foto de perfil actualizada.");
      } catch (error) {
        setMessage(getUserErrorMessage(error, "No pudimos actualizar la foto."));
      } finally {
        event.target.value = "";
      }
    });
  };

  return (
    <div className="profileEdit">
      <div className="profileAvatarEditor">
        <div className="profileAvatarPreview">
          {profile?.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : <UserRound size={30} />}
        </div>
        <label className="ghostTextButton">
          <Camera size={16} />
          Cambiar foto
          <input accept="image/*" disabled={isPending} onChange={handleAvatarChange} type="file" />
        </label>
        <small>Maximo 32KB. HuellamiGO la optimiza a WebP.</small>
      </div>

      <form className="profileForm" onSubmit={handleSubmit}>
        <label>
          Nombre visible
          <input
            maxLength={80}
            name="displayName"
            onChange={(event) => updateField("displayName", event.target.value)}
            required
            value={form.displayName}
          />
        </label>

        <div className="profileFormGrid">
          <label>
            Ciudad
            <input
              name="city"
              onChange={(event) => updateField("city", event.target.value)}
              value={form.city}
            />
          </label>

          <label>
            Estado
            <input
              name="state"
              onChange={(event) => updateField("state", event.target.value)}
              value={form.state}
            />
          </label>
        </div>

        <label>
          Teléfono opcional
          <input
            maxLength={40}
            name="phone"
            onChange={(event) => updateField("phone", event.target.value)}
            value={form.phone}
          />
        </label>

        <label>
          Bio opcional
          <textarea
            maxLength={240}
            name="bio"
            onChange={(event) => updateField("bio", event.target.value)}
            rows={4}
            value={form.bio}
          />
        </label>

        <div className="profileFormActions">
          <button className="primaryButton" disabled={isPending} type="submit">
            <Save size={18} />
            {isPending ? "Guardando..." : "Guardar cambios"}
          </button>
          <button className="ghostTextButton" disabled={isPending} onClick={loadProfile} type="button">
            <RefreshCw size={16} />
            Recargar
          </button>
        </div>

        {message ? <p className="formMessage">{message}</p> : null}
      </form>
    </div>
  );
}

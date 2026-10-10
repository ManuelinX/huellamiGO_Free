"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Send, X } from "lucide-react";
import { LocationPicker } from "@/components/location-picker";
import { preparePhotoState } from "@/lib/image-processing";
import { createSighting } from "@/lib/sightings";
import { getUserErrorMessage, userMessages } from "@/lib/user-messages";
import { EmailVerificationNotice } from "@/components/email-verification-banner";
import { useAuth } from "@/components/auth-provider";

const delayMs = 60 * 1000;
const storagePrefix = "huellamigo:last-sighting:";

export function SightingForm({ reportId, petName }) {
  const [message, setMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const photoInputRef = useRef(null);
  const locationRef = useRef(null);
  const [isPending, startTransition] = useTransition();
  const { user, isAuthLoading } = useAuth();
  const router = useRouter();

  const openAuthModal = () => {
    window.dispatchEvent(new CustomEvent("huellamigo:open-auth", {
      detail: { mode: "login" },
    }));
  };

  const setValidationError = (field, nextMessage, targetRef) => {
    setFieldErrors({ [field]: nextMessage });
    setMessage("");
    targetRef?.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  };

  useEffect(() => {
    return () => {
      if (selectedPhoto?.previewUrl) {
        URL.revokeObjectURL(selectedPhoto.previewUrl);
      }
    };
  }, [selectedPhoto]);

  const handlePhotoChange = async (event) => {
    const [file] = Array.from(event.target.files ?? []).filter((item) =>
      item.type.startsWith("image/"),
    );

    if (!file) {
      event.target.value = "";
      return;
    }

    try {
      setMessage(userMessages.imagePreparing);
      const preparedPhoto = await preparePhotoState(file);

      setSelectedPhoto((currentPhoto) => {
        if (currentPhoto?.previewUrl) {
          URL.revokeObjectURL(currentPhoto.previewUrl);
        }

        return {
          file: preparedPhoto.file,
          previewUrl: preparedPhoto.previewUrl,
        };
      });
      event.target.value = "";
      setMessage("Foto lista para enviar con tu Lo vi.");
    } catch (error) {
      event.target.value = "";
      setMessage(userMessages.imageFailed);
    }
  };

  const removePhoto = () => {
    setSelectedPhoto((currentPhoto) => {
      if (currentPhoto?.previewUrl) {
        URL.revokeObjectURL(currentPhoto.previewUrl);
      }

      return null;
    });

    if (photoInputRef.current) {
      photoInputRef.current.value = "";
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setFieldErrors({});

    if (isAuthLoading) {
      setMessage(userMessages.sessionChecking);
      return;
    }

    if (!user) {
      setMessage("Inicia sesión para enviar un Lo vi.");
      openAuthModal();
      return;
    }

    if (!user.emailVerified) {
      setMessage("Verifica tu correo para enviar un Lo vi.");
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    const honeypot = formData.get("website")?.toString().trim();
    const sightingLatValue = formData.get("sightingLat")?.toString();
    const sightingLngValue = formData.get("sightingLng")?.toString();
    const lat = Number(sightingLatValue);
    const lng = Number(sightingLngValue);

    if (honeypot) {
      setMessage("Lo vi enviado. Gracias por ayudar.");
      return;
    }

    const storageKey = `${storagePrefix}${reportId}`;
    const lastSentAt = Number(window.localStorage.getItem(storageKey) ?? 0);
    const remainingMs = delayMs - (Date.now() - lastSentAt);

    if (remainingMs > 0) {
      const seconds = Math.ceil(remainingMs / 1000);
      setMessage(`Espera ${seconds} segundos antes de enviar otro Lo vi.`);
      return;
    }

    if (
      !sightingLatValue ||
      !sightingLngValue ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng)
    ) {
      setValidationError("location", userMessages.locationRequired, locationRef);
      return;
    }

    const comment = formData.get("sightingComment")?.toString().trim() || null;
    const contactName = formData.get("sightingContactName")?.toString().trim() || null;
    const photo = selectedPhoto?.file ?? null;
    const hasPhoto = Boolean(photo);
    const trustScore = Math.min(
      100,
      35 + (hasPhoto ? 25 : 0) + (comment ? 15 : 0) + (contactName ? 10 : 0),
    );

    startTransition(async () => {
      try {
        await createSighting({
          reportId,
          lat,
          lng,
          comment,
          contactName,
          photo,
          trustScore,
        });
        window.localStorage.setItem(storageKey, Date.now().toString());
        form.reset();
        removePhoto();
        setMessage("Lo vi enviado. Gracias por ayudar.");
        router.refresh();
      } catch (error) {
        setMessage(getUserErrorMessage(error, "No pudimos enviar tu Lo vi. Intenta de nuevo."));
      }
    });
  };

  return (
    <form className="sightingForm" onSubmit={handleSubmit}>
      {!user ? (
        <div className="reportAuthNotice">
          <div>
            <strong>Necesitas una cuenta para enviar un Lo vi.</strong>
            <span>Puedes llenar el aviso; al iniciar sesión no se borrarán tus datos.</span>
          </div>
          <button className="secondaryButton" onClick={openAuthModal} type="button">
            Iniciar sesión / Registrarme
          </button>
        </div>
      ) : null}

      {user && !user.emailVerified ? (
        <EmailVerificationNotice
          className="reportAuthNotice"
          text="Verifica tu correo para enviar avisos a la familia. Puedes seguir llenando el formulario."
        />
      ) : null}

      <div>
        <p className="eyebrow">La vi</p>
        <h2>Enviar Lo vi de {petName}</h2>
        <p>
          Marca una zona aproximada, agrega una pista corta y una foto solo si puedes
          hacerlo sin acercarte ni ponerte en riesgo.
        </p>
      </div>

      <div ref={locationRef}>
        <LocationPicker
          inputNames={{ lat: "sightingLat", lng: "sightingLng" }}
          markerLabel="Lo vi"
          onPositionChange={() => setFieldErrors((currentErrors) => ({ ...currentErrors, location: "" }))}
          requireSelection
          title="Donde la viste"
        />
        {fieldErrors.location ? <p className="fieldError">{fieldErrors.location}</p> : null}
      </div>

      <label className="honeypotField">
        Sitio web
        <input autoComplete="off" name="website" tabIndex="-1" />
      </label>

      <label>
        Pista opcional
        <textarea
          name="sightingComment"
          placeholder="Ej. Iba caminando hacia la avenida, parecia asustada."
        />
      </label>

      <div className="formGrid">
        <label>
          Tu nombre opcional
          <input name="sightingContactName" placeholder="Para que la familia ubique tu aviso" />
        </label>
        <label className="fileLine">
          <Camera size={18} />
          {selectedPhoto ? "Cambiar foto" : "Foto opcional"}
          <input
            accept="image/*"
            name="sightingPhoto"
            onChange={handlePhotoChange}
            ref={photoInputRef}
            type="file"
          />
        </label>
      </div>

      {selectedPhoto ? (
        <article className="sightingPhotoPreview">
          <img src={selectedPhoto.previewUrl} alt="" />
          <div>
            <strong>Foto del Lo vi</strong>
            <p>Se enviará junto con tu ubicación aproximada.</p>
            <button
              className="secondaryButton"
              disabled={isPending}
              onClick={removePhoto}
              type="button"
            >
              <X size={17} />
              Quitar foto
            </button>
          </div>
        </article>
      ) : null}

      <button className="primaryButton fullWidth" disabled={isPending} type="submit">
        <Send size={18} />
        {isPending
          ? "Enviando..."
          : !user
            ? "Iniciar sesión y avisar"
            : !user.emailVerified
              ? "Verifica tu correo para avisar"
              : "Enviar Lo vi"}
      </button>

      {message ? <p className="formMessage">{message}</p> : null}
    </form>
  );
}

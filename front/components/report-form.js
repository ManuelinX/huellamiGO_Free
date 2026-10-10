"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LockKeyhole, Send, UploadCloud } from "lucide-react";
import { createLostPetReport, uploadPetPhoto } from "@/lib/reports";
import { preparePhotoState } from "@/lib/image-processing";
import { getUserErrorMessage, userMessages } from "@/lib/user-messages";
import { EmailVerificationNotice } from "@/components/email-verification-banner";
import { LocationPicker } from "@/components/location-picker";
import { useAuth } from "@/components/auth-provider";

const minimumRewardAmount = 10;
const shortFieldMaxLength = 32;
const descriptionMaxLength = 128;

export function ReportForm() {
  const [message, setMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [manageUrl, setManageUrl] = useState("");
  const [managePath, setManagePath] = useState("");
  const [photoState, setPhotoState] = useState(null);
  const [rewardEnabled, setRewardEnabled] = useState(false);
  const [rewardShowAmount, setRewardShowAmount] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { user, isAuthLoading } = useAuth();
  const router = useRouter();
  const detailsRef = useRef(null);
  const locationRef = useRef(null);
  const photoRef = useRef(null);
  const rewardRef = useRef(null);

  const setValidationErrors = (nextErrors, targetRef) => {
    setFieldErrors(nextErrors);
    setMessage("");
    targetRef?.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  };

  const openAuthModal = () => {
    window.dispatchEvent(new CustomEvent("huellamigo:open-auth", {
      detail: { mode: "login" },
    }));
  };

  useEffect(() => {
    return () => {
      if (photoState?.previewUrl) {
        URL.revokeObjectURL(photoState.previewUrl);
      }
    };
  }, [photoState]);

  const handlePhotoChange = async (event) => {
    setFieldErrors((currentErrors) => ({ ...currentErrors, photo: "" }));
    const file = event.target.files?.[0];

    if (!file) {
      setPhotoState(null);
      return;
    }

    if (!file.type.startsWith("image/")) {
      setPhotoState(null);
      setMessage(userMessages.imageInvalid);
      return;
    }

    try {
      setMessage(userMessages.imagePreparing);
      const nextPhotoState = await preparePhotoState(file);
      setPhotoState(nextPhotoState);
      setMessage(nextPhotoState.message);
    } catch (error) {
      setPhotoState(null);
      setMessage(userMessages.imageFailed);
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
      setMessage("Inicia sesión para publicar un reporte.");
      openAuthModal();
      return;
    }

    if (!user.emailVerified) {
      setMessage("Verifica tu correo para publicar un reporte.");
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    const rewardAmount = Number(formData.get("rewardAmount"));
    const wantsRewardAmount = formData.get("rewardShowAmount") === "on";
    const lastSeenLatValue = formData.get("lastSeenLat")?.toString();
    const lastSeenLngValue = formData.get("lastSeenLng")?.toString();

    const report = {
      pet_name: formData.get("petName")?.toString().trim(),
      pet_type: formData.get("petType")?.toString(),
      description: formData.get("description")?.toString().trim(),
      zone: formData.get("zone")?.toString().trim(),
      last_seen_place: formData.get("lastSeenPlace")?.toString().trim(),
      last_seen_lat: Number(lastSeenLatValue),
      last_seen_lng: Number(lastSeenLngValue),
      reward_enabled: formData.get("rewardEnabled") === "on",
      reward_show_amount:
        wantsRewardAmount &&
        rewardAmount >= minimumRewardAmount,
      reward_amount:
        rewardAmount >= minimumRewardAmount
          ? rewardAmount
          : null,
      reward_currency: "MXN",
      contact_name: formData.get("contactName")?.toString().trim() || null,
      preferred_contact: formData.get("preferredContact")?.toString(),
      contact_value: formData.get("contactValue")?.toString().trim() || null,
      public_whatsapp: formData.get("publicWhatsapp") === "on",
      is_vulnerable: formData.get("isVulnerable") === "on",
      is_urgent: formData.get("isUrgent") === "on",
      needs_medication: formData.get("needsMedication") === "on",
      pet_life_stage: formData.get("petLifeStage")?.toString() || "adult",
      status: "active",
    };
    const photo = photoState?.file ?? formData.get("photo");
    const nextErrors = {};
    let firstErrorRef = null;
    const addError = (field, nextMessage, targetRef) => {
      nextErrors[field] = nextMessage;
      firstErrorRef ??= targetRef;
    };

    if (wantsRewardAmount && rewardAmount < minimumRewardAmount) {
      addError("rewardAmount", `El monto mínimo para mostrar recompensa es $${minimumRewardAmount} MXN.`, rewardRef);
    }

    if (!report.pet_name) {
      addError("petName", "Agrega el nombre de la mascota.", detailsRef);
    }

    if (!report.pet_type) {
      addError("petType", "Selecciona el tipo de mascota.", detailsRef);
    }

    if (!report.zone) {
      addError("zone", "Agrega la zona donde se perdió.", detailsRef);
    }

    if (!report.last_seen_place) {
      addError("lastSeenPlace", "Agrega el lugar donde se vio por última vez.", detailsRef);
    }

    const fieldsToValidate = [
      report.pet_name,
      report.pet_type,
      report.zone,
      report.last_seen_place,
    ];

    if (fieldsToValidate.some((value) => value && value.length > shortFieldMaxLength)) {
    //if (fieldsToValidate.some((value) => value.length > shortFieldMaxLength)) {
      addError("details", `Nombre, tipo, zona y lugar deben tener máximo ${shortFieldMaxLength} caracteres.`, detailsRef);
    }

    if (report.description && report.description.length > descriptionMaxLength) {
      addError("description", `La descripción debe tener máximo ${descriptionMaxLength} caracteres.`, detailsRef);
    }

    if (
      !lastSeenLatValue ||
      !lastSeenLngValue ||
      !Number.isFinite(report.last_seen_lat) ||
      !Number.isFinite(report.last_seen_lng)
    ) {
      addError("location", userMessages.locationRequired, locationRef);
    }

    if (!(photo instanceof File) || photo.size === 0) {
      addError("photo", "Agrega una foto clara de la mascota para publicar el reporte.", photoRef);
    }

    if (Object.keys(nextErrors).length > 0) {
      setValidationErrors(nextErrors, firstErrorRef);
      return;
    }

    startTransition(async () => {
      try {
        const photoUrl = photo instanceof File ? await uploadPetPhoto(photo) : null;
        const createdReport = await createLostPetReport({
          ...report,
          photo_url: photoUrl,
        });
        const nextManagePath = `/gestionar/${createdReport.id}#token=${createdReport.manageToken}`;
        const nextManageUrl = `${window.location.origin}${nextManagePath}`;
        form.reset();
        setPhotoState(null);
        setRewardEnabled(false);
        setRewardShowAmount(false);
        setManagePath(nextManagePath);
        setManageUrl(nextManageUrl);
        setMessage("Reporte publicado. Guarda tu link privado de gestión.");
        router.refresh();
      } catch (error) {
        setMessage(getUserErrorMessage(error, "No pudimos publicar el reporte. Intenta de nuevo."));
      }
    });
  };

  return (
    <form className="reportCard" onSubmit={handleSubmit} noValidate>
      {!user ? (
        <div className="reportAuthNotice">
          <div>
            <strong>Necesitas una cuenta para publicar.</strong>
            <span>Puedes llenar el reporte; al iniciar sesión no se borrarán tus datos.</span>
          </div>
          <button className="secondaryButton" onClick={openAuthModal} type="button">
            Iniciar sesión / Registrarme
          </button>
        </div>
      ) : null}

      {user && !user.emailVerified ? (
        <EmailVerificationNotice
          className="reportAuthNotice"
          text="Verifica tu correo para publicar reportes. Puedes seguir llenando el formulario."
        />
      ) : null}

      <section className="reportStep isEssential" aria-labelledby="report-step-details" ref={detailsRef}>
        <div className="reportStepHead">
          <span>1</span>
          <div>
            <h3 id="report-step-details">Datos y ubicación</h3>
            <p>Lo mínimo para ubicar el reporte en el mapa.</p>
          </div>
        </div>

        <div className="formGrid">
          <label>
            Nombre de la mascota
            <input
              maxLength={shortFieldMaxLength}
              name="petName"
              onInput={() => setFieldErrors((currentErrors) => ({ ...currentErrors, petName: "", details: "" }))}
              placeholder="Firulais"
              required
            />
            {fieldErrors.petName ? <span className="fieldError">{fieldErrors.petName}</span> : null}
          </label>
          <label>
            Tipo de mascota
            <select
              defaultValue=""
              name="petType"
              onChange={() => setFieldErrors((currentErrors) => ({ ...currentErrors, petType: "", details: "" }))}
              required
            >
              <option disabled value="">Selecciona una opción</option>
              <option>Perra</option>
              <option>Perro</option>
              <option>Gato</option>
              <option>Otro</option>
            </select>
            {fieldErrors.petType ? <span className="fieldError">{fieldErrors.petType}</span> : null}
          </label>
          <label>
            Zona donde se perdió
            <input
              maxLength={shortFieldMaxLength}
              name="zone"
              onInput={() => setFieldErrors((currentErrors) => ({ ...currentErrors, zone: "", details: "" }))}
              placeholder="Colonia Centro"
              required
            />
            {fieldErrors.zone ? <span className="fieldError">{fieldErrors.zone}</span> : null}
          </label>
          <label>
            Lugar donde se vio por última vez
            <input
              maxLength={shortFieldMaxLength}
              name="lastSeenPlace"
              onInput={() => setFieldErrors((currentErrors) => ({ ...currentErrors, lastSeenPlace: "", details: "" }))}
              placeholder="Cerca del parque"
              required
            />
            {fieldErrors.lastSeenPlace ? <span className="fieldError">{fieldErrors.lastSeenPlace}</span> : null}
          </label>
          <label className="wideField">
            Descripción
            <textarea
              maxLength={descriptionMaxLength}
              name="description"
              onInput={() => setFieldErrors((currentErrors) => ({ ...currentErrors, description: "" }))}
              placeholder="Tamaño mediano, collar rojo, responde a su nombre."
            />
            {fieldErrors.description ? <span className="fieldError">{fieldErrors.description}</span> : null}
          </label>
        </div>
        {fieldErrors.details ? <p className="fieldError">{fieldErrors.details}</p> : null}

        <div ref={locationRef}>
          <LocationPicker
            onPositionChange={() => setFieldErrors((currentErrors) => ({ ...currentErrors, location: "" }))}
            requireSelection
          />
          {fieldErrors.location ? <p className="fieldError">{fieldErrors.location}</p> : null}
        </div>
      </section>

      <section className="reportStep" aria-labelledby="report-step-photo" ref={photoRef}>
        <div className="reportStepHead">
          <span>2</span>
          <div>
            <h3 id="report-step-photo">Foto para reconocerla</h3>
            <p>Una imagen clara ayuda más que una descripción larga.</p>
          </div>
        </div>

        <label className="uploadDrop">
          <UploadCloud size={32} />
          <strong>Foto de la mascota</strong>
          <span>Obligatoria para publicar y ayudar a verificar el reporte.</span>
          <input type="file" accept="image/*" name="photo" onChange={handlePhotoChange} required />
        </label>
        {fieldErrors.photo ? <p className="fieldError">{fieldErrors.photo}</p> : null}
        {photoState ? (
          <div className="photoPreview">
            <img src={photoState.previewUrl} alt="Vista previa de la foto" />
            <div>
              <strong>Foto lista</strong>
              <p>{photoState.message}</p>
            </div>
          </div>
        ) : null}
      </section>

      <section className="rewardPanel reportStep" aria-labelledby="priority-title">
        <div className="reportStepHead">
          <span>3</span>
          <div>
          <h3 id="priority-title">Condición de la mascota</h3>
          <p>
            Marca solo condiciones concretas. Ayudan a priorizar alertas cercanas si la mascota puede estar en mayor riesgo.
          </p>
          </div>
        </div>

        <div className="rewardOptions">
          <label>
            Etapa de vida
            <select defaultValue="adult" name="petLifeStage">
              <option value="puppy">Cachorro</option>
              <option value="adult">Adulto</option>
              <option value="senior">Adulto mayor</option>
            </select>
          </label>
          <label className="checkRow">
            <input type="checkbox" name="isVulnerable" />
            Tiene movilidad limitada o alguna discapacidad
          </label>
          <label className="checkRow">
            <input type="checkbox" name="isUrgent" />
            Está herida, enferma o en recuperación
          </label>
          <label className="checkRow">
            <input type="checkbox" name="needsMedication" />
            Necesita medicamento o cuidados especiales
          </label>
        </div>
      </section>

      <section className="rewardPanel reportStep" aria-labelledby="reward-title" ref={rewardRef}>
        <div className="reportStepHead">
          <span>4</span>
          <div>
          <h3 id="reward-title">Recompensa</h3>
          <p>
            Algunas familias ofrecen una recompensa como agradecimiento. No es
            necesaria para publicar una alerta.
          </p>
          </div>
        </div>

        <div className="rewardOptions">
          <label className="checkRow">
            <input
              checked={rewardEnabled}
              name="rewardEnabled"
              onChange={(event) => {
                setRewardEnabled(event.target.checked);
                if (!event.target.checked) {
                  setRewardShowAmount(false);
                }
              }}
              type="checkbox"
            />
            Ofrecer recompensa
          </label>
          {rewardEnabled ? (
            <>
              <label className="checkRow">
                <input
                  checked={rewardShowAmount}
                  name="rewardShowAmount"
                  onChange={(event) => setRewardShowAmount(event.target.checked)}
                  type="checkbox"
                />
                Mostrar monto en la alerta
              </label>
              <label>
                Monto
                <input
                  defaultValue="250"
                  inputMode="numeric"
                  min={minimumRewardAmount}
                  name="rewardAmount"
                  onInput={() => setFieldErrors((currentErrors) => ({ ...currentErrors, rewardAmount: "" }))}
                  step="10"
                  type="number"
                />
                {fieldErrors.rewardAmount ? <span className="fieldError">{fieldErrors.rewardAmount}</span> : null}
              </label>
            </>
          ) : null}
        </div>
      </section>

      <section className="contactPanel reportStep" aria-labelledby="contact-title">
        <div className="reportStepHead">
          <span>5</span>
          <div>
          <h3 id="contact-title">Cómo te avisamos</h3>
          <p>
            Por defecto usamos notificaciones de HuellamiGO. Agrega WhatsApp o correo
            solo si quieres otra forma de contacto.
          </p>
          </div>
        </div>

        <div className="formGrid">
          <label>
            Nombre de contacto opcional
            <input placeholder="Ej. Lucia" name="contactName" />
          </label>
          <label>
            Método preferido
            <select defaultValue="Mensaje por HuellamiGO" name="preferredContact">
              <option>Mensaje por HuellamiGO</option>
              <option>Notificación de HuellamiGO</option>
              <option>WhatsApp</option>
              <option>Llamada</option>
              <option>Correo</option>
            </select>
          </label>
          <label>
            WhatsApp o correo opcional
            <input placeholder="Solo si quieres compartirlo" name="contactValue" />
          </label>
          <label className="checkRow contactCheck">
            <input type="checkbox" name="publicWhatsapp" />
            Mostrar mi WhatsApp en la alerta
          </label>
        </div>

        <div className="privacyNote">
          <LockKeyhole size={17} />
          <span>Mensaje por HuellamiGO activado por defecto.</span>
        </div>
      </section>

      <button className="primaryButton fullWidth" disabled={isPending} type="submit">
        <Send size={18} />
        {isPending
          ? "Publicando..."
            : !user
            ? "Iniciar sesión y publicar"
            : !user.emailVerified
              ? "Verifica tu correo para publicar"
              : "Publicar reporte"}
      </button>

      {message ? <p className="formMessage">{message}</p> : null}
      {manageUrl ? (
        <div className="manageLinkBox">
          <strong>Link privado de gestión</strong>
          <p>Guárdalo para editar, cerrar u ocultar este reporte.</p>
          <input readOnly value={manageUrl} />
          <Link className="secondaryButton" href={managePath}>
            Abrir gestión
          </Link>
        </div>
      ) : null}
    </form>
  );
}

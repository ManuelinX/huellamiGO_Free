"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArrowDown, ArrowUp, Camera, CheckCircle2, X } from "lucide-react";
import { uploadPetPhoto } from "@/lib/reports";
import { updateManagedReportStatus } from "@/lib/manage";
import { preparePhotoState } from "@/lib/image-processing";
import { getUserErrorMessage, userMessages } from "@/lib/user-messages";

const maxStoryLength = 180;
const maxReunionPhotos = 2;
const reunionPhotoBackground = "#F4F1DE";

export function ManageReportActions({ reportId, token, onUpdated }) {
  const [message, setMessage] = useState("");
  const [reunionPhotos, setReunionPhotos] = useState([]);
  const [storyMessage, setStoryMessage] = useState("");
  const [publicAllowed, setPublicAllowed] = useState(false);
  const reunionPhotosRef = useRef([]);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    reunionPhotosRef.current = reunionPhotos;
  }, [reunionPhotos]);

  useEffect(() => {
    return () => {
      reunionPhotosRef.current.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
    };
  }, []);

  const handlePhotoChange = async (event) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    const imageFiles = selectedFiles.filter((file) => file.type.startsWith("image/"));

    if (reunionPhotos.length >= maxReunionPhotos) {
      event.target.value = "";
      setMessage(`Borra una foto antes. Maximo ${maxReunionPhotos} fotos.`);
      return;
    }

    if (reunionPhotos.length + imageFiles.length > maxReunionPhotos) {
      event.target.value = "";
      setMessage(`Puedes tener máximo ${maxReunionPhotos} fotos en la historia.`);
      return;
    }

    try {
      setMessage(userMessages.imagePreparing);
      const preparedPhotos = await Promise.all(
        imageFiles.map((file) => preparePhotoState(file, {
          backgroundColor: reunionPhotoBackground,
          suffix: "reencuentro",
        })),
      );

      setReunionPhotos((currentPhotos) => [
        ...currentPhotos,
        ...preparedPhotos.map((photo) => ({
          id: crypto.randomUUID(),
          file: photo.file,
          previewUrl: photo.previewUrl,
        })),
      ]);
      event.target.value = "";
      if (imageFiles.length > 0) {
        setPublicAllowed(true);
      }
      setMessage(imageFiles.length > 0 ? "Foto lista para la historia." : "");
    } catch (error) {
      event.target.value = "";
      setMessage(userMessages.imageFailed);
    }
  };

  const removePhoto = (photoId) => {
    setReunionPhotos((currentPhotos) => {
      const removedPhoto = currentPhotos.find((photo) => photo.id === photoId);
      if (removedPhoto) {
        URL.revokeObjectURL(removedPhoto.previewUrl);
      }

      return currentPhotos.filter((photo) => photo.id !== photoId);
    });
  };

  const movePhoto = (photoId, direction) => {
    setReunionPhotos((currentPhotos) => {
      const fromIndex = currentPhotos.findIndex((photo) => photo.id === photoId);
      const toIndex = fromIndex + direction;

      if (fromIndex < 0 || toIndex < 0 || toIndex >= currentPhotos.length) {
        return currentPhotos;
      }

      const nextPhotos = [...currentPhotos];
      const [movedPhoto] = nextPhotos.splice(fromIndex, 1);
      nextPhotos.splice(toIndex, 0, movedPhoto);
      return nextPhotos;
    });
  };

  const updateStatus = (status, formData = null) => {
    startTransition(async () => {
      try {
        let reunionStory = {};

        if (status === "reunited" && formData) {
          const nextStoryMessage = storyMessage.trim();

          if (nextStoryMessage.length > maxStoryLength) {
            setMessage(`El mensaje debe tener máximo ${maxStoryLength} caracteres.`);
            return;
          }

          if (reunionPhotos.length > maxReunionPhotos) {
            setMessage(`Puedes subir máximo ${maxReunionPhotos} fotos.`);
            return;
          }

          const photoUrls = await Promise.all(
            reunionPhotos.map((photo) => uploadPetPhoto(photo.file)),
          );

          reunionStory = {
            message: nextStoryMessage || null,
            photoUrl: photoUrls[0] ?? null,
            photoUrl2: photoUrls[1] ?? null,
            publicAllowed,
          };
        }

        await updateManagedReportStatus(reportId, token, status, reunionStory);
        setMessage(status === "reunited" ? "Reporte marcado como reunido." : "Reporte oculto.");
        if (status === "archived") {
          router.replace("/");
          return;
        }

        if (status === "reunited") {
          reunionPhotos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
          setReunionPhotos([]);
          setStoryMessage("");
          setPublicAllowed(false);
        }
        onUpdated?.();
        router.refresh();
      } catch (error) {
        setMessage(getUserErrorMessage(error, "No pudimos actualizar el reporte."));
      }
    });
  };

  const handleReunitedSubmit = (event) => {
    event.preventDefault();
    updateStatus("reunited", new FormData(event.currentTarget));
  };

  return (
    <div className="manageActions">
      <form className="reunionStoryForm" onSubmit={handleReunitedSubmit}>
        <div>
          <p className="eyebrow">Reencuentro</p>
          <h2>Historia corta</h2>
          <p>Opcional para cerrar el reporte con una nota para la comunidad.</p>
        </div>
        <label>
          Mensaje corto
          <textarea
            maxLength={maxStoryLength}
            name="reunionMessage"
            onChange={(event) => {
              const nextMessage = event.target.value;
              setStoryMessage(nextMessage);
              if (nextMessage.trim()) {
                setPublicAllowed(true);
              }
            }}
            placeholder="Ej. Ya está en casa, gracias por estar atentos."
            value={storyMessage}
          />
        </label>
        <label
          className={`fileLine ${reunionPhotos.length >= maxReunionPhotos ? "isDisabled" : ""}`}
          onClick={() => {
            if (reunionPhotos.length >= maxReunionPhotos) {
              setMessage(`Borra una foto antes. Maximo ${maxReunionPhotos} fotos.`);
            }
          }}
        >
          <Camera size={18} />
          {reunionPhotos.length >= maxReunionPhotos
            ? "Borra una foto para agregar otra"
            : "Hasta 2 fotos opcionales"}
          <input
            accept="image/*"
            disabled={reunionPhotos.length >= maxReunionPhotos}
            multiple
            name="reunionPhotos"
            onChange={handlePhotoChange}
            type="file"
          />
        </label>
        {reunionPhotos.length > 0 ? (
          <div className="reunionPhotoPreviewList">
            {reunionPhotos.map((photo, index) => (
              <article className="reunionPhotoPreview" key={photo.id}>
                <img src={photo.previewUrl} alt="" />
                <div>
                  <strong>Foto {index + 1}</strong>
                  <span>{index === 0 ? "Se mostrara primero" : "Se mostrara despues"}</span>
                  <div className="photoOrderActions">
                    <button
                      aria-label="Mover foto antes"
                      disabled={index === 0 || isPending}
                      onClick={() => movePhoto(photo.id, -1)}
                      type="button"
                    >
                      <ArrowUp size={16} />
                    </button>
                    <button
                      aria-label="Mover foto despues"
                      disabled={index === reunionPhotos.length - 1 || isPending}
                      onClick={() => movePhoto(photo.id, 1)}
                      type="button"
                    >
                      <ArrowDown size={16} />
                    </button>
                    <button
                      aria-label="Quitar foto"
                      disabled={isPending}
                      onClick={() => removePhoto(photo.id)}
                      type="button"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : null}
        <label className="checkRow">
          <input
            checked={publicAllowed}
            disabled={!storyMessage.trim() && reunionPhotos.length === 0}
            name="reunionPublicAllowed"
            onChange={(event) => setPublicAllowed(event.target.checked)}
            type="checkbox"
          />
          Permitir mostrar esta historia en comunidad
        </label>
        <button className="primaryButton" disabled={isPending} type="submit">
          <CheckCircle2 size={18} />
          Marcar como reunida
        </button>
      </form>
      <button
        className="secondaryButton"
        disabled={isPending}
        onClick={() => updateStatus("archived")}
        type="button"
      >
        <Archive size={18} />
        Ocultar reporte
      </button>
      {message ? <p className="formMessage">{message}</p> : null}
    </div>
  );
}

"use client";

import { useEffect, useState, useTransition } from "react";
import { CheckCircle2, Clock, EyeOff, ImageOff, MapPin, MessageSquareText, Star, X, ZoomIn } from "lucide-react";
import { updateManagedSighting } from "@/lib/manage";
import { getSightingConfidenceLabel, getSightingStatusLabel } from "@/lib/sightings";
import { getUserErrorMessage } from "@/lib/user-messages";
import plantFiveGray from "../assets/sightings/plant-five-gray.png";
import plantFiveGreen from "../assets/sightings/plant-five-green.png";
import pawThree from "../assets/sightings/paws-three.png";
import paw from "../assets/sightings/paw-single.png";
import plantThreeGray from "../assets/sightings/plant-three-gray.png";
import plantThreeGreen from "../assets/sightings/plant-three-green.png";
import plantThreeYellow from "../assets/sightings/plant-three-yellow.png";
import lowHearth from "../assets/sightings/heart-trail-gray.png";
import lowHearthGreen from "../assets/sightings/heart-trail-green.png";
import lowHearthRotate45 from "../assets/sightings/heart-trail-rotated-gray.png";
import lowHearthRotate45Green from "../assets/sightings/heart-trail-rotated-green.png";
import lowHearthRotate45Yellow from "../assets/sightings/heart-trail-rotated-yellow.png";
import lowHearthYellow from "../assets/sightings/heart-trail-yellow.png";
import hearthWay from "../assets/sightings/heart-path.png";
import huellamigoLogo from "../assets/branding/logo.png";

const maxTrailKeySightings = 5;
const grayCardArt = [lowHearth, lowHearthRotate45, plantThreeGray];
const greenCardArt = [lowHearthGreen, lowHearthRotate45Green, plantThreeGreen];
const yellowCardArt = [lowHearthYellow, lowHearthRotate45Yellow, plantThreeYellow, paw];

function formatSightingDate(value) {
  if (!value) {
    return "Fecha no disponible";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Fecha no disponible";
  }

  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function ManageSightingsPanel({ reportId, token, sightings, onSightingUpdated }) {
  const [items, setItems] = useState(sightings);
  const [message, setMessage] = useState("");
  const [activeId, setActiveId] = useState(null);
  const [expandedPhoto, setExpandedPhoto] = useState(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setItems(sightings);
  }, [sightings]);

  const trailKeyCount = items.filter((item) => item.isTrailKey && !item.isHidden).length;

  const updateSighting = (sighting, nextStatus, nextUseful, nextTrailKey, successMessage) => {
    setActiveId(sighting.id);
    setMessage("");

    startTransition(async () => {
      try {
        const updatedSighting = await updateManagedSighting({
          reportId,
          token,
          sightingId: sighting.id,
          status: nextStatus,
          isUseful: nextUseful,
          isTrailKey: nextTrailKey,
        });

        setItems((currentItems) =>
          currentItems.map((item) => (item.id === sighting.id ? updatedSighting : item)),
        );
        onSightingUpdated?.(updatedSighting);
        setMessage(successMessage);
      } catch (error) {
        setMessage(getUserErrorMessage(error, "No pudimos actualizar ese Lo vi."));
      } finally {
        setActiveId(null);
      }
    });
  };

  return (
    <section className="managedSightingsPanel" aria-labelledby="managed-sightings-title">
      <div className="managedSightingsHeader">
        <div>
          <p className="eyebrow">Gestión de Lo vi</p>
          <h2 id="managed-sightings-title">Avisos recibidos</h2>
        </div>
        <div className="managedSightingsHeaderArt" aria-hidden="true">
          <img className="managedSightingsHeaderWay" src={hearthWay.src} alt="" />
          <img className="managedSightingsHeaderLogo" src={huellamigoLogo.src} alt="" />
        </div>
      </div>

      {items.length > 0 ? (
        <div className="managedSightingList">
          {items.map((sighting, index) => {
            const isUpdating = isPending && activeId === sighting.id;
            const isHidden = sighting.isHidden;
            const canMarkTrailKey = sighting.isTrailKey || trailKeyCount < maxTrailKeySightings;
            const cardArtOptions =
              sighting.isTrailKey && !isHidden
                ? yellowCardArt
                : sighting.isUseful && !isHidden
                  ? greenCardArt
                  : grayCardArt;
            const statusIcon = isHidden ? (
              <EyeOff size={17} aria-hidden="true" />
            ) : sighting.isTrailKey ? (
              <Star size={17} aria-hidden="true" />
            ) : sighting.isUseful ? (
              <CheckCircle2 size={17} aria-hidden="true" />
            ) : null;

            return (
              <article
                className={`managedSightingItem ${sighting.isTrailKey ? "isTrailKey" : ""} ${!sighting.isTrailKey && sighting.isUseful ? "isUseful" : ""} ${isHidden ? "isHidden" : ""}`}
                key={sighting.id}
              >
                <img
                  alt=""
                  aria-hidden="true"
                  className="managedSightingCardArt"
                  src={cardArtOptions[index % cardArtOptions.length].src}
                />
                <div className="managedSightingPhoto">
                  {sighting.photoUrl ? (
                    <button
                      aria-label="Ver foto del Lo vi en grande"
                      onClick={() => setExpandedPhoto(sighting)}
                      type="button"
                    >
                      <img src={sighting.photoUrl} alt="" />
                      <span>
                        <ZoomIn size={17} />
                        Ver grande
                      </span>
                    </button>
                  ) : (
                    <>
                      <ImageOff size={40} />
                      <img
                        alt=""
                        aria-hidden="true"
                        className={`managedSightingPlant ${
                          sighting.isTrailKey
                            ? "isTrailKey"
                            : sighting.isUseful
                              ? "isUseful"
                              : isHidden
                                ? "isHidden"
                                : "isNormal"
                        }`}
                        src={
                          (
                            sighting.isTrailKey && !isHidden
                              ? pawThree
                              : sighting.isUseful && !isHidden
                                ? plantFiveGreen
                                : plantFiveGray
                          ).src
                        }
                      />
                    </>
                  )}
                </div>
                <div className="managedSightingBody">
                  <div className="managedSightingTopline">
                    <strong>{sighting.contactName ?? "Vecino de la comunidad"}</strong>
                    <span>
                      {statusIcon}
                      {getSightingStatusLabel(sighting)}
                    </span>
                  </div>
                  <p className="managedSightingComment">
                    <MessageSquareText size={17} />
                    {sighting.comment || "Sin comentario adicional."}
                  </p>
                  <div className="managedSightingFacts">
                    <span>
                      <Clock size={16} />
                      {formatSightingDate(sighting.seenAt ?? sighting.createdAt)}
                    </span>
                    <span>
                      <MapPin size={16} />
                      {sighting.coordinates[0].toFixed(5)}, {sighting.coordinates[1].toFixed(5)}
                    </span>
                    <span>Confianza {getSightingConfidenceLabel(sighting)} ({sighting.confidenceScore}/100)</span>
                  </div>
                  <div className="managedSightingActions">
                    {!isHidden ? (
                      <button
                        className="secondaryButton keyButton"
                        disabled={isUpdating || !canMarkTrailKey}
                        onClick={() =>
                          updateSighting(sighting, "visible", true, true, "Lo vi marcado como pista clave.")
                        }
                        title={!canMarkTrailKey ? "Ya tienes 5 pistas clave activas." : undefined}
                        type="button"
                      >
                        <Star size={18} />
                        Pista clave
                      </button>
                    ) : null}
                    <button
                      className="secondaryButton"
                      disabled={isUpdating}
                      onClick={() =>
                        updateSighting(sighting, "visible", true, false, "Lo vi marcado como útil.")
                      }
                      type="button"
                    >
                      <CheckCircle2 size={18} />
                      Marcar útil
                    </button>
                    <button
                      className="secondaryButton dangerButton"
                      disabled={isUpdating}
                      onClick={() =>
                        updateSighting(sighting, "hidden", false, false, "Lo vi marcado como no útil para el rastro.")
                      }
                      type="button"
                    >
                      <EyeOff size={18} />
                      No me sirve
                    </button>
                  </div>
                  {!canMarkTrailKey && !sighting.isTrailKey ? (
                    <p className="managedSightingHint">Ya tienes 5 pistas clave. Baja una a útil para marcar esta.</p>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="emptyManagedSightings">
          <ImageOff size={30} />
          <p>Todavía no hay Lo vi para revisar.</p>
        </div>
      )}

      {message ? <p className="formMessage">{message}</p> : null}

      {expandedPhoto ? (
        <div
          className="sightingPhotoOverlay"
          role="dialog"
          aria-modal="true"
          onClick={() => setExpandedPhoto(null)}
        >
          <article className="sightingPhotoModal" onClick={(event) => event.stopPropagation()}>
            <button
              className="storyClose"
              aria-label="Cerrar foto"
              onClick={() => setExpandedPhoto(null)}
              type="button"
            >
              <X size={22} />
            </button>
            <img src={expandedPhoto.photoUrl} alt="" />
            <div>
              <p className="eyebrow">Foto del Lo vi</p>
              <h3>{expandedPhoto.contactName ?? "Vecino de la comunidad"}</h3>
              <p>{expandedPhoto.comment || "Sin comentario adicional."}</p>
              <span>
                {expandedPhoto.coordinates[0].toFixed(5)}, {expandedPhoto.coordinates[1].toFixed(5)}
              </span>
            </div>
          </article>
        </div>
      ) : null}
    </section>
  );
}

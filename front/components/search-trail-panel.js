"use client";

import { useState } from "react";
import { Camera, CheckCircle2, ChevronDown, Clock, Heart, MapPin, MessageSquareText, PawPrint, Shield, Star } from "lucide-react";
import { getSightingConfidenceLabel, getSightingStatusLabel } from "@/lib/sightings";
import { sortTrailPanelSightings } from "@/lib/search-trail";

const trailPageSize = 5;

function formatTrailDate(value) {
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

function getLeadLabel(leadSighting) {
  if (!leadSighting) {
    return "Sin pistas";
  }

  if (leadSighting.isTrailKey) {
    return "Pista clave";
  }

  return "Última pista útil";
}

export function SearchTrailPanel({ sightings }) {
  const [visibleCount, setVisibleCount] = useState(trailPageSize);
  const [showDetails, setShowDetails] = useState(false);
  const followSightings = sightings.filter((sighting) => !sighting.isHidden && (sighting.isTrailKey || sighting.isUseful));
  const orderedSightings = sortTrailPanelSightings(followSightings);
  const visibleSightings = orderedSightings.slice(0, visibleCount);
  const hiddenCount = Math.max(orderedSightings.length - visibleSightings.length, 0);
  const leadSighting = orderedSightings[0] ?? null;

  return (
    <section className="searchTrailPanel" aria-labelledby="search-trail-title">
      <div className="searchTrailHeader">
        <div>
          <p className="eyebrow">Rastro de busqueda <PawPrint size={16} aria-hidden="true" /></p>
          <h2 id="search-trail-title">Resumen del rastro <Heart size={30} aria-hidden="true" /></h2>
          <p>
            Este bloque resume los avisos que marcaste como útiles o clave.
            El recorrido completo vive en el mapa de busqueda.
          </p>
        </div>
        <div className="searchTrailHeaderArt" aria-hidden="true">
          <span />
          <MapPin size={42} />
          <PawPrint size={34} />
        </div>
        <strong>{orderedSightings.length}</strong>
      </div>

      {leadSighting ? (
        <article className={`searchTrailLead ${leadSighting.isTrailKey ? "isTrailKey" : "isUseful"}`}>
          <div className="searchTrailCardArt" aria-hidden="true">
            <Heart size={48} />
            <PawPrint size={42} />
          </div>
          <div className="searchTrailLeadTop">
            <span className="searchTrailStatusPill">
              {leadSighting.isTrailKey ? <Star size={17} /> : <CheckCircle2 size={17} />}
              {getLeadLabel(leadSighting)}
            </span>
            <strong>{getSightingStatusLabel(leadSighting)}</strong>
          </div>
          <p>{leadSighting.comment || "Sin comentario adicional."}</p>
          <div className="searchTrailMeta">
            <span><MapPin size={15} /> {leadSighting.lat.toFixed(5)}, {leadSighting.lng.toFixed(5)}</span>
            <span><Clock size={15} /> {formatTrailDate(leadSighting.seenAt ?? leadSighting.createdAt)}</span>
            <span><Shield size={15} /> Confianza {getSightingConfidenceLabel(leadSighting)}</span>
          </div>
        </article>
      ) : (
        <div className="searchTrailEmpty">
          <MapPin size={28} />
          <p>Aún no hay avisos marcados como útiles. Revisa los avisos recibidos y destaca los que ayuden a buscar.</p>
        </div>
      )}

      {orderedSightings.length > 1 ? (
        <div className="searchTrailActions">
          <button
            aria-expanded={showDetails}
            className="secondaryButton searchTrailToggle"
            onClick={() => setShowDetails((currentValue) => !currentValue)}
            type="button"
          >
            <ChevronDown size={18} />
            {showDetails ? "Ocultar pistas del rastro" : `Ver ${orderedSightings.length} pistas del rastro`}
          </button>
        </div>
      ) : null}

      {showDetails && orderedSightings.length > 1 ? (
        <>
          <ol className="searchTrailList">
            {visibleSightings.map((sighting, index) => (
              <li
                className={`searchTrailItem ${sighting.isTrailKey ? "isTrailKey" : ""} ${sighting.isUseful ? "isUseful" : ""}`}
                key={sighting.id}
              >
                <div className="searchTrailCardArt" aria-hidden="true">
                  <Heart size={42} />
                  <PawPrint size={36} />
                </div>
                <span className="searchTrailNumber">{index + 1}</span>
                <div className="searchTrailItemBody">
                  <div className="searchTrailItemTop">
                    <strong>{getSightingStatusLabel(sighting)}</strong>
                    <span>Confianza {getSightingConfidenceLabel(sighting)} ({sighting.confidenceScore}/100)</span>
                  </div>
                  <p>
                    <MessageSquareText size={16} />
                    {sighting.comment || "Sin comentario adicional."}
                  </p>
                  <div className="searchTrailMeta">
                    <span><MapPin size={15} /> {sighting.lat.toFixed(5)}, {sighting.lng.toFixed(5)}</span>
                    <span><Clock size={15} /> {formatTrailDate(sighting.seenAt ?? sighting.createdAt)}</span>
                    {sighting.photoUrl ? <span><Camera size={15} /> Foto incluida</span> : null}
                    {sighting.isTrailKey ? <span><CheckCircle2 size={15} /> Clave para rastro</span> : null}
                    {!sighting.isTrailKey && sighting.isUseful ? <span><CheckCircle2 size={15} /> Util para busqueda</span> : null}
                  </div>
                </div>
              </li>
            ))}
          </ol>

          {hiddenCount > 0 ? (
            <button
              className="secondaryButton searchTrailMoreButton"
              onClick={() => setVisibleCount((currentCount) => currentCount + trailPageSize)}
              type="button"
            >
              Mostrar 5 mas ({hiddenCount} pistas)
            </button>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

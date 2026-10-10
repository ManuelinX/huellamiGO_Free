"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, LockKeyhole, MapPin, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { ManageSearchMap } from "@/components/manage-search-map";
import { ManageReportActions } from "@/components/manage-report-actions";
import { ManageSightingsPanel } from "@/components/manage-sightings-panel";
import { SearchTrailPanel } from "@/components/search-trail-panel";
import { createManageSession, getManagedReport, getManagedSightings } from "@/lib/manage";
import huellamigoLogo from "../assets/branding/logo.png";
import heartPathAlt from "../assets/sightings/heart-path-alt.png";
import sproutGreen from "../assets/sightings/sproud_green.png";

function readManageTokenFromUrl() {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const queryParams = new URLSearchParams(window.location.search);

  return hashParams.get("token") || queryParams.get("token");
}

function cleanManageTokenFromUrl(reportId) {
  window.history.replaceState(null, "", `/gestionar/${reportId}`);
}

function ManageSectionHeading({ number, title, description }) {
  return (
    <div className="manageSectionHeading">
      <span>{number}</span>
      <div>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
    </div>
  );
}

export function ManageReportPageClient({ reportId }) {
  const [report, setReport] = useState(null);
  const [sightings, setSightings] = useState([]);
  const [status, setStatus] = useState("loading");
  const [manageToken, setManageToken] = useState(null);

  const loadManagedReport = useCallback(async ({ exchangeToken = false, tokenOverride = null } = {}) => {
    try {
      const tokenFromUrl = exchangeToken ? readManageTokenFromUrl() : null;
      const accessToken = tokenOverride || tokenFromUrl || manageToken;

      if (tokenFromUrl) {
        await createManageSession(reportId, tokenFromUrl);
        setManageToken(tokenFromUrl);
        cleanManageTokenFromUrl(reportId);
      }

      const [nextReport, nextSightings] = await Promise.all([
        getManagedReport(reportId, accessToken),
        getManagedSightings(reportId, accessToken),
      ]);

      if (!nextReport || nextReport.status === "archived") {
        setStatus("not-found");
        return;
      }

      setReport(nextReport);
      setSightings(nextSightings);
      setStatus("ready");
    } catch {
      setStatus("not-found");
    }
  }, [manageToken, reportId]);

  useEffect(() => {
    loadManagedReport({ exchangeToken: true });
  }, [loadManagedReport]);

  if (status === "loading") {
    return (
      <main className="managePage">
        <section className="infoPanel">
          <p className="eyebrow">Gestión privada</p>
          <h1>Cargando panel</h1>
          <p>Validando acceso privado del reporte.</p>
        </section>
      </main>
    );
  }

  if (status === "not-found" || !report) {
    return (
      <main className="managePage">
        <section className="infoPanel">
          <p className="eyebrow">Gestión privada</p>
          <h1>Link no válido</h1>
          <p>Este link privado no existe, expiró o ya no tiene permisos para gestionar el reporte.</p>
          <Link className="secondaryButton" href="/">
            Volver al mapa
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="managePage">
      <nav className="detailNav">
        <Link href={report.publicPath}>
          <ArrowLeft size={18} />
          {report.canOpenPublicReport ? "Ver reporte público" : "Volver al mapa"}
        </Link>
      </nav>

      <section className="manageHero">
        <div className="manageReportSummary">
          <div className={`manageReportPhoto ${report.avatarClass}`} aria-hidden="true">
            {report.photoUrl ? <img src={report.photoUrl} alt="" /> : null}
          </div>
          <div className="manageReportCopy">
            <p className="eyebrow">Gestión privada</p>
            <h1>{report.name}</h1>
            <p>
              Este panel solo funciona con el link privado. Desde aqui puedes
              cerrar u ocultar el reporte sin crear una cuenta.
            </p>
            <div className="detailFacts">
              <span><LockKeyhole size={17} /> Link privado</span>
              <span><MapPin size={17} /> {report.zone}</span>
              <span><ShieldCheck size={17} /> Estado: {report.status}</span>
            </div>
            <div className="manageReportDescription">
              <strong>Resumen del reporte</strong>
              <p>{report.description}</p>
              <span>
                {report.reward?.enabled
                  ? report.reward.showAmount
                    ? `Recompensa: $${Number(report.reward.amount).toLocaleString("es-MX")} ${report.reward.currency}`
                    : "Recompensa disponible"
                  : "Sin recompensa registrada"}
              </span>
            </div>
          </div>
        </div>
        <ManageReportActions
          reportId={report.id}
          token={manageToken}
          onUpdated={() => loadManagedReport({ tokenOverride: manageToken })}
        />
        <img className="manageHeroHeartPath" src={heartPathAlt.src} alt="" aria-hidden="true" />
        <img className="manageHeroLogo" src={huellamigoLogo.src} alt="" aria-hidden="true" />
        <img className="manageHeroSprout" src={sproutGreen.src} alt="" aria-hidden="true" />
      </section>

      {report.status === "reunited" ? (
        <section className="reunionStoryPanel" aria-labelledby="reunion-story-title">
          {report.reunionStory.photoUrl || report.reunionStory.photoUrl2 ? (
            <div className="reunionStoryPhotos">
              {report.reunionStory.photoUrl ? <img src={report.reunionStory.photoUrl} alt="" /> : null}
              {report.reunionStory.photoUrl2 ? <img src={report.reunionStory.photoUrl2} alt="" /> : null}
            </div>
          ) : (
            <div className="storyIcon">
              <ShieldCheck size={24} />
            </div>
          )}
          <div>
            <p className="eyebrow">Historia de reencuentro</p>
            <h2 id="reunion-story-title">Final feliz de {report.name}</h2>
            <p>
              {report.reunionStory.message ??
                "Este reporte ya fue marcado como reunido. No se agrego mensaje para la historia."}
            </p>
            <span>
              {report.reunionStory.publicAllowed
                ? "Autorizada para mostrarse en comunidad"
                : "Solo visible en este panel privado"}
            </span>
          </div>
        </section>
      ) : null}

      <section className="manageGrid">
        <article className="infoPanel">
          <h2>Avistamientos recibidos</h2>
          <strong className="manageMetric">{sightings.length}</strong>
          <p>Estos avisos vienen de personas que usaron el boton La vi.</p>
        </article>
        <article className="infoPanel">
          <h2>Reporte público</h2>
          <p>
            {report.status === "active"
              ? "Comparte el enlace público para que más personas puedan ayudar."
              : "Este reporte ya no está visible en el mapa público."}
          </p>
          <Link className="secondaryButton" href={report.publicPath}>
            {report.canOpenPublicReport ? "Abrir reporte" : "Volver al mapa"}
          </Link>
        </article>
        <article className="infoPanel">
          <h2>Privacidad</h2>
          <p>No publiques este link. Quien lo tenga puede gestionar el reporte.</p>
        </article>
      </section>

      <ManageSectionHeading
        number="1"
        title="Revisar avisos"
        description="Marca como util o clave solo los avisos que ayuden a orientar la busqueda."
      />

      <ManageSightingsPanel
        reportId={report.id}
        token={manageToken}
        sightings={sightings}
        onSightingUpdated={(updatedSighting) => {
          setSightings((currentSightings) =>
            currentSightings.map((sighting) =>
              sighting.id === updatedSighting.id ? updatedSighting : sighting,
            ),
          );
        }}
      />

      <ManageSectionHeading
        number="2"
        title="Resumen del rastro"
        description="Aqui queda la pista mas importante y, si hace falta, el detalle de las pistas marcadas."
      />

      <SearchTrailPanel sightings={sightings} />

      <ManageSectionHeading
        number="3"
        title="Mapa de busqueda"
        description="Revisa el recorrido, los puntos recibidos y las zonas que ya fueron revisadas."
      />

      <ManageSearchMap report={report} token={manageToken} sightings={sightings} />
    </main>
  );
}

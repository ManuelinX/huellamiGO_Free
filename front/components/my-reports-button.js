"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Archive, Clock3, FolderClock, PawPrint, RefreshCw, X } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { getMyReports } from "@/lib/reports";
import { getUserErrorMessage } from "@/lib/user-messages";

function formatReportDate(value) {
  if (!value) {
    return "Fecha no disponible";
  }

  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function getStatusLabel(status) {
  if (status === "reunited") {
    return "Reunida";
  }

  if (status === "archived") {
    return "Archivada";
  }

  return "Activa";
}

export function MyReportsButton() {
  const { user, isAuthLoading } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [reports, setReports] = useState([]);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const loadReports = () => {
    startTransition(async () => {
      setMessage("");

      try {
        const nextReports = await getMyReports();
        setReports(nextReports);
      } catch (error) {
        setReports([]);
        setMessage(getUserErrorMessage(error, "No pudimos cargar tus reportes."));
      }
    });
  };

  useEffect(() => {
    if (!isOpen || !user) {
      return;
    }

    loadReports();
  }, [isOpen, user]);

  if (!user) {
    return null;
  }

  return (
    <>
      <button
        className="authButton compactAuthButton"
        disabled={isAuthLoading}
        onClick={() => setIsOpen(true)}
        type="button"
        aria-label="Ver mis reportes"
      >
        <FolderClock size={17} />
        <span>Mis reportes</span>
      </button>

      {isOpen ? createPortal((
        <div className="myReportsOverlay" role="presentation" onClick={() => setIsOpen(false)}>
          <section
            className="myReportsDrawer"
            aria-labelledby="my-reports-title"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="authModalHeader">
              <div>
                <p className="eyebrow">Historial</p>
                <h2 id="my-reports-title">Mis reportes</h2>
              </div>
              <button className="ghostIcon" onClick={() => setIsOpen(false)} type="button" aria-label="Cerrar">
                <X size={19} />
              </button>
            </div>

            <div className="myReportsActions">
              <p>Abre tus reportes activos o historias de reencuentro.</p>
              <button className="ghostTextButton" disabled={isPending} onClick={loadReports} type="button">
                <RefreshCw size={16} />
                Actualizar
              </button>
            </div>

            {message ? <p className="formMessage">{message}</p> : null}

            {isPending ? (
              <div className="myReportsEmpty">
                <Clock3 size={20} />
                <p>Cargando reportes...</p>
              </div>
            ) : reports.length > 0 ? (
              <div className="myReportsList">
                {reports.map((report) => (
                  <article className="myReportItem" key={report.id}>
                    {report.status === "active" ? (
                      <Link className="myReportPhoto" href={`/mascotas/${report.slug}`} aria-label={`Ver reporte de ${report.name}`}>
                        {report.photoUrl ? <img src={report.photoUrl} alt="" /> : <PawPrint size={20} />}
                      </Link>
                    ) : (
                      <span className="myReportPhoto" aria-hidden="true">
                        {report.photoUrl ? <img src={report.photoUrl} alt="" /> : <PawPrint size={20} />}
                      </span>
                    )}
                    <div className="myReportCopy">
                      <div>
                        <strong>{report.name}</strong>
                        <span>{getStatusLabel(report.status)}</span>
                      </div>
                      <p>{report.species} - {report.zone}</p>
                      <small>{formatReportDate(report.createdAt)}</small>
                    </div>
                    {report.manageToken ? (
                      <Link className="myReportManageLink" href={`/gestionar/${report.id}#token=${encodeURIComponent(report.manageToken)}`}>
                        Gestionar
                      </Link>
                    ) : (
                      <span className="myReportArchived">
                        <Archive size={15} />
                      </span>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <div className="myReportsEmpty">
                <PawPrint size={22} />
                <p>Tus reportes publicados aparecerán aquí.</p>
              </div>
            )}
          </section>
        </div>
      ), document.body) : null}
    </>
  );
}

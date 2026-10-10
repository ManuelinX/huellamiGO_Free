"use client";

import { useMemo, useState } from "react";
import { Bug, CircleHelp, Lightbulb, MessageCircleQuestion, Send, X } from "lucide-react";
import styles from "./beta-help-widget.module.css";

const helpEmail = process.env.NEXT_PUBLIC_HELP_EMAIL || "contacto@huellamigo.com";
const maxDetailLength = 512;
const maxSubjectLength = 48;

const helpTypes = [
  { value: "bug", label: "Reportar bug", icon: Bug },
  { value: "feature", label: "Sugerir mejora", icon: Lightbulb },
  { value: "question", label: "Duda de funcionalidad", icon: CircleHelp },
];

function getTypeLabel(value) {
  return helpTypes.find((type) => type.value === value)?.label ?? "Ayuda beta";
}

function buildMailtoUrl({ type, subject, detail }) {
  const pageUrl = typeof window === "undefined" ? "" : window.location.href;
  const userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent;
  const fullSubject = `[Beta HuellamiGO] ${getTypeLabel(type)} - ${subject}`;
  const body = [
    `Categoria: ${getTypeLabel(type)}`,
    `Asunto: ${subject}`,
    "",
    "Detalle:",
    detail,
    "",
    "Contexto tecnico:",
    `URL: ${pageUrl}`,
    `Navegador: ${userAgent}`,
  ].join("\n");

  return `mailto:${helpEmail}?subject=${encodeURIComponent(fullSubject)}&body=${encodeURIComponent(body)}`;
}

export function BetaHelpWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState("bug");
  const [subject, setSubject] = useState("");
  const [detail, setDetail] = useState("");
  const [message, setMessage] = useState("");
  const selectedType = useMemo(() => helpTypes.find((item) => item.value === type) ?? helpTypes[0], [type]);
  const SelectedIcon = selectedType.icon;

  function resetForm() {
    setType("bug");
    setSubject("");
    setDetail("");
    setMessage("");
  }

  function closeWidget() {
    setIsOpen(false);
    setMessage("");
  }

  function handleSubmit(event) {
    event.preventDefault();

    const cleanSubject = subject.trim();
    const cleanDetail = detail.trim();

    if (!cleanSubject) {
      setMessage("Agrega un asunto.");
      return;
    }

    if (!cleanDetail) {
      setMessage("Describe lo que paso o lo que necesitas.");
      return;
    }

    if (cleanSubject.length > maxSubjectLength || cleanDetail.length > maxDetailLength) {
      setMessage("Revisa la longitud de los campos.");
      return;
    }

    window.location.href = buildMailtoUrl({
      type,
      subject: cleanSubject,
      detail: cleanDetail,
    });
    resetForm();
    setIsOpen(false);
  }

  return (
    <div className={styles.betaHelp}>
      <button
        className={styles.floatingButton}
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Abrir ayuda beta"
      >
        <MessageCircleQuestion size={21} />
        <span>Ayuda beta</span>
      </button>

      {isOpen ? (
        <div className={styles.overlay} role="presentation" onClick={closeWidget}>
          <section
            className={styles.panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="beta-help-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className={styles.header}>
              <div>
                <p>Beta</p>
                <h2 id="beta-help-title">Ayuda</h2>
              </div>
              <button className={styles.closeButton} type="button" onClick={closeWidget} aria-label="Cerrar ayuda">
                <X size={19} />
              </button>
            </header>

            <form className={styles.form} onSubmit={handleSubmit} noValidate>
              <label>
                Tipo de ayuda
                <div className={styles.selectWrap}>
                  <SelectedIcon size={18} />
                  <select value={type} onChange={(event) => setType(event.target.value)} required>
                    {helpTypes.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
              </label>

              <label>
                Asunto de la ayuda
                <input
                  maxLength={maxSubjectLength}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder="Ej. No carga el mapa"
                  required
                  value={subject}
                />
              </label>

              <label>
                Detalle
                <textarea
                  maxLength={maxDetailLength}
                  onChange={(event) => setDetail(event.target.value)}
                  placeholder="Cuenta que paso, que esperabas ver o que podria mejorar."
                  required
                  value={detail}
                />
              </label>

              <div className={styles.formFooter}>
                <span>{detail.length}/{maxDetailLength}</span>
                <button className={styles.submitButton} type="submit">
                  <Send size={17} />
                  Enviar
                </button>
              </div>

              {message ? <p className={styles.message}>{message}</p> : null}
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";

export function BetaVersionBadge({ iconSrc }) {
  const [isOpen, setIsOpen] = useState(false);
  const badgeRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      setIsOpen(false);
    }, 4200);

    const handlePointerDown = (event) => {
      if (!badgeRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      window.clearTimeout(timeout);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen]);

  return (
    <button
      ref={badgeRef}
      className={`betaVersionBadge ${isOpen ? "isOpen" : ""}`}
      aria-expanded={isOpen}
      aria-label="Version beta 2: Mapache Migajas"
      onClick={() => setIsOpen((current) => !current)}
      type="button"
    >
      <span className="betaVersionBadgeShine" aria-hidden="true" />
      <img src={iconSrc} alt="" />
      <span className="betaVersionTooltip" role="tooltip">Version beta 2: Mapache Migajas</span>
      <span className="betaVersionCard" aria-hidden={!isOpen}>
        <span>Beta 2</span>
        <strong>Mapache Migajas</strong>
        <small>Busqueda guiada</small>
      </span>
    </button>
  );
}

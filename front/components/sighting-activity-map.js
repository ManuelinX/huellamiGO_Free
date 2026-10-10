"use client";

import dynamic from "next/dynamic";

export const SightingActivityMap = dynamic(
  () => import("./sighting-activity-map-client").then((module) => module.SightingActivityMapClient),
  {
    ssr: false,
    loading: () => <div className="activityMap loading">Cargando actividad...</div>,
  },
);

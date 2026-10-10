"use client";

import dynamic from "next/dynamic";

export const LocationPicker = dynamic(
  () => import("./report-location-map").then((module) => module.ReportLocationMap),
  {
    ssr: false,
    loading: () => <div className="locationPicker loading">Cargando selector...</div>,
  },
);

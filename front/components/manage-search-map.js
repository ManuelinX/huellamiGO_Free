"use client";

import dynamic from "next/dynamic";

export const ManageSearchMap = dynamic(
  () => import("./manage-search-map-client").then((module) => module.ManageSearchMapClient),
  {
    ssr: false,
    loading: () => <div className="manageSearchMap loading">Cargando rastro...</div>,
  },
);

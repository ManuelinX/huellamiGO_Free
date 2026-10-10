import { createBadRequest } from "../utils/http.js";

export function parseBbox(value) {
  if (!value) {
    return null;
  }

  const parts = value.split(",").map((part) => Number(part));

  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
    throw createBadRequest("bbox inválido");
  }

  const [west, south, east, north] = parts;

  if (
    west < -180 ||
    west > 180 ||
    east < -180 ||
    east > 180 ||
    south < -90 ||
    south > 90 ||
    north < -90 ||
    north > 90 ||
    south >= north
  ) {
    throw createBadRequest("bbox fuera de rango");
  }

  return { west, south, east, north };
}

export function getMapResponseMode(zoom,
  zoomThresholds = { giant: 6, large: 10, medium: 13 }) {



  if (zoom <= zoomThresholds.giant) {
    return { mode: "clusters", clusterSize: "giant" };
  }

  if (zoom <= zoomThresholds.large) {
    return { mode: "clusters", clusterSize: "large" };
  }

  if (zoom <= zoomThresholds.medium) {
    return { mode: "clusters", clusterSize: "medium" };
  }

  return { mode: "items", clusterSize: null };
}

export function getMapClusterCellSize(clusterSize) {
  if (clusterSize === "giant") {
    return 2;
  }

  if (clusterSize === "large") {
    return 0.5;
  }

  return 0.1;
}

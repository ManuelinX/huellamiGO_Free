"use client";

import { useEffect } from "react";
import { useMap, useMapEvents } from "react-leaflet";

const northLimit = 85;
const southLimit = -85;
const westLimit = -180;
const eastLimit = 180;
const verticalLimitThreshold = 0.7;//0.05;
const horizontalLimitThreshold = 3;

function getMapBoundary(map) {
  const bounds = map.getBounds();

  if (bounds.getNorth() >= northLimit - verticalLimitThreshold) {
    return "top";
  }

  if (bounds.getSouth() <= southLimit + verticalLimitThreshold) {
    return "bottom";
  }

  if (bounds.getWest() <= westLimit + horizontalLimitThreshold) {
    return "left";
  }

  if (bounds.getEast() >= eastLimit - horizontalLimitThreshold) {
    return "right";
  }

  return null;
}

export function MapBoundaryWatcher({ onBoundaryChange }) {
  const map = useMap();

  const syncBoundary = () => {
    onBoundaryChange(getMapBoundary(map));
  };

  useMapEvents({
    move: syncBoundary,
    moveend: syncBoundary,
    zoomend: syncBoundary,
  });

  useEffect(() => {
    syncBoundary();
  }, [map]);

  return null;
}

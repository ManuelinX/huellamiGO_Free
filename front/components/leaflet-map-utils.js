import L from "leaflet";
import markerLostCoral from "../assets/maps/public/lost-coral.webp";
import markerRecentGold from "../assets/maps/public/recent-gold.webp";
import markerReportNavy from "../assets/maps/public/report-navy.webp";

export function getMapBbox(map) {
  const bounds = map.getBounds();
  const west = bounds.getWest();
  const east = bounds.getEast();
  const span = Math.abs(east - west);
  const normalizedWest = L.Util.wrapNum(west, [-180, 180], true);
  const normalizedEast = L.Util.wrapNum(east, [-180, 180], true);

  if (span >= 360 || normalizedWest >= normalizedEast) {
    return [
      -180,
      bounds.getSouth(),
      180,
      bounds.getNorth(),
    ];
  }

  return [
    normalizedWest,
    bounds.getSouth(),
    normalizedEast,
    bounds.getNorth(),
  ];
}

export function createPetIcon(isSelected) {
  return L.icon({
    iconUrl: isSelected ? markerLostCoral.src : markerReportNavy.src,
    iconSize: [72, 72],
    iconAnchor: [36, 64],
    popupAnchor: [0, -58],
  });
}

export function createClusterIcon(count) {
  return L.divIcon({
    className: "",
    html: `<span class="mapImageMarker mapClusterImageMarker"><img src="${markerRecentGold.src}" alt="" /><span class="mapMarkerCount">${count}</span></span>`,
    iconSize: [72, 72],
    iconAnchor: [36, 64],
    popupAnchor: [0, -58],
  });
}

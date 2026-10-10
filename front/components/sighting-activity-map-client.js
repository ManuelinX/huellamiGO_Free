"use client";

import { useMemo } from "react";
import { useState } from "react";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import { MapBoundaryWatcher } from "@/components/map-boundary-indicator";
import markerLostCoral from "../assets/maps/public/lost-coral.webp";
import markerRecentGold from "../assets/maps/public/recent-gold.webp";
import markerReportNavy from "../assets/maps/public/report-navy.webp";
import markerSeenSage from "../assets/maps/public/seen-sage.webp";

const minMapZoom = 4;
const mapVerticalBounds = [
  [-85, -180],
  [85, 180],
];

function getAgeMarker(dateValue) {
  const ageMs = Date.now() - new Date(dateValue).getTime();
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;

  if (ageMs <= hour) {
    return markerLostCoral;
  }

  if (ageMs <= day) {
    return markerRecentGold;
  }

  return markerSeenSage;
}

function createLastSeenIcon() {
  return L.icon({
    iconUrl: markerLostCoral.src,
    iconSize: [72, 72],
    iconAnchor: [36, 64],
    popupAnchor: [0, -58],
  });
}

function createActivityPin(group) {
  return L.divIcon({
    className: "",
    html: `<span class="mapImageMarker"><img src="${group.marker.src}" alt="" /><span class="mapMarkerCount">${group.count}</span></span>`,
    iconSize: [72, 72],
    iconAnchor: [36, 64],
    popupAnchor: [0, -58],
  });
}

function createOriginalReportIcon() {
  return L.icon({
    iconUrl: markerReportNavy.src,
    iconSize: [72, 72],
    iconAnchor: [36, 64],
    popupAnchor: [0, -58],
  });
}

function roundCoordinate(value) {
  return Number(value.toFixed(3));
}

function groupSightings(sightings) {
  const groups = new Map();

  sightings.forEach((sighting) => {
    const roundedLat = roundCoordinate(sighting.lat);
    const roundedLng = roundCoordinate(sighting.lng);
    const key = `${roundedLat},${roundedLng}`;
    const existing = groups.get(key) ?? {
      key,
      count: 0,
      latTotal: 0,
      lngTotal: 0,
      latestAt: sighting.seenAt ?? sighting.createdAt,
    };
    const sightingTime = sighting.seenAt ?? sighting.createdAt;

    existing.count += 1;
    existing.latTotal += sighting.lat;
    existing.lngTotal += sighting.lng;

    if (new Date(sightingTime) > new Date(existing.latestAt)) {
      existing.latestAt = sightingTime;
    }

    groups.set(key, existing);
  });

  const groupedSightings = [...groups.values()];

  return groupedSightings.map((group) => ({
    ...group,
    coordinates: [group.latTotal / group.count, group.lngTotal / group.count],
    marker: getAgeMarker(group.latestAt),
  }));
}

export function SightingActivityMapClient({ pet, sightings }) {
  const [verticalBoundary, setVerticalBoundary] = useState(null);
  const latestSighting = sightings[0];
  const groups = useMemo(() => groupSightings(sightings), [sightings]);
  const center = latestSighting ? [latestSighting.lat, latestSighting.lng] : pet.coordinates;
  const lastSeenIcon = useMemo(() => createLastSeenIcon(), []);
  const originalReportIcon = useMemo(() => createOriginalReportIcon(), []);

  return (
    <section className="activityMap" aria-label="Mapa de actividad reciente">
      <MapContainer
        center={center}
        className="realMap"
        maxBounds={mapVerticalBounds}
        maxBoundsViscosity={1}
        minZoom={minMapZoom}
        scrollWheelZoom
        zoom={15}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          minZoom={minMapZoom}
          noWrap
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <Marker icon={originalReportIcon} position={pet.coordinates}>
          <Popup>
            <strong>Reporte original</strong>
            <span>{pet.zone}</span>
          </Popup>
        </Marker>

        {groups.map((group) => (
          <Marker
            icon={createActivityPin(group)}
            key={group.key}
            position={group.coordinates}
          >
            <Popup>
              <strong>{group.count} Lo vi</strong>
              <span>Color según recencia</span>
            </Popup>
          </Marker>
        ))}

        {latestSighting ? (
          <Marker icon={lastSeenIcon} position={[latestSighting.lat, latestSighting.lng]}>
            <Popup>
              <strong>Última vez vista</strong>
              <span>{latestSighting.comment || "Lo vi más reciente"}</span>
            </Popup>
          </Marker>
        ) : null}
        <MapBoundaryWatcher onBoundaryChange={setVerticalBoundary} />
      </MapContainer>

      {verticalBoundary ? <div className={`mapBoundaryIndicator ${verticalBoundary}`} /> : null}

      <div className="activityLegend">
        <span><i className="legendDot recent" /> Reciente</span>
        <span><i className="legendDot today" /> Hoy</span>
        <span><i className="legendDot older" /> Anterior</span>
        <span><i className="legendRing" /> Pin = Lo vi agrupados</span>
      </div>
    </section>
  );
}

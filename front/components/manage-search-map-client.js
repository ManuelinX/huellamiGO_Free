"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { ChevronDown, Clock, Heart, MapPin as MapPinIcon, PawPrint, Star, Trash2, XCircle } from "lucide-react";
import { Circle, MapContainer, Marker, Polyline, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { MapBoundaryWatcher } from "@/components/map-boundary-indicator";
import { getMapBbox } from "@/components/leaflet-map-utils";
import {
  createReviewedSearchZone,
  deleteReviewedSearchZone,
  getManagedSightingMap,
  getReviewedSearchZones,
} from "@/lib/manage";
import {
  getMapTrailSightings,
  getStableSightingNumberById,
  hasValidSightingPosition,
  sortSightingsByTime,
} from "@/lib/search-trail";
import { getSightingConfidenceLabel, getSightingStatusLabel } from "@/lib/sightings";
import markerReviewedZone from "../assets/maps/private/reviewed-zone.png";
import markerKeyPin from "../assets/maps/private/key-sighting.png";
import markerUsefulPin from "../assets/maps/private/useful-sighting.png";
import markerReportNavy from "../assets/maps/public/report-navy.webp";

const minMapZoom = 4;
const pendingPreviewLimit = 12;
const reviewedZoneRadiusMeters = 500;
const reviewedZoneNoteMaxLength = 96;
const mapVerticalBounds = [
  [-85, -180],
  [85, 180],
];

function getSightingMarkerClass(sighting) {
  if (sighting.isHidden) {
    return "isHidden";
  }

  if (sighting.isTrailKey) {
    return "isTrailKey";
  }

  if (sighting.isUseful) {
    return "isUseful";
  }

  if (sighting.status === "pending") {
    return "isPending";
  }

  return "isVisible";
}

function createReportIcon() {
  return L.icon({
    iconUrl: markerReportNavy.src,
    iconSize: [72, 72],
    iconAnchor: [36, 64],
    popupAnchor: [0, -58],
  });
}

function createReviewedZoneIcon() {
  return L.icon({
    iconUrl: markerReviewedZone.src,
    iconSize: [44, 56],
    iconAnchor: [19, 45],
    popupAnchor: [0, -42],
  });
}

function createUsefulSightingIcon() {
  return L.icon({
    iconUrl: markerUsefulPin.src,
    iconSize: [44, 56],
    iconAnchor: [19, 45],
    popupAnchor: [0, -42],
  });
}

function createKeySightingIcon() {
  return L.icon({
    className: "keySightingPin",
    iconUrl: markerKeyPin.src,
    iconSize: [44, 56],
    iconAnchor: [19, 45],
    popupAnchor: [0, -42],
  });
}

function getCoordinateKey(lat, lng) {
  return `${Number(lat).toFixed(5)},${Number(lng).toFixed(5)}`;
}

function createSightingIcon(sighting, markerNumber) {
  return L.divIcon({
    className: "",
    html: `<span class="searchMapMarker ${getSightingMarkerClass(sighting)}">${markerNumber}</span>`,
    iconSize: [42, 42],
    iconAnchor: [21, 21],
    popupAnchor: [0, -18],
  });
}

function getActivityClusterClass(cluster) {
  if ((cluster.hiddenCount ?? 0) >= cluster.count) {
    return "isHidden";
  }

  if ((cluster.trailKeyCount ?? 0) > 0 || cluster.count >= 12) {
    return "isHot";
  }

  if ((cluster.usefulCount ?? 0) > 0) {
    return "isUseful";
  }

  if ((cluster.pendingCount ?? 0) > 0) {
    return "isPending";
  }

  return "isNormal";
}

function getActivityClusterSize(count) {
  if (count >= 30) {
    return 74;
  }

  if (count >= 12) {
    return 66;
  }

  if (count >= 6) {
    return 60;
  }

  return 54;
}

function createActivityClusterIcon(cluster) {
  const size = getActivityClusterSize(cluster.count);

  return L.divIcon({
    className: "",
    html: `
      <span class="searchActivityCluster ${getActivityClusterClass(cluster)}">
        <strong>${cluster.count > 99 ? "99+" : cluster.count}</strong>
        <small>Lo vi</small>
      </span>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -Math.round(size / 2)],
  });
}

function clusterMatchesVisibleTypes(cluster, visibleTypes) {
  const trailKeyCount = cluster.trailKeyCount ?? 0;
  const usefulCount = cluster.usefulCount ?? 0;
  const pendingCount = cluster.pendingCount ?? 0;
  const hiddenCount = cluster.hiddenCount ?? 0;
  const normalCount = cluster.count - usefulCount - pendingCount - hiddenCount;

  return (visibleTypes.trailKey && trailKeyCount > 0)
    || (visibleTypes.useful && usefulCount > trailKeyCount)
    || (visibleTypes.pending && pendingCount > 0)
    || (visibleTypes.hidden && hiddenCount > 0)
    || (visibleTypes.normal && normalCount > 0);
}

function DotsIcon({ count }) {
  const positions = count === 4
    ? [
        [5, 5],
        [15, 5],
        [5, 15],
        [15, 15],
      ]
    : [
        [10, 4],
        [4, 16],
        [16, 16],
      ];

  return (
    <svg aria-hidden="true" className="mapFilterDotsIcon" viewBox="0 0 20 20">
      {positions.map(([cx, cy]) => (
        <circle cx={cx} cy={cy} key={`${cx}-${cy}`} r="2.8" />
      ))}
    </svg>
  );
}

function formatMapDate(value) {
  if (!value) {
    return "Fecha no disponible";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Fecha no disponible";
  }

  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function toDateTimeLocalValue(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return toDateTimeLocalValue(new Date());
  }

  const offsetMs = date.getTimezoneOffset() * 60 * 1000;

  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function InitialMapFit({ positions }) {
  const map = useMap();
  const hasFittedRef = useRef(false);

  useEffect(() => {
    if (hasFittedRef.current || positions.length <= 1) {
      return;
    }

    hasFittedRef.current = true;
    map.fitBounds(L.latLngBounds(positions), {
      maxZoom: 15,
      padding: [34, 34],
    });
  }, [map, positions]);

  return null;
}

function ClusterFocus({ cluster }) {
  const map = useMap();

  useEffect(() => {
    if (!cluster) {
      return;
    }

    if (cluster.bounds) {
      map.fitBounds(
        [
          [cluster.bounds.south, cluster.bounds.west],
          [cluster.bounds.north, cluster.bounds.east],
        ],
        { maxZoom: 14, padding: [28, 28] },
      );
      return;
    }

    map.flyTo(cluster.coordinates, Math.min(map.getZoom() + 2, 14), { duration: 0.7 });
  }, [cluster, map]);

  return null;
}

function MapRestoreSync(){
  const map = useMap();

  useEffect(() => {
    const refreshMapSize = () => {
      window.setTimeout(() => {
        map.invalidateSize();
      },80);
    };

 

    window.addEventListener("huellamigo:history-restore", refreshMapSize);
    document.addEventListener("visibilitychange", refreshMapSize);

    refreshMapSize();

    return () => {
      window.removeEventListener("huellamigo:history-restore", refreshMapSize);
      document.removeEventListener("visibilitychange", refreshMapSize);
    };
  }, [map]);

  return null;

}

function MapInstanceSync({ mapRef }) {
  const map = useMap();

  useEffect(() => {
    mapRef.current = map;

    return () => {
      if (mapRef.current === map) {
        mapRef.current = null;
      }
    };
  }, [map, mapRef]);

  return null;
}


function ViewportSightingMapLoader({ reportId, token, onItemsChange, onStatusChange }) {
  const lastRequestKeyRef = useRef("");
  const requestIdRef = useRef(0);

  const loadMapItems = async (map) => {
    const bbox = getMapBbox(map);
    const zoom = map.getZoom();
    const requestKey = `${zoom}:${bbox.map((value) => value.toFixed(5)).join(",")}`;

    if (requestKey === lastRequestKeyRef.current) {
      return;
    }

    lastRequestKeyRef.current = requestKey;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    onStatusChange("loading");

    try {
      
      const payload = await getManagedSightingMap(reportId, token, {
        bbox,
        zoom,
        
      });

      if (requestId !== requestIdRef.current) {
        return;
      }

      onItemsChange(payload.items);
      onStatusChange("ready");
    } catch {
      if (requestId !== requestIdRef.current) {
        return;
      }

      onStatusChange("error");
    }
  };

  const map = useMapEvents({
    moveend() {
      loadMapItems(map).catch(() => {});
    },
    zoomend() {
      loadMapItems(map).catch(() => {});
    },
  });

  useEffect(() => {
    loadMapItems(map).catch(() => {});
  }, [map, reportId, token]);

  return null;
}

export function ManageSearchMapClient({ report, token, sightings }) {
  const mapRef = useRef(null);
  const mapPanelRef = useRef(null);
  const reviewedZonesPanelRef = useRef(null);
  const [verticalBoundary, setVerticalBoundary] = useState(null);
  const [focusedCluster, setFocusedCluster] = useState(null);
  const [mapItems, setMapItems] = useState([]);
  const [mapStatus, setMapStatus] = useState("loading");
  const [reviewedZones, setReviewedZones] = useState([]);
  const [reviewedZonesStatus, setReviewedZonesStatus] = useState("loading");
  const [draftZone, setDraftZone] = useState(null);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewCheckedAt, setReviewCheckedAt] = useState(() => toDateTimeLocalValue());
  const [reviewMessage, setReviewMessage] = useState("");
  const [reviewActionId, setReviewActionId] = useState(null);
  const [showReviewedZones, setShowReviewedZones] = useState(false);
  const [visibleTypes, setVisibleTypes] = useState({
    trailKey: true,
    useful: true,
    pending: false,
    normal: false,
    hidden: false,
  });
  const [showAllPending, setShowAllPending] = useState(false);
  const reportPosition = report.coordinates;
  const reportIcon = useMemo(() => createReportIcon(), []);
  const reviewedZoneIcon = useMemo(() => createReviewedZoneIcon(), []);
  const usefulSightingIcon = useMemo(() => createUsefulSightingIcon(), []);
  const keySightingIcon = useMemo(() => createKeySightingIcon(), []);
  const positionedSightings = useMemo(() => sightings.filter(hasValidSightingPosition), [sightings]);
  const trailSightings = useMemo(() => getMapTrailSightings(positionedSightings), [positionedSightings]);
  const stableSightingNumberById = useMemo(
    () => getStableSightingNumberById(positionedSightings),
    [positionedSightings],
  );
  const visibleClusters = mapItems.filter((item) => (
    item.type === "cluster" && clusterMatchesVisibleTypes(item, visibleTypes)
  ));
  const viewportSightings = sortSightingsByTime(
    mapItems.filter((item) => item.type === "sighting" && hasValidSightingPosition(item)),
  );
  const pendingSightings = viewportSightings.filter((sighting) => sighting.status === "pending" && !sighting.isHidden);
  const reviewedZoneCoordinateKeys = new Set(
    reviewedZones.map((zone) => getCoordinateKey(zone.lat, zone.lng)),
  );
  const visiblePendingIds = new Set(
    (showAllPending ? pendingSightings : pendingSightings.slice(-pendingPreviewLimit)).map((sighting) => sighting.id),
  );
  const hiddenPendingCount = Math.max(pendingSightings.length - visiblePendingIds.size, 0);
  const visibleSightings = viewportSightings.filter((sighting) => {
    if (reviewedZoneCoordinateKeys.has(getCoordinateKey(sighting.lat, sighting.lng))) {
      return false;
    }

    if (sighting.isHidden) {
      return visibleTypes.hidden;
    }

    if (sighting.isTrailKey) {
      return visibleTypes.trailKey;
    }

    if (sighting.isUseful) {
      return visibleTypes.useful;
    }

    if (sighting.status === "pending") {
      return visibleTypes.pending && visiblePendingIds.has(sighting.id);
    }

    return visibleTypes.normal;
  });
  const trailPositions = trailSightings.map((sighting) => [sighting.lat, sighting.lng]);
  const allPositions = [
    reportPosition,
    ...trailPositions,
  ];
  const toggleVisibleType = (type) => {
    setVisibleTypes((currentTypes) => ({
      ...currentTypes,
      [type]: !currentTypes[type],
    }));

    if (type === "pending") {
      setShowAllPending(false);
    }
  };
  const areAllTypesVisible = Object.values(visibleTypes).every(Boolean);
  const toggleEverything = () => {
    const nextVisible = !areAllTypesVisible;

    setVisibleTypes({
      trailKey: nextVisible,
      useful: nextVisible,
      pending: nextVisible,
      normal: nextVisible,
      hidden: nextVisible,
    });
    setShowAllPending(nextVisible);
  };
  const startReviewZoneDraft = (sighting) => {
    setDraftZone([sighting.lat, sighting.lng]);
    setReviewNote("");
    setReviewCheckedAt(toDateTimeLocalValue());
    setReviewMessage("");
    window.setTimeout(() => {
      reviewedZonesPanelRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 80);
  };
  const cancelReviewZoneDraft = () => {
    setDraftZone(null);
    setReviewNote("");
    setReviewMessage("");
  };
  const saveReviewZone = async () => {
    if (!draftZone) {
      return;
    }

    setReviewActionId("new");
    setReviewMessage("");

    try {
      const zone = await createReviewedSearchZone(report.id, token, {
        lat: draftZone[0],
        lng: draftZone[1],
        note: reviewNote,
        checkedAt: new Date(reviewCheckedAt).toISOString(),
      });

      setReviewedZones((currentZones) => [zone, ...currentZones]);
      setDraftZone(null);
      setReviewNote("");
      setReviewMessage("Zona marcada como revisada.");
    } catch (error) {
      setReviewMessage(error.message || "No pudimos guardar la zona revisada.");
    } finally {
      setReviewActionId(null);
    }
  };
  const removeReviewZone = async (zoneId) => {
    setReviewActionId(zoneId);
    setReviewMessage("");

    try {
      await deleteReviewedSearchZone(report.id, token, zoneId);
      setReviewedZones((currentZones) => currentZones.filter((zone) => zone.id !== zoneId));
      setReviewMessage("Zona revisada eliminada.");
    } catch (error) {
      setReviewMessage(error.message || "No pudimos eliminar la zona revisada.");
    } finally {
      setReviewActionId(null);
    }
  };
  const focusReviewedZone = (zone) => {
    const map = mapRef.current;

    mapPanelRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });

    if (!map) {
      return;
    }

    window.setTimeout(() => {
      map.flyTo([zone.lat, zone.lng], Math.max(map.getZoom(), 15), { duration: 0.7 });
    }, 180);
  };

  useEffect(() => {
    let mounted = true;

    setReviewedZonesStatus("loading");

    getReviewedSearchZones(report.id, token)
      .then((zones) => {
        if (mounted) {
          setReviewedZones(zones);
          setReviewedZonesStatus("ready");
        }
      })
      .catch(() => {
        if (mounted) {
          setReviewedZones([]);
          setReviewedZonesStatus("error");
        }
      });

    return () => {
      mounted = false;
    };
  }, [report.id, token]);

  return (
    <section className="manageSearchMapPanel" aria-labelledby="manage-search-map-title">
      <div className="manageSearchMapHeader">
        <div>
          <p className="eyebrow">Mapa privado</p>
          <h2 id="manage-search-map-title">Rastro temporal</h2>
          <p>El punto azul es el reporte original. Los números muestran pistas en orden de tiempo.</p>
        </div>
      </div>

      <div className="manageSearchMap" ref={mapPanelRef}>
        <MapContainer
          center={trailPositions.at(-1) ?? reportPosition}
          className="realMap"
          maxBounds={mapVerticalBounds}
          maxBoundsViscosity={1}
          minZoom={minMapZoom}
          scrollWheelZoom
          zoom={14}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            minZoom={minMapZoom}
            noWrap
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <InitialMapFit positions={allPositions} />

          <Marker icon={reportIcon} position={reportPosition}>
            <Popup>
              <strong>Reporte original</strong>
              <span>{report.zone}</span>
            </Popup>
          </Marker>

          {reviewedZones.map((zone) => (
            <Circle
              center={[zone.lat, zone.lng]}
              key={zone.id}
              pathOptions={{
                color: "#6f7f78",
                fillColor: "#6f7f78",
                fillOpacity: 0.12,
                opacity: 0.62,
                weight: 2,
              }}
              radius={zone.radiusM ?? reviewedZoneRadiusMeters}
            />
          ))}

          {reviewedZones.map((zone) => (
            <Marker
              icon={reviewedZoneIcon}
              key={`${zone.id}-pin`}
              position={[zone.lat, zone.lng]}
            >
              <Popup>
                <strong>Zona revisada</strong>
                <span>{formatMapDate(zone.checkedAt)}</span>
                {zone.note ? <span>{zone.note}</span> : null}
              </Popup>
            </Marker>
          ))}

          {draftZone ? (
            <Circle
              center={draftZone}
              pathOptions={{
                color: "#4d8fac",
                dashArray: "8 8",
                fillColor: "#4d8fac",
                fillOpacity: 0.12,
                opacity: 0.8,
                weight: 2,
              }}
              radius={reviewedZoneRadiusMeters}
            />
          ) : null}

          {trailPositions.length >= 2 ? (
            <Polyline
              pathOptions={{
                color: "#214e45",
                dashArray: "8 8",
                opacity: 0.72,
                weight: 4,
              }}
              positions={trailPositions}
            />
          ) : null}

          {visibleClusters.map((cluster) => (
            <Marker
              eventHandlers={{
                click: () => setFocusedCluster(cluster),
              }}
              icon={createActivityClusterIcon(cluster)}
              key={`${cluster.bounds?.west ?? cluster.coordinates[1]}-${cluster.bounds?.south ?? cluster.coordinates[0]}`}
              position={cluster.coordinates}
            >
              <Popup>
                <strong>{cluster.count} pistas en esta zona</strong>
                <span>{cluster.trailKeyCount ?? 0} pistas clave</span>
                <span>{cluster.usefulCount} marcadas útiles</span>
                <span>{cluster.pendingCount} pendientes</span>
                <span>{cluster.hiddenCount} descartadas</span>
              </Popup>
            </Marker>
          ))}

          {visibleSightings.map((sighting, index) => (
            <Marker
              icon={
                sighting.isTrailKey
                  ? keySightingIcon
                  : sighting.isUseful
                    ? usefulSightingIcon
                    : createSightingIcon(sighting, stableSightingNumberById.get(sighting.id) ?? index + 1)
              }
              key={sighting.id}
              opacity={sighting.isHidden ? 0.58 : 1}
              position={[sighting.lat, sighting.lng]}
            >
              <Popup>
                <strong>{getSightingStatusLabel(sighting)}</strong>
                <span>Confianza {getSightingConfidenceLabel(sighting)} ({sighting.confidenceScore}/100)</span>
                <span>{formatMapDate(sighting.seenAt ?? sighting.createdAt)}</span>
                <span>{sighting.comment || "Sin comentario adicional."}</span>
                {sighting.isTrailKey || sighting.isUseful ? (
                  <button
                    className="mapPopupAction"
                    onClick={() => startReviewZoneDraft(sighting)}
                    type="button"
                  >
                    Marcar zona revisada
                  </button>
                ) : null}
              </Popup>
            </Marker>
          ))}

          <ClusterFocus cluster={focusedCluster} />
          <MapRestoreSync />
          <MapInstanceSync mapRef={mapRef} />
          <MapBoundaryWatcher onBoundaryChange={setVerticalBoundary} />
          <ViewportSightingMapLoader
            reportId={report.id}
            token={token}
            onItemsChange={setMapItems}
            onStatusChange={setMapStatus}
          />
        </MapContainer>

        {verticalBoundary ? <div className={`mapBoundaryIndicator ${verticalBoundary}`} /> : null}
      </div>

      <div className="mapFilterToolbar" aria-label="Filtros del mapa de rastro">
        <button
          className={`mapFilterChip trailKey ${visibleTypes.trailKey ? "isActive" : ""}`}
          onClick={() => toggleVisibleType("trailKey")}
          type="button"
        >
          <Star size={20} />
          Pista clave
        </button>
        <button
          className={`mapFilterChip useful ${visibleTypes.useful ? "isActive" : ""}`}
          onClick={() => toggleVisibleType("useful")}
          type="button"
        >
          <MapPinIcon size={20} />
          Util
        </button>
        <button
          className={`mapFilterChip pending ${visibleTypes.pending ? "isActive" : ""}`}
          onClick={() => toggleVisibleType("pending")}
          type="button"
        >
          <Clock size={20} />
          Pendiente
        </button>
        <button
          className={`mapFilterChip normal ${visibleTypes.normal ? "isActive" : ""}`}
          onClick={() => toggleVisibleType("normal")}
          type="button"
        >
          <DotsIcon count={3} />
          Otros
        </button>
        <button
          className={`mapFilterChip hidden ${visibleTypes.hidden ? "isActive" : ""}`}
          onClick={() => toggleVisibleType("hidden")}
          type="button"
        >
          <XCircle size={20} />
          No me sirve
        </button>
        <button
          aria-pressed={areAllTypesVisible}
          className={`mapFilterChip showAll ${areAllTypesVisible ? "isActive" : ""}`}
          onClick={toggleEverything}
          type="button"
        >
          <DotsIcon count={4} />
          {areAllTypesVisible ? "Ocultar todo" : "Mostrar todo"}
        </button>
      </div>

      {visibleTypes.pending && hiddenPendingCount > 0 ? (
        <button className="mapPendingMoreButton" onClick={() => setShowAllPending(true)} type="button">
          Mostrar todos los pendientes ({pendingSightings.length})
        </button>
      ) : null}

      <section className={`reviewedZonesPanel ${showReviewedZones || draftZone ? "isOpen" : ""}`} aria-label="Zonas revisadas" ref={reviewedZonesPanelRef}>
        <div className="reviewedZonesHeader">
          <div>
            <p className="eyebrow"><PawPrint size={16} aria-hidden="true" /> Cobertura privada</p>
            <h3>Zonas revisadas <Heart size={30} aria-hidden="true" /></h3>
            <p>Herramienta opcional para recordar lugares que ya se buscaron.</p>
          </div>
          <button
            aria-expanded={showReviewedZones || Boolean(draftZone)}
            className={`secondaryButton reviewedZonesToggle ${showReviewedZones || draftZone ? "isActive" : ""}`}
            onClick={() => setShowReviewedZones((currentValue) => !currentValue)}
            type="button"
          >
            <ChevronDown size={18} />
            {showReviewedZones || draftZone ? "Ocultar" : reviewedZones.length > 0 ? `Ver ${reviewedZones.length}` : "Abrir"}
          </button>
          <div className="reviewedZonesHeaderArt" aria-hidden="true">
            <span />
            <MapPinIcon size={46} />
            <PawPrint size={34} />
          </div>
        </div>

        {showReviewedZones || draftZone ? (
          <>
            <p className="reviewedZonesHelp">
          Abre una pista útil o clave en el mapa y usa "Marcar zona revisada". Se guardará un radio aproximado de 500 m.
        </p>

        {draftZone ? (
          <div className="reviewedZoneForm">
            <label>
              Nota
              <input
                maxLength={reviewedZoneNoteMaxLength}
                onChange={(event) => setReviewNote(event.target.value)}
                placeholder="Ej. Revisado por vecinos"
                value={reviewNote}
              />
            </label>
            <label>
              Fecha y hora revisada
              <input
                max={toDateTimeLocalValue()}
                onChange={(event) => setReviewCheckedAt(event.target.value)}
                type="datetime-local"
                value={reviewCheckedAt}
              />
            </label>
            <div className="reviewedZoneActions">
              <button
                className="primaryButton"
                disabled={reviewActionId === "new"}
                onClick={saveReviewZone}
                type="button"
              >
                Guardar zona
              </button>
              <button className="secondaryButton" onClick={cancelReviewZoneDraft} type="button">
                Cancelar
              </button>
            </div>
            <span>{reviewNote.length}/{reviewedZoneNoteMaxLength}</span>
          </div>
        ) : null}

        {reviewMessage ? <p className="formMessage">{reviewMessage}</p> : null}

            <div className="reviewedZonesList">
          {reviewedZonesStatus === "loading" ? (
            <p>Cargando zonas revisadas...</p>
          ) : reviewedZonesStatus === "error" ? (
            <p>No pudimos cargar las zonas revisadas.</p>
          ) : reviewedZones.length > 0 ? (
            reviewedZones.map((zone) => (
              <article
                className="reviewedZoneItem"
                key={zone.id}
                onClick={() => focusReviewedZone(zone)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    focusReviewedZone(zone);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <div className="reviewedZoneInfo">
                  <span className="reviewedZoneIcon" aria-hidden="true">
                    <img src={markerReviewedZone.src} alt="" />
                  </span>
                  <div>
                    <strong>{zone.note || "Zona revisada"}</strong>
                    <span>{formatMapDate(zone.checkedAt)}</span>
                  </div>
                </div>
                <button
                  className="secondaryButton dangerButton"
                  disabled={reviewActionId === zone.id}
                  onClick={(event) => {
                    event.stopPropagation();
                    removeReviewZone(zone.id);
                  }}
                  type="button"
                >
                  <Trash2 size={18} />
                  Eliminar
                </button>
              </article>
            ))
          ) : (
            <p>Aún no hay zonas revisadas.</p>
          )}
            </div>
          </>
        ) : null}
      </section>

      <p className="manageSearchMapLimitNote">
        {mapStatus === "loading"
          ? "Actualizando pistas visibles..."
          : mapStatus === "error"
            ? "No pudimos cargar las pistas visibles del mapa."
            : visibleClusters.length > 0
              ? `Mostrando ${visibleClusters.length} grupos de pistas en esta zona.`
              : `Mostrando ${visibleSightings.length} pistas visibles en esta zona.`}
      </p>
    </section>
  );
}

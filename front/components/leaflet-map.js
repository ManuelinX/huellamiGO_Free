"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { Eye } from "lucide-react";
import { MapBoundaryWatcher } from "@/components/map-boundary-indicator";
import { getMapLostPetReports } from "@/lib/reports";
import { createClusterIcon, createPetIcon, getMapBbox } from "@/components/leaflet-map-utils";

const minMapZoom = 4;
const mapVerticalBounds = [
  [-85, -180],
  [85, 180],
];

function MapFocus({ pet }) {
  const map = useMap();

  useEffect(() => {
    if (pet) {
      map.flyTo(pet.coordinates, 15, { duration: 0.7 });
    }
  }, [map, pet]);

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

function MapRestoreSync() {
  const map = useMap();

  useEffect(() => {
    const refreshMapSize = () => {
      window.setTimeout(() => {
        map.invalidateSize();
      }, 80);
    };

    window.addEventListener("huellamigo:history-restore", refreshMapSize);
    document.addEventListener("visibilitychange", refreshMapSize);

    return () => {
      window.removeEventListener("huellamigo:history-restore", refreshMapSize);
      document.removeEventListener("visibilitychange", refreshMapSize);
    };
  }, [map]);

  return null;
}

function ViewportReportLoader({ onReportsChange }) {
  const loadReports = async (map) => {
    const reports = await getMapLostPetReports({
      bbox: getMapBbox(map),
      zoom: map.getZoom(),
    });
    onReportsChange(reports);
  };

  const map = useMapEvents({
    moveend() {
      loadReports(map).catch(() => {});
    },
    zoomend() {
      loadReports(map).catch(() => {});
    },
  });

  useEffect(() => {
    loadReports(map).catch(() => {});
  }, [map]);

  return null;
}

function buildOverlappingReportGroups({ map, reports, thresholdPx = 40 }) {
  const groups = [];

  reports.forEach((report) => {
    const point = map.latLngToLayerPoint(report.coordinates);
    const matchingGroup = groups.find((group) => point.distanceTo(group.point) <= thresholdPx);

    if (!matchingGroup) {
      groups.push({
        id: report.id,
        point,
        items: [report],
      });
      return;
    }

    matchingGroup.items.push(report);
    matchingGroup.point = matchingGroup.items.reduce(
      (sum, item) => sum.add(map.latLngToLayerPoint(item.coordinates)),
      L.point(0, 0),
    ).divideBy(matchingGroup.items.length);
  });

  return groups.map((group) => {
    const center = group.items.reduce(
      (sum, item) => [sum[0] + item.coordinates[0], sum[1] + item.coordinates[1]],
      [0, 0],
    );

    return {
      ...group,
      id: group.items.map((item) => item.id).join("-"),
      coordinates: [
        center[0] / group.items.length,
        center[1] / group.items.length,
      ],
    };
  });
}

function OverlappingReportLayer({
  reports,
  selectedId,
  icons,
  onSelectGroup,
  onSelectReport,
}) {
  const map = useMap();
  const [viewportVersion, setViewportVersion] = useState(0);

  useMapEvents({
    moveend() {
      setViewportVersion((currentVersion) => currentVersion + 1);
    },
    zoomend() {
      setViewportVersion((currentVersion) => currentVersion + 1);
    },
  });

  const reportGroups = useMemo(
    () => buildOverlappingReportGroups({ map, reports }),
    [map, reports, viewportVersion],
  );

  return (
    <>
      {reportGroups.map((group) => {
        if (group.items.length > 1) {
          return (
            <Marker
              eventHandlers={{
                click: () => onSelectGroup(group),
              }}
              icon={createClusterIcon(group.items.length)}
              key={group.id}
              position={group.coordinates}
            />
          );
        }

        const pet = group.items[0];

        return (
          <Marker
            eventHandlers={{
              click: () => onSelectReport(pet),
            }}
            icon={pet.id === selectedId ? icons.active : icons.idle}
            key={pet.id}
            position={pet.coordinates}
          >
            <Popup>
              <strong>{pet.name}</strong>
              <span>{pet.zone}</span>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}

export function LeafletMap({ pets }) {
  const [mapItems, setMapItems] = useState([]);
  const [selectedPet, setSelectedPet] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [focusedPet, setFocusedPet] = useState(null);
  const [focusedCluster, setFocusedCluster] = useState(null);
  const [isCardOpen, setIsCardOpen] = useState(false);
  const [verticalBoundary, setVerticalBoundary] = useState(null);
  const visiblePets = mapItems.filter((item) => item.type === "report");
  const visibleClusters = mapItems.filter((item) => item.type === "cluster");
  const selectedId = selectedPet?.id ?? null;
  const center = pets[0]?.coordinates ?? [19.4326, -99.1332];
  const icons = useMemo(
    () => ({
      active: createPetIcon(true),
      idle: createPetIcon(false),
    }),
    [],
  );

  return (
    <section className="mapShell" aria-label="Mapa de mascotas perdidas">
      <MapContainer
        center={center}
        zoom={14}
        minZoom={minMapZoom}
        maxBounds={mapVerticalBounds}
        maxBoundsViscosity={1}
        scrollWheelZoom
        className="realMap"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          minZoom={minMapZoom}
          noWrap
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <OverlappingReportLayer
          icons={icons}
          onSelectGroup={(group) => {
            setSelectedGroup(group);
            setSelectedPet(null);
            setFocusedPet(null);
            setFocusedCluster(null);
            setIsCardOpen(true);
          }}
          onSelectReport={(pet) => {
            setSelectedGroup(null);
            setSelectedPet(pet);
            setFocusedPet(pet);
            setFocusedCluster(null);
            setIsCardOpen(true);
          }}
          reports={visiblePets}
          selectedId={selectedId}
        />

        {visibleClusters.map((cluster) => (
          <Marker
            eventHandlers={{
              click: () => {
                setFocusedCluster(cluster);
                setFocusedPet(null);
                setSelectedGroup(null);
                setSelectedPet(null);
                setIsCardOpen(false);
              },
            }}
            icon={createClusterIcon(cluster.count)}
            key={`${cluster.bounds?.west ?? cluster.coordinates[1]}-${cluster.bounds?.south ?? cluster.coordinates[0]}`}
            position={cluster.coordinates}
          />
        ))}

        <MapFocus pet={focusedPet} />
        <ClusterFocus cluster={focusedCluster} />
        <MapRestoreSync />
        <MapBoundaryWatcher onBoundaryChange={setVerticalBoundary} />
        <ViewportReportLoader onReportsChange={setMapItems} />
      </MapContainer>

      {verticalBoundary ? <div className={`mapBoundaryIndicator ${verticalBoundary}`} /> : null}

      {isCardOpen && selectedGroup ? (
        <article className="mapCard mapGroupCard">
          <button
            className="mapCardClose"
            onClick={() => {
              setIsCardOpen(false);
              setSelectedGroup(null);
              setSelectedPet(null);
            }}
            type="button"
            aria-label="Cerrar reportes en esta zona"
          >
            x
          </button>
          <p className="eyebrow">Reportes en esta zona</p>
          <h3>{selectedGroup.items.length} reportes cercanos</h3>
          <div className="mapGroupList">
            {selectedGroup.items.map((pet) => (
              <Link className="mapGroupItem" href={`/mascotas/${pet.slug}`} key={pet.id}>
                <span className={`mapGroupPhoto ${pet.avatarClass}`} aria-hidden="true">
                  {pet.photoUrl ? <img src={pet.photoUrl} alt="" /> : <span>{pet.name?.charAt(0)?.toUpperCase() ?? "?"}</span>}
                </span>
                <span>
                  <strong>{pet.name}</strong>
                  <small>{pet.zone}</small>
                </span>
              </Link>
            ))}
          </div>
        </article>
      ) : isCardOpen && selectedPet ? (
        <article className="mapCard">
          <button
            className="mapCardClose"
            onClick={() => {
              setIsCardOpen(false);
              setSelectedPet(null);
            }}
            type="button"
            aria-label="Cerrar reporte seleccionado"
          >
            x
          </button>
          <div className="mapCardSummary">
            <div className={`mapCardPhoto ${selectedPet.avatarClass}`} aria-hidden="true">
              {selectedPet.photoUrl ? (
                <img src={selectedPet.photoUrl} alt="" />
              ) : (
                <span>{selectedPet.name?.charAt(0)?.toUpperCase() ?? "?"}</span>
              )}
            </div>
            <div>
              <p className="eyebrow">Reporte seleccionado</p>
              <h3>{selectedPet.name}</h3>
              <p>{selectedPet.shortDescription}</p>
            </div>
          </div>
          <div className="mapMeta">
            <span>{selectedPet.zone}</span>
            <span>{selectedPet.lastSeenWhen}</span>
            {selectedPet.reward?.enabled ? <span>Recompensa disponible</span> : null}
          </div>
          <Link className="primaryButton" href={`/mascotas/${selectedPet.slug}`}>
            <Eye size={18} />
            Ver reporte
          </Link>
        </article>
      ) : null}
    </section>
  );
}

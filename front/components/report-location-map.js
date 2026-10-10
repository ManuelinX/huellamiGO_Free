"use client";

import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { Circle, MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { Crosshair, LocateFixed, MapPin } from "lucide-react";
import { MapBoundaryWatcher } from "@/components/map-boundary-indicator";
import { reverseGeocode } from "@/lib/geocoding";
import markerLostCoral from "../assets/maps/public/lost-coral.webp";

const defaultPosition = [19.41273, -99.16988];
const desiredAccuracyMeters = 90;
const maxLocationWaitMs = 2500;
const minMapZoom = 4;
const mapVerticalBounds = [
  [-85, -180],
  [85, 180],
];

function PickEvents({ onPick }) {
  useMapEvents({
    click(event) {
      onPick([event.latlng.lat, event.latlng.lng]);
    },
  });

  return null;
}

function RecenterMap({ position, zoom }) {
  const map = useMap();

  useEffect(() => {
    map.setView(position, zoom);
  }, [map, position, zoom]);

  return null;
}

function createPickerIcon() {
  return L.icon({
    iconUrl: markerLostCoral.src,
    iconSize: [72, 72],
    iconAnchor: [36, 64],
  });
}

export function ReportLocationMap({
  inputNames = { lat: "lastSeenLat", lng: "lastSeenLng" },
  initialPosition = defaultPosition,
  onPositionChange = null,
  markerLabel = "Última ubicación",
  requireSelection = false,
  title = "Marca el punto aproximado",
}) {
  const [position, setPosition] = useState(initialPosition);
  const [hasSelectedPosition, setHasSelectedPosition] = useState(!requireSelection);
  const [locationStatus, setLocationStatus] = useState("");
  const [locationAccuracy, setLocationAccuracy] = useState(220);
  const [locationSource, setLocationSource] = useState("manual");
  const [isLocating, setIsLocating] = useState(false);
  const [addressLabel, setAddressLabel] = useState("");
  const [isResolvingAddress, setIsResolvingAddress] = useState(false);
  const [verticalBoundary, setVerticalBoundary] = useState(null);
  const icon = useMemo(() => createPickerIcon(), []);
  const lat = position[0].toFixed(5);
  const lng = position[1].toFixed(5);
  const coordinateLabel = `${lat}, ${lng}`;
  const zoom = locationSource === "current" ? 17 : 15;

  useEffect(() => {
    setPosition(initialPosition);
    setHasSelectedPosition(!requireSelection);
  }, [initialPosition[0], initialPosition[1], requireSelection]);

  useEffect(() => {
    let isCurrent = true;

    setIsResolvingAddress(true);

    reverseGeocode({
      lat: position[0],
      lng: position[1],
    })
      .then((result) => {
        if (!isCurrent) {
          return;
        }

        setAddressLabel(result?.formattedAddress || coordinateLabel);
      })
      .catch(() => {
        if (!isCurrent) {
          return;
        }

        setAddressLabel(coordinateLabel);
      })
      .finally(() => {
        if (isCurrent) {
          setIsResolvingAddress(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [coordinateLabel, position]);

  const setManualPosition = (nextPosition) => {
    setPosition(nextPosition);
    setHasSelectedPosition(true);
    setLocationSource("manual");
    setLocationAccuracy(220);
    setLocationStatus("");
    onPositionChange?.({
      lat: nextPosition[0],
      lng: nextPosition[1],
      source: "manual",
    });
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus("Tu navegador no permite usar ubicación actual.");
      return;
    }

    setIsLocating(true);
    setLocationStatus("Buscando ubicación precisa...");

    let bestLocation = null;

    const applyLocation = (location, finished = false) => {
      const accuracy = Math.max(30, Math.round(location.coords.accuracy || 30));
      const nextPosition = [
        location.coords.latitude,
        location.coords.longitude,
      ];

      setPosition(nextPosition);
      setHasSelectedPosition(true);
      setLocationSource("current");
      setLocationAccuracy(accuracy);
      onPositionChange?.({
        lat: nextPosition[0],
        lng: nextPosition[1],
        source: "auto",
      });

      if (accuracy <= desiredAccuracyMeters) {
        setLocationStatus(`Ubicacion precisa lista, radio ${accuracy} m.`);
        return;
      }

      setLocationStatus(
        finished
          ? `Ubicación aproximada lista, radio ${accuracy} m. Puedes ajustar el pin.`
          : `Afinando ubicación... precisión actual ${accuracy} m.`
      );
    };

    const watchId = navigator.geolocation.watchPosition(
      (location) => {
        if (!bestLocation || location.coords.accuracy < bestLocation.coords.accuracy) {
          bestLocation = location;
          applyLocation(location);
        }

        if (location.coords.accuracy <= desiredAccuracyMeters) {
          navigator.geolocation.clearWatch(watchId);
          applyLocation(location, true);
          setIsLocating(false);
        }
      },
      () => {
        setLocationStatus("No pudimos obtener tu ubicación. Puedes marcarla manualmente.");
        setIsLocating(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: maxLocationWaitMs,
      },
    );

    window.setTimeout(() => {
      navigator.geolocation.clearWatch(watchId);

      if (bestLocation) {
        applyLocation(bestLocation, true);
      } else {
        setLocationStatus("No pudimos obtener tu ubicación. Puedes marcarla manualmente.");
      }

      setIsLocating(false);
    }, maxLocationWaitMs);
  };

  return (
    <section className="locationPicker" aria-label="Seleccionar ultimo lugar visto">
      <div className="pickerHeader">
        <div>
          <p className="eyebrow">Última ubicación</p>
          <h3>{title}</h3>
        </div>
        <div className="pickerActions">
          <button
            className="locationButton"
            disabled={isLocating}
            onClick={handleUseCurrentLocation}
            type="button"
          >
            <LocateFixed size={16} />
            {isLocating ? "Buscando..." : "Usar mi ubicación"}
          </button>
          <span>
            <Crosshair size={16} />
            {markerLabel}
          </span>
        </div>
      </div>

      <div className="pickerMap">
        <MapContainer
          center={position}
          zoom={15}
          minZoom={minMapZoom}
          maxBounds={mapVerticalBounds}
          maxBoundsViscosity={1}
          scrollWheelZoom
          className="realMap"
        >
          <RecenterMap position={position} zoom={zoom} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            minZoom={minMapZoom}
            noWrap
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Circle
            center={position}
            pathOptions={{
              color: "#214e45",
              fillColor: "#7fb8a4",
              fillOpacity: 0.18,
              weight: 1,
            }}
            radius={locationAccuracy}
          />
          <Marker
            draggable
            eventHandlers={{
              dragend(event) {
                const marker = event.target;
                const nextPosition = marker.getLatLng();
                setManualPosition([nextPosition.lat, nextPosition.lng]);
              },
            }}
            icon={icon}
            position={position}
          />
          <PickEvents onPick={setManualPosition} />
          <MapBoundaryWatcher onBoundaryChange={setVerticalBoundary} />
        </MapContainer>
        {verticalBoundary ? <div className={`mapBoundaryIndicator ${verticalBoundary}`} /> : null}
      </div>

      <div className="pickerMeta">
        <span>
          <MapPin size={16} />
          {!hasSelectedPosition
            ? "Ubicacion pendiente"
            : locationSource === "current"
              ? "Ubicación actual aproximada"
              : "Zona aproximada"}
        </span>
        <strong>
          {!hasSelectedPosition
            ? "Haz click en el mapa, arrastra el pin o usa tu ubicación."
            : isResolvingAddress
              ? "Buscando dirección..."
              : addressLabel || coordinateLabel}
        </strong>
      </div>
      {locationStatus ? <p className="pickerStatus">{locationStatus}</p> : null}

      <input name={inputNames.lat} type="hidden" value={hasSelectedPosition ? lat : ""} />
      <input name={inputNames.lng} type="hidden" value={hasSelectedPosition ? lng : ""} />
    </section>
  );
}

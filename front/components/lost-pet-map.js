"use client";

import { useEffect, useState } from "react";

function MapLoading() {
  return <div className="mapShell mapLoading">Cargando mapa...</div>;
}

export function LostPetMap({ pets }) {
  const [MapComponent, setMapComponent] = useState(null);
  const [mapKey, setMapKey] = useState(0);

  useEffect(() => {
    let mounted = true;

    import("./leaflet-map").then((module) => {
      if (mounted) {
        setMapComponent(() => module.LeafletMap);
      }
    });

    return () => {
      mounted = false;
    };
  }, [mapKey]);

  useEffect(() => {
    let lastRestoreTick = window.__HUELLAMIGO_HISTORY_RESTORE_TICK__ || 0;

    const remountMap = (event) => {
      const nextRestoreTick = event?.detail?.tick ?? window.__HUELLAMIGO_HISTORY_RESTORE_TICK__ ?? lastRestoreTick + 1;

      if (nextRestoreTick === lastRestoreTick) {
        return;
      }

      lastRestoreTick = nextRestoreTick;
      setMapComponent(null);
      setMapKey((currentKey) => currentKey + 1);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        window.requestAnimationFrame(() => {
          if (document.querySelector(".mapLoading")) {
            setMapComponent(null);
            setMapKey((currentKey) => currentKey + 1);
          }
        });
      }
    };

    window.addEventListener("huellamigo:history-restore", remountMap);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    if (lastRestoreTick > 0) {
      setMapComponent(null);
      setMapKey((currentKey) => currentKey + 1);
    }

    return () => {
      window.removeEventListener("huellamigo:history-restore", remountMap);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  if (!MapComponent) {
    return <MapLoading />;
  }

  return <MapComponent key={mapKey} pets={pets} />;
}

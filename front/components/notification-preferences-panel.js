"use client";

import { useEffect, useState, useTransition } from "react";
import { Clock3, MapPin, Save, Settings2 } from "lucide-react";
import { LocationPicker } from "@/components/location-picker";
import { PushNotificationToggle } from "@/components/push-notification-toggle";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "@/lib/notifications";
import { getUserErrorMessage } from "@/lib/user-messages";

const defaultAlertPosition = [19.41273, -99.16988];

export function NotificationPreferencesPanel() {
  const [preferences, setPreferences] = useState(null);
  const [alertDraft, setAlertDraft] = useState({
    lat: defaultAlertPosition[0],
    lng: defaultAlertPosition[1],
    source: "manual",
  });
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const loadPreferences = () => {
    startTransition(async () => {
      setMessage("");

      try {
        const nextPreferences = await getNotificationPreferences();
        setPreferences(nextPreferences);
        setAlertDraft({
          lat: nextPreferences.alertLat ?? defaultAlertPosition[0],
          lng: nextPreferences.alertLng ?? defaultAlertPosition[1],
          source: nextPreferences.locationSource ?? "manual",
        });
      } catch (error) {
        setMessage(getUserErrorMessage(error, "No pudimos cargar tus preferencias."));
      }
    });
  };

  useEffect(() => {
    loadPreferences();
  }, []);

  const savePreferences = (nextPreferences) => {
    setPreferences(nextPreferences);
    startTransition(async () => {
      setMessage("");

      try {
        const savedPreferences = await updateNotificationPreferences(nextPreferences);
        setPreferences(savedPreferences);
        setAlertDraft({
          lat: savedPreferences.alertLat ?? defaultAlertPosition[0],
          lng: savedPreferences.alertLng ?? defaultAlertPosition[1],
          source: savedPreferences.locationSource ?? "manual",
        });
        setMessage("Guardado.");
      } catch (error) {
        setMessage(getUserErrorMessage(error, "No pudimos guardar tus preferencias."));
        loadPreferences();
      }
    });
  };

  const saveAlertZone = () => {
    if (!preferences) {
      return;
    }

    savePreferences({
      ...preferences,
      alertLat: alertDraft.lat,
      alertLng: alertDraft.lng,
      alertPlaceLabel: "Zona de alertas",
      locationSource: alertDraft.source,
    });
  };

  return (
    <section className="notificationPreferences" aria-labelledby="notification-preferences-title">
      <div className="notificationPreferencesHead">
        <div>
          <p className="eyebrow">Control</p>
          <h3 id="notification-preferences-title">Alertas y avisos</h3>
        </div>
        <Settings2 size={18} />
      </div>

      {preferences ? (
        <div className="notificationPreferenceList">
          <label className="notificationToggle">
            <span>
              <strong>Lo vi de mis mascotas</strong>
              <small>Avísame cuando alguien mande un Lo vi en uno de mis reportes.</small>
            </span>
            <input
              checked={preferences.notifySightingUpdates}
              disabled={isPending}
              onChange={(event) => savePreferences({
                ...preferences,
                notifySightingUpdates: event.target.checked,
              })}
              type="checkbox"
            />
          </label>

          <label className="notificationToggle">
            <span>
              <strong>Alertas cercanas</strong>
              <small>Avísame cuando el sistema detecte reportes importantes cerca de mi zona.</small>
            </span>
            <input
              checked={preferences.notifyNearbyReports}
              disabled={isPending}
              onChange={(event) => savePreferences({
                ...preferences,
                notifyNearbyReports: event.target.checked,
              })}
              type="checkbox"
            />
          </label>

          <PushNotificationToggle />

          <section className="notificationAlertZone" aria-label="Zona base de alertas">
            <div className="notificationAlertZoneHead">
              <span>
                <strong>Zona base de alertas</strong>
                <small>
                  {preferences.alertLat && preferences.alertLng
                    ? `${Number(preferences.alertLat).toFixed(5)}, ${Number(preferences.alertLng).toFixed(5)}`
                    : "Marca la zona desde donde quieres recibir alertas cercanas."}
                </small>
              </span>
              <MapPin size={18} />
            </div>

            <LocationPicker
              initialPosition={[alertDraft.lat, alertDraft.lng]}
              inputNames={{ lat: "alertLat", lng: "alertLng" }}
              markerLabel="Zona de alertas"
              onPositionChange={setAlertDraft}
              title="Marca tu zona base"
            />

            <button className="primaryButton fullWidth" disabled={isPending} onClick={saveAlertZone} type="button">
              <Save size={18} />
              Guardar zona de alertas
            </button>
          </section>
        </div>
      ) : (
        <div className="notificationsEmpty compact">
          <Clock3 size={18} />
          <p>Cargando preferencias...</p>
        </div>
      )}

      {message ? <p className="formMessage">{message}</p> : null}
    </section>
  );
}

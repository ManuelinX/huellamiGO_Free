"use client";

import { useEffect, useState, useTransition } from "react";
import { BellRing, BellOff, Smartphone } from "lucide-react";
import {
  deleteWebPushSubscription,
  getWebPushConfig,
  getWebPushSubscriptions,
  saveWebPushSubscription,
} from "@/lib/notifications";
import { getUserErrorMessage } from "@/lib/user-messages";

function urlBase64ToUint8Array(value) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}

function isWebPushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window &&
    window.isSecureContext
  );
}

function getPushRegistrationErrorMessage(error) {
  const message = error?.message ?? "";

  if (/push service error|registration failed/i.test(message)) {
    return "En Brave activa la opción: Usar servicios de Google para mensajes de inserción.";
  }

  return getUserErrorMessage(error, "No pudimos activar push en este dispositivo.");
}

async function getBrowserSubscription() {
  const registration = await getReadyServiceWorkerRegistration();
  return registration?.pushManager.getSubscription() ?? null;
}

async function getReadyServiceWorkerRegistration() {
  const existingRegistration = await navigator.serviceWorker.getRegistration();

  if (existingRegistration?.active) {
    return existingRegistration;
  }

  await navigator.serviceWorker.register("/huellamigo-sw.js");
  return navigator.serviceWorker.ready;
}

export function PushNotificationToggle() {
  const [config, setConfig] = useState(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const supported = isWebPushSupported();

  const loadPushState = () => {
    startTransition(async () => {
      setMessage("");

      try {
        const nextConfig = await getWebPushConfig();
        setConfig(nextConfig);

        if (!supported || !nextConfig.enabled) {
          setIsSubscribed(false);
          return;
        }

        const [browserSubscription, serverSubscriptions] = await Promise.all([
          getBrowserSubscription(),
          getWebPushSubscriptions(),
        ]);

        setIsSubscribed(Boolean(
          browserSubscription &&
          serverSubscriptions.some((subscription) => subscription.endpoint === browserSubscription.endpoint),
        ));
      } catch (error) {
        setMessage(getUserErrorMessage(error, "No pudimos revisar las notificaciones push."));
      }
    });
  };

  useEffect(() => {
    loadPushState();
  }, []);

  useEffect(() => {
    if (!supported) {
      return;
    }

    getReadyServiceWorkerRegistration().catch(() => {});
  }, [supported]);

  const handleEnable = () => {
    startTransition(async () => {
      setMessage("");

      try {
        if (!supported) {
          setMessage("Este navegador no soporta notificaciones push para esta página.");
          return;
        }

        if (!config?.enabled || !config.publicKey) {
          setMessage("Web Push falta por configurar en el servidor.");
          return;
        }

        const permission = await Notification.requestPermission();

        if (permission !== "granted") {
          setMessage("El navegador no dio permiso para enviar notificaciones.");
          return;
        }

        const registration = await getReadyServiceWorkerRegistration();
        const subscription = await registration.pushManager.getSubscription()
          ?? await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(config.publicKey),
          });

        await saveWebPushSubscription(subscription.toJSON());
        setIsSubscribed(true);
        setMessage("Push activado en este dispositivo.");
      } catch (error) {
        setMessage(getPushRegistrationErrorMessage(error));
      }
    });
  };

  const handleDisable = () => {
    startTransition(async () => {
      setMessage("");

      try {
        const subscription = await getBrowserSubscription();

        if (subscription) {
          await subscription.unsubscribe();
          await deleteWebPushSubscription(subscription.endpoint);
        } else {
          await deleteWebPushSubscription();
        }

        setIsSubscribed(false);
        setMessage("Push desactivado en este dispositivo.");
      } catch (error) {
        setMessage(getUserErrorMessage(error, "No pudimos desactivar push en este dispositivo."));
      }
    });
  };

  return (
    <section className="pushNotificationBox" aria-label="Notificaciones push">
      <div className="pushNotificationCopy">
        <Smartphone size={18} />
        <span>
          <strong>Push en este dispositivo</strong>
          <small>
            {isSubscribed
              ? "Recibirás alertas aunque HuellamiGO no esté abierto."
              : "Activa avisos del navegador para alertas importantes."}
          </small>
        </span>
      </div>

      <button
        className="ghostTextButton"
        disabled={isPending || !supported || config?.enabled === false}
        onClick={isSubscribed ? handleDisable : handleEnable}
        type="button"
      >
        {isSubscribed ? <BellOff size={16} /> : <BellRing size={16} />}
        {isSubscribed ? "Desactivar" : "Activar"}
      </button>

      {!supported ? <p className="pushNotificationHint">Requiere HTTPS o localhost y soporte de Service Worker.</p> : null}
      {config?.enabled === false ? <p className="pushNotificationHint">Faltan llaves VAPID en el backend.</p> : null}
      {message ? <p className="formMessage">{message}</p> : null}
    </section>
  );
}

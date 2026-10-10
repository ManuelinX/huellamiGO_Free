self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  const payload = event.data ? event.data.json() : {};
  const title = payload.title || "HuellamiGO";
  const options = {
    body: payload.body || "Tienes una nueva notificacion.",
    icon: "/huellamigo.png",
    badge: "/huellamigo.png",
    tag: payload.tag || "huellamigo-notification",
    data: payload.data || {},
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/";
  const url = new URL(targetUrl, self.location.origin).href;

  event.waitUntil((async () => {
    const windows = await clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    });

    for (const windowClient of windows) {
      if (windowClient.url === url && "focus" in windowClient) {
        return windowClient.focus();
      }
    }

    return clients.openWindow(url);
  })());
});

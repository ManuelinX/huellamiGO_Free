const tabs = document.querySelectorAll(".tab");
const views = document.querySelectorAll(".view");
const cards = document.querySelectorAll(".pet-card");
const pins = document.querySelectorAll(".map-pin");
const toast = document.querySelector("#toast");
const connectedCount = document.querySelector("#connected-count");
const presenceStorageKey = "huellamigo:presence-visitor-id";
const apiBaseUrl = "http://localhost:4000";

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.setTimeout(() => toast.classList.remove("is-visible"), 2400);
}

function selectPet(petId) {
  cards.forEach((card) => {
    card.classList.toggle("selected", card.dataset.pet === petId);
  });

  pins.forEach((pin) => {
    pin.classList.toggle("active", pin.dataset.pet === petId);
  });
}

function getPresenceVisitorId() {
  let visitorId = window.localStorage.getItem(presenceStorageKey);

  if (!visitorId) {
    visitorId = `visitor_${crypto.randomUUID()}`;
    window.localStorage.setItem(presenceStorageKey, visitorId);
  }

  return visitorId;
}

async function syncPresence() {
  if (!connectedCount) {
    return;
  }

  try {
    const response = await fetch(`${apiBaseUrl}/api/presence/heartbeat`, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ visitorId: getPresenceVisitorId() }),
    });
    const data = await response.json();

    connectedCount.textContent = new Intl.NumberFormat("es-MX").format(data.activeCount);
  } catch (error) {
    connectedCount.textContent = "--";
  }
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((item) => item.classList.remove("is-active"));
    views.forEach((view) => view.classList.remove("is-active"));

    tab.classList.add("is-active");
    document.querySelector(`#view-${tab.dataset.view}`).classList.add("is-active");
  });
});

[...cards, ...pins].forEach((item) => {
  item.addEventListener("click", () => selectPet(item.dataset.pet));
});

document.querySelector("#seen-button").addEventListener("click", () => {
  showToast("Avistamiento registrado para la zona.");
});

document.querySelector("#publish-button").addEventListener("click", () => {
  showToast("Alerta lista para compartir.");
});

syncPresence();
window.setInterval(syncPresence, 30000);

const STORAGE_KEY = "mechaok_service_v2";
const SOON_KM = 500;

function uid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && Array.isArray(data.bikes)) return normalizeState(data);
    }
    return { bikes: [] };
  } catch {
    return { bikes: [] };
  }
}

function normalizeState(data) {
  for (const bike of data.bikes) {
    if (typeof bike.currentKm !== "number" || Number.isNaN(bike.currentKm)) bike.currentKm = null;
    if (!Array.isArray(bike.items)) bike.items = [];
    for (const item of bike.items) {
      if (typeof item.lastKm !== "number") item.lastKm = 0;
      if (typeof item.intervalKm !== "number") item.intervalKm = 0;
    }
  }
  return data;
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function statusForItem(item, currentKm) {
  const nextDueKm = item.lastKm + item.intervalKm;
  if (currentKm == null || Number.isNaN(Number(currentKm))) {
    return { status: "unknown", nextDueKm, remaining: null };
  }
  const cur = Number(currentKm);
  const remaining = nextDueKm - cur;
  if (remaining <= 0) return { status: "overdue", nextDueKm, remaining };
  if (remaining <= SOON_KM) return { status: "soon", nextDueKm, remaining };
  return { status: "ok", nextDueKm, remaining };
}

function labelStatus(s) {
  if (s === "overdue") return "Overdue";
  if (s === "soon") return "Due soon";
  if (s === "unknown") return "Set odometer";
  return "OK";
}

const tplBike = document.getElementById("tpl-bike");
const tplItem = document.getElementById("tpl-item");
const bikesRoot = document.getElementById("bikes-root");
const formBike = document.getElementById("form-bike");
const bikeNameInput = document.getElementById("bike-name");

let state = loadState();

function sortItems(items, currentKm) {
  const order = { overdue: 0, soon: 1, ok: 2, unknown: 3 };
  return [...items].sort((a, b) => {
    const sa = statusForItem(a, currentKm);
    const sb = statusForItem(b, currentKm);
    if (order[sa.status] !== order[sb.status]) return order[sa.status] - order[sb.status];
    const ra = sa.remaining != null ? sa.remaining : Infinity;
    const rb = sb.remaining != null ? sb.remaining : Infinity;
    if (ra !== rb) return ra - rb;
    return sa.nextDueKm - sb.nextDueKm;
  });
}

function render() {
  bikesRoot.replaceChildren();
  if (state.bikes.length === 0) {
    const p = document.createElement("p");
    p.className = "empty-hint";
    p.textContent = "Add a bike to start tracking services.";
    bikesRoot.appendChild(p);
    return;
  }

  for (const bike of state.bikes) {
    const node = tplBike.content.cloneNode(true);
    const article = node.querySelector(".bike");
    article.dataset.bikeId = bike.id;
    node.querySelector(".bike-title").textContent = bike.name;

    const odoForm = node.querySelector(".js-form-odometer");
    const odoInput = odoForm.querySelector('[name="currentKm"]');
    const odoHint = node.querySelector(".js-odometer-hint");
    if (bike.currentKm != null && !Number.isNaN(bike.currentKm)) {
      odoInput.value = String(bike.currentKm);
    }
    odoHint.hidden = bike.currentKm != null && !Number.isNaN(bike.currentKm);

    odoForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const v = Number(odoInput.value);
      if (Number.isNaN(v) || v < 0) return;
      setCurrentKm(bike.id, v);
    });

    const list = node.querySelector(".js-service-list");
    const empty = node.querySelector(".js-empty");
    const items = sortItems(bike.items, bike.currentKm);

    if (items.length === 0) {
      empty.hidden = false;
    } else {
      empty.hidden = true;
      for (const item of items) {
        list.appendChild(renderItem(bike, item));
      }
    }

    node.querySelector(".js-export").addEventListener("click", () => exportBike(bike));
    node.querySelector(".js-delete-bike").addEventListener("click", () => deleteBike(bike.id));

    const form = node.querySelector(".js-form-service");
    const lastKmInput = form.querySelector('[name="lastKm"]');
    if (bike.currentKm != null && lastKmInput && !lastKmInput.value) {
      lastKmInput.value = String(bike.currentKm);
    }

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const name = String(fd.get("name") || "").trim();
      const lastKm = Number(fd.get("lastKm"));
      const intervalKm = Number(fd.get("intervalKm"));
      if (!name || Number.isNaN(lastKm) || lastKm < 0 || Number.isNaN(intervalKm) || intervalKm < 1) return;
      addItem(bike.id, { name, lastKm, intervalKm });
      form.reset();
      if (bike.currentKm != null && lastKmInput) lastKmInput.value = String(bike.currentKm);
      const intervalInput = form.querySelector('[name="intervalKm"]');
      if (intervalInput) intervalInput.value = "5000";
    });

    bikesRoot.appendChild(node);
  }
}

function renderItem(bike, item) {
  const node = tplItem.content.cloneNode(true);
  const li = node.querySelector(".service-item");
  li.dataset.itemId = item.id;
  const { status, nextDueKm, remaining } = statusForItem(item, bike.currentKm);
  const badge = node.querySelector(".badge");
  badge.dataset.status = status;
  badge.textContent = labelStatus(status);

  node.querySelector(".service-name").textContent = item.name;
  let meta = `Last: ${item.lastKm.toLocaleString()} km · Every ${item.intervalKm.toLocaleString()} km · Next: ${nextDueKm.toLocaleString()} km`;
  if (status === "overdue" && remaining != null) meta += ` (${Math.abs(remaining).toLocaleString()} km past)`;
  else if (status === "soon" && remaining != null) meta += ` (${remaining.toLocaleString()} km left)`;
  else if (status === "ok" && remaining != null) meta += ` (${remaining.toLocaleString()} km left)`;
  else if (status === "unknown") meta += ` — save current odometer above to see status.`;
  node.querySelector(".service-meta").textContent = meta;

  const markBtn = node.querySelector(".js-mark-done");
  markBtn.disabled = bike.currentKm == null || Number.isNaN(Number(bike.currentKm));
  markBtn.title = markBtn.disabled ? "Set current odometer first" : "";

  markBtn.addEventListener("click", () => {
    markDone(bike.id, item.id);
  });
  node.querySelector(".js-delete-item").addEventListener("click", () => {
    deleteItem(bike.id, item.id);
  });
  return node;
}

function setCurrentKm(bikeId, km) {
  const bike = state.bikes.find((b) => b.id === bikeId);
  if (!bike) return;
  bike.currentKm = km;
  saveState(state);
  render();
}

function addBike(name) {
  state.bikes.push({
    id: uid(),
    name,
    currentKm: null,
    items: [],
  });
  saveState(state);
  render();
}

function deleteBike(bikeId) {
  if (!confirm("Remove this bike and all its service items?")) return;
  state.bikes = state.bikes.filter((b) => b.id !== bikeId);
  saveState(state);
  render();
}

function addItem(bikeId, { name, lastKm, intervalKm }) {
  const bike = state.bikes.find((b) => b.id === bikeId);
  if (!bike) return;
  bike.items.push({
    id: uid(),
    name,
    lastKm,
    intervalKm,
  });
  saveState(state);
  render();
}

function markDone(bikeId, itemId) {
  const bike = state.bikes.find((b) => b.id === bikeId);
  if (!bike || bike.currentKm == null) return;
  const item = bike.items.find((i) => i.id === itemId);
  if (!item) return;
  item.lastKm = bike.currentKm;
  saveState(state);
  render();
}

function deleteItem(bikeId, itemId) {
  const bike = state.bikes.find((b) => b.id === bikeId);
  if (!bike) return;
  bike.items = bike.items.filter((i) => i.id !== itemId);
  saveState(state);
  render();
}

function exportBike(bike) {
  const blob = new Blob([JSON.stringify(bike, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  const safe = bike.name.replace(/[^\w\-]+/g, "_").slice(0, 40) || "bike";
  a.download = `mechaok-${safe}.json`;
  a.href = URL.createObjectURL(blob);
  a.click();
  URL.revokeObjectURL(a.href);
}

formBike.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = bikeNameInput.value.trim();
  if (!name) return;
  addBike(name);
  bikeNameInput.value = "";
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

render();

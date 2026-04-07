const STORAGE_KEY = "mechaok_service_v1";
const SOON_DAYS = 14;

function uid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { bikes: [] };
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.bikes)) return { bikes: [] };
    return data;
  } catch {
    return { bikes: [] };
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function parseYmd(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

const AVG_DAYS_PER_MONTH = 30.436875;

function addMonths(date, months) {
  const whole = Math.trunc(months);
  const frac = months - whole;
  const d = new Date(date.getTime());
  const day = d.getDate();
  d.setMonth(d.getMonth() + whole);
  if (d.getDate() < day) d.setDate(0);
  if (frac !== 0) d.setDate(d.getDate() + Math.round(frac * AVG_DAYS_PER_MONTH));
  return d;
}

function toYmd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayYmd() {
  return toYmd(new Date());
}

function daysBetween(a, b) {
  const ms = 24 * 60 * 60 * 1000;
  return Math.round((b - a) / ms);
}

function statusForItem(item) {
  const last = parseYmd(item.lastDate);
  const next = addMonths(last, item.intervalMonths);
  const today = parseYmd(todayYmd());
  const until = daysBetween(today, next);
  if (until < 0) return { status: "overdue", next, until };
  if (until <= SOON_DAYS) return { status: "soon", next, until };
  return { status: "ok", next, until };
}

function labelStatus(s) {
  if (s === "overdue") return "Overdue";
  if (s === "soon") return "Due soon";
  return "OK";
}

const tplBike = document.getElementById("tpl-bike");
const tplItem = document.getElementById("tpl-item");
const bikesRoot = document.getElementById("bikes-root");
const formBike = document.getElementById("form-bike");
const bikeNameInput = document.getElementById("bike-name");

let state = loadState();

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

    const list = node.querySelector(".js-service-list");
    const empty = node.querySelector(".js-empty");
    const items = [...bike.items].sort((a, b) => {
      const sa = statusForItem(a);
      const sb = statusForItem(b);
      const order = { overdue: 0, soon: 1, ok: 2 };
      if (order[sa.status] !== order[sb.status]) return order[sa.status] - order[sb.status];
      return sa.next - sb.next;
    });

    if (items.length === 0) {
      empty.hidden = false;
    } else {
      empty.hidden = true;
      for (const item of items) {
        list.appendChild(renderItem(bike.id, item));
      }
    }

    node.querySelector(".js-export").addEventListener("click", () => exportBike(bike));
    node.querySelector(".js-delete-bike").addEventListener("click", () => deleteBike(bike.id));

    const form = node.querySelector(".js-form-service");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const name = String(fd.get("name") || "").trim();
      const lastDate = String(fd.get("lastDate") || "");
      const intervalMonths = Number(fd.get("intervalMonths"));
      if (!name || !lastDate || Number.isNaN(intervalMonths) || intervalMonths <= 0) return;
      addItem(bike.id, { name, lastDate, intervalMonths });
      form.reset();
      const lastInput = form.querySelector('[name="lastDate"]');
      if (lastInput) lastInput.value = todayYmd();
    });

    const lastDateInput = form.querySelector('[name="lastDate"]');
    if (lastDateInput && !lastDateInput.value) lastDateInput.value = todayYmd();

    bikesRoot.appendChild(node);
  }
}

function renderItem(bikeId, item) {
  const node = tplItem.content.cloneNode(true);
  const li = node.querySelector(".service-item");
  li.dataset.itemId = item.id;
  const { status, next, until } = statusForItem(item);
  const badge = node.querySelector(".badge");
  badge.dataset.status = status;
  badge.textContent = labelStatus(status);

  node.querySelector(".service-name").textContent = item.name;
  const nextStr = toYmd(next);
  let meta = `Last: ${item.lastDate} · Every ${item.intervalMonths} mo · Next: ${nextStr}`;
  if (status === "overdue") meta += ` (${Math.abs(until)} days ago)`;
  else if (status === "soon") meta += ` (in ${until} days)`;
  node.querySelector(".service-meta").textContent = meta;

  node.querySelector(".js-mark-done").addEventListener("click", () => {
    markDone(bikeId, item.id);
  });
  node.querySelector(".js-delete-item").addEventListener("click", () => {
    deleteItem(bikeId, item.id);
  });
  return node;
}

function addBike(name) {
  state.bikes.push({
    id: uid(),
    name,
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

function addItem(bikeId, { name, lastDate, intervalMonths }) {
  const bike = state.bikes.find((b) => b.id === bikeId);
  if (!bike) return;
  bike.items.push({
    id: uid(),
    name,
    lastDate,
    intervalMonths,
  });
  saveState(state);
  render();
}

function markDone(bikeId, itemId) {
  const bike = state.bikes.find((b) => b.id === bikeId);
  if (!bike) return;
  const item = bike.items.find((i) => i.id === itemId);
  if (!item) return;
  item.lastDate = todayYmd();
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

render();

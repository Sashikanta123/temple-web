const state = {
  temples: [],
  metadata: null,
  selectedTemple: null,
  featuredOnly: false,
  adminAuthenticated: false
};

const $ = (selector) => document.querySelector(selector);
const templeGrid = $("#templeGrid");
const templeDetail = $("#templeDetail");
const savedList = $("#savedList");
const adminList = $("#adminList");
const templeForm = $("#templeForm");
let staticTemplesCache = null;

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return staticApi(path, options);
  }
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

async function loadStaticTemples() {
  if (!staticTemplesCache) {
    const response = await fetch("/temples.json");
    staticTemplesCache = await response.json();
  }
  return staticTemplesCache;
}

async function staticApi(path, options = {}) {
  if (options.method && options.method !== "GET") {
    throw new Error("Admin features need the Node backend. Public browsing works on Netlify.");
  }

  const url = new URL(path, location.origin);
  const temples = (await loadStaticTemples()).filter((temple) => temple.approved);

  if (url.pathname === "/api/metadata") {
    const unique = (field) => [...new Set(temples.map((temple) => temple[field]).filter(Boolean))].sort();
    return {
      states: unique("state"),
      cities: unique("city"),
      deities: unique("deity"),
      circuits: unique("circuit"),
      kpis: {
        listedTemples: temples.length,
        statesCovered: unique("state").length,
        circuits: unique("circuit").length,
        festivalsTracked: temples.reduce((count, temple) => count + (temple.festivals || []).length, 0)
      }
    };
  }

  if (url.pathname === "/api/temples") {
    const query = (url.searchParams.get("q") || "").toLowerCase();
    const filtered = temples.filter((temple) => {
      if (url.searchParams.get("state") && temple.state !== url.searchParams.get("state")) return false;
      if (url.searchParams.get("city") && temple.city !== url.searchParams.get("city")) return false;
      if (url.searchParams.get("deity") && temple.deity !== url.searchParams.get("deity")) return false;
      if (url.searchParams.get("circuit") && temple.circuit !== url.searchParams.get("circuit")) return false;
      if (url.searchParams.get("featured") === "true" && !temple.featured) return false;
      if (!query) return true;
      return [
        temple.name,
        temple.state,
        temple.city,
        temple.deity,
        temple.circuit,
        temple.history,
        temple.significance,
        ...(temple.festivals || [])
      ].join(" ").toLowerCase().includes(query);
    });
    return { temples: filtered };
  }

  const templeId = url.pathname.match(/^\/api\/temples\/([^/]+)$/)?.[1];
  if (templeId) {
    const temple = temples.find((item) => item.id === templeId);
    if (!temple) throw new Error("Temple not found");
    return { temple };
  }

  if (url.pathname === "/api/admin/me") {
    return { authenticated: false, user: null };
  }

  throw new Error("This feature needs the Node backend.");
}

function listFromTextarea(value) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function setOptions(select, values, placeholder) {
  select.innerHTML = `<option value="">${placeholder}</option>`;
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.append(option);
  });
}

function templeImage(temple) {
  return temple.image || "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?auto=format&fit=crop&w=1200&q=80";
}

function getFilters() {
  return {
    q: $("#searchInput").value.trim(),
    state: $("#stateFilter").value,
    city: $("#cityFilter").value,
    deity: $("#deityFilter").value
  };
}

function localSavedIds() {
  return JSON.parse(localStorage.getItem("savedTemples") || "[]");
}

function saveTemple(id) {
  const ids = new Set(localSavedIds());
  ids.has(id) ? ids.delete(id) : ids.add(id);
  localStorage.setItem("savedTemples", JSON.stringify([...ids]));
  renderSaved();
  if (state.selectedTemple?.id === id) renderTempleDetail(state.selectedTemple);
}

async function loadMetadata() {
  state.metadata = await api("/api/metadata");
  setOptions($("#stateFilter"), state.metadata.states, "All states");
  setOptions($("#cityFilter"), state.metadata.cities, "All cities");
  setOptions($("#deityFilter"), state.metadata.deities, "All deities");
  $("#metricTemples").textContent = state.metadata.kpis.listedTemples;
  $("#metricStates").textContent = state.metadata.kpis.statesCovered;
  $("#metricCircuits").textContent = state.metadata.kpis.circuits;
  $("#metricFestivals").textContent = state.metadata.kpis.festivalsTracked;
  renderCircuits();
}

async function loadTemples() {
  const filters = getFilters();
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => value && params.set(key, value));
  if (state.featuredOnly) params.set("featured", "true");
  const data = await api(`/api/temples?${params.toString()}`);
  state.temples = data.temples;
  renderTemples();
  renderSaved();
}

function renderTemples() {
  $("#resultCount").textContent = `${state.temples.length} temple${state.temples.length === 1 ? "" : "s"}`;
  templeGrid.innerHTML = "";

  if (!state.temples.length) {
    templeGrid.innerHTML = `<p class="empty-state">No temples match the current filters.</p>`;
    return;
  }

  state.temples.forEach((temple) => {
    const card = document.createElement("article");
    card.className = "temple-card";
    card.innerHTML = `
      <img src="${templeImage(temple)}" alt="${temple.name}" loading="lazy">
      <div class="temple-card-body">
        <div class="card-meta">
          <span class="pill">${temple.state}</span>
          <span class="pill">${temple.deity}</span>
        </div>
        <h3>${temple.name}</h3>
        <p>${temple.city} • ${temple.circuit}</p>
        <button type="button">View pilgrimage details</button>
      </div>
    `;
    card.querySelector("button").addEventListener("click", () => renderTempleDetail(temple));
    templeGrid.append(card);
  });
}

function renderTempleDetail(temple) {
  state.selectedTemple = temple;
  const saved = localSavedIds().includes(temple.id);
  templeDetail.innerHTML = `
    <img src="${templeImage(temple)}" alt="${temple.name}">
    <div class="card-meta">
      <span class="pill">${temple.city}, ${temple.state}</span>
      <span class="pill">${temple.deity}</span>
    </div>
    <h3>${temple.name}</h3>
    <p>${temple.significance || temple.history}</p>
    <h4>Historical background</h4>
    <p>${temple.history}</p>
    <h4>Darshan timings</h4>
    <p>${temple.darshanTimings || "Timings are being verified by admins."}</p>
    ${renderList("Rituals", temple.rituals)}
    ${renderList("Festivals", temple.festivals)}
    ${renderList("Visitor guidelines", temple.guidelines)}
    ${renderList("Nearby facilities", temple.facilities)}
    <div class="detail-actions">
      <button type="button" id="saveTemple">${saved ? "Remove saved" : "Save"}</button>
      <button type="button" class="ghost-button" id="shareTemple">Share</button>
    </div>
  `;
  $("#saveTemple").addEventListener("click", () => saveTemple(temple.id));
  $("#shareTemple").addEventListener("click", async () => {
    const url = `${location.origin}/#discover`;
    if (navigator.share) {
      await navigator.share({ title: temple.name, text: temple.significance, url });
    } else {
      await navigator.clipboard.writeText(`${temple.name} - ${url}`);
      alert("Temple information copied to clipboard.");
    }
  });
}

function renderList(title, items = []) {
  if (!items.length) return "";
  return `<h4>${title}</h4><ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul>`;
}

function renderCircuits() {
  const circuitGrid = $("#circuitGrid");
  const circuits = state.metadata?.circuits || [];
  circuitGrid.innerHTML = "";
  circuits.forEach((circuit) => {
    const temples = state.temples.filter((temple) => temple.circuit === circuit);
    const card = document.createElement("article");
    card.className = "circuit-card";
    card.innerHTML = `
      <h3>${circuit}</h3>
      <p>${temples.length || "Multiple"} listed temple${temples.length === 1 ? "" : "s"} in this route.</p>
      <button class="ghost-button" type="button">Explore</button>
    `;
    card.querySelector("button").addEventListener("click", () => {
      $("#searchInput").value = circuit;
      location.hash = "discover";
      loadTemples();
    });
    circuitGrid.append(card);
  });
}

function renderSaved() {
  const ids = localSavedIds();
  const savedTemples = state.temples.filter((temple) => ids.includes(temple.id));
  savedList.innerHTML = "";
  if (!savedTemples.length) {
    savedList.innerHTML = `<p class="empty-state">Saved temples will appear here for quick visit planning.</p>`;
    return;
  }

  savedTemples.forEach((temple) => {
    const card = document.createElement("article");
    card.className = "saved-card";
    card.innerHTML = `
      <h3>${temple.name}</h3>
      <p>${temple.city}, ${temple.state} • ${temple.deity}</p>
      <button class="ghost-button" type="button">Open</button>
    `;
    card.querySelector("button").addEventListener("click", () => {
      location.hash = "discover";
      renderTempleDetail(temple);
    });
    savedList.append(card);
  });
}

async function checkAdmin() {
  const data = await api("/api/admin/me");
  state.adminAuthenticated = data.authenticated;
  $("#loginForm").classList.toggle("hidden", state.adminAuthenticated);
  $("#adminWorkspace").classList.toggle("hidden", !state.adminAuthenticated);
  $("#logoutButton").classList.toggle("hidden", !state.adminAuthenticated);
  if (state.adminAuthenticated) loadAdminTemples();
}

async function loadAdminTemples() {
  const data = await api("/api/temples?includePending=true");
  renderAdminList(data.temples);
}

function renderAdminList(temples) {
  adminList.innerHTML = "";
  temples.forEach((temple) => {
    const card = document.createElement("article");
    card.className = "admin-card";
    card.innerHTML = `
      <h3>${temple.name}</h3>
      <p>${temple.city}, ${temple.state} • ${temple.approved ? "Approved" : "Pending approval"}</p>
      <div class="admin-card-actions">
        <button class="ghost-button" type="button" data-action="edit">Edit</button>
        <button class="ghost-button" type="button" data-action="approve">${temple.approved ? "Unapprove" : "Approve"}</button>
        <button class="ghost-button" type="button" data-action="delete">Delete</button>
      </div>
    `;
    card.querySelector('[data-action="edit"]').addEventListener("click", () => fillTempleForm(temple));
    card.querySelector('[data-action="approve"]').addEventListener("click", async () => {
      await saveAdminTemple({ ...temple, approved: !temple.approved });
    });
    card.querySelector('[data-action="delete"]').addEventListener("click", async () => {
      if (confirm(`Delete ${temple.name}?`)) {
        await api(`/api/admin/temples/${temple.id}`, { method: "DELETE" });
        await refreshAll();
      }
    });
    adminList.append(card);
  });
}

function fillTempleForm(temple) {
  Object.entries(temple).forEach(([key, value]) => {
    const field = templeForm.elements[key];
    if (!field) return;
    if (field.type === "checkbox") field.checked = Boolean(value);
    else if (Array.isArray(value)) field.value = value.join("\n");
    else field.value = value || "";
  });
  location.hash = "admin";
}

function formTemplePayload() {
  const formData = new FormData(templeForm);
  return {
    id: formData.get("id"),
    name: formData.get("name"),
    state: formData.get("state"),
    city: formData.get("city"),
    deity: formData.get("deity"),
    circuit: formData.get("circuit"),
    image: formData.get("image"),
    darshanTimings: formData.get("darshanTimings"),
    history: formData.get("history"),
    significance: formData.get("significance"),
    rituals: listFromTextarea(formData.get("rituals") || ""),
    festivals: listFromTextarea(formData.get("festivals") || ""),
    guidelines: listFromTextarea(formData.get("guidelines") || ""),
    facilities: listFromTextarea(formData.get("facilities") || ""),
    approved: templeForm.elements.approved.checked,
    featured: templeForm.elements.featured.checked
  };
}

async function saveAdminTemple(payload) {
  const path = payload.id ? `/api/admin/temples/${payload.id}` : "/api/admin/temples";
  const method = payload.id ? "PUT" : "POST";
  await api(path, { method, body: JSON.stringify(payload) });
  templeForm.reset();
  await refreshAll();
}

async function refreshAll() {
  await loadMetadata();
  await loadTemples();
  if (state.adminAuthenticated) await loadAdminTemples();
}

function bindEvents() {
  ["searchInput", "stateFilter", "cityFilter", "deityFilter"].forEach((id) => {
    $(`#${id}`).addEventListener("input", loadTemples);
  });

  $("#heroSearch").addEventListener("submit", (event) => {
    event.preventDefault();
    $("#searchInput").value = $("#heroSearchInput").value;
    location.hash = "discover";
    loadTemples();
  });

  $("#resetFilters").addEventListener("click", () => {
    $("#searchInput").value = "";
    $("#stateFilter").value = "";
    $("#cityFilter").value = "";
    $("#deityFilter").value = "";
    state.featuredOnly = false;
    $("#featuredOnly").setAttribute("aria-pressed", "false");
    loadTemples();
  });

  $("#featuredOnly").addEventListener("click", () => {
    state.featuredOnly = !state.featuredOnly;
    $("#featuredOnly").setAttribute("aria-pressed", String(state.featuredOnly));
    loadTemples();
  });

  $("#loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    try {
      await api("/api/admin/login", {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(formData))
      });
      await checkAdmin();
    } catch (error) {
      alert(error.message);
    }
  });

  $("#logoutButton").addEventListener("click", async () => {
    await api("/api/admin/logout", { method: "POST" });
    await checkAdmin();
  });

  $("#clearForm").addEventListener("click", () => templeForm.reset());

  templeForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await saveAdminTemple(formTemplePayload());
    } catch (error) {
      alert(error.message);
    }
  });
}

async function init() {
  bindEvents();
  await refreshAll();
  await checkAdmin();
  if (state.temples[0]) renderTempleDetail(state.temples[0]);
}

init().catch((error) => {
  document.body.insertAdjacentHTML("afterbegin", `<p class="empty-state">${error.message}</p>`);
});

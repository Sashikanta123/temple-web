const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const TEMPLES_FILE = path.join(DATA_DIR, "temples.json");
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASS = process.env.ADMIN_PASS || "admin123";
const sessions = new Map();

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers
  });
  res.end(JSON.stringify(body));
}

function parseCookies(header = "") {
  return Object.fromEntries(
    header
      .split(";")
      .map((cookie) => cookie.trim().split("="))
      .filter(([key, value]) => key && value)
      .map(([key, value]) => [key, decodeURIComponent(value)])
  );
}

function isAdmin(req) {
  const cookies = parseCookies(req.headers.cookie);
  return Boolean(cookies.session && sessions.has(cookies.session));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    const error = new Error("Invalid JSON payload");
    error.status = 400;
    throw error;
  }
}

async function readTemples() {
  const data = await fs.readFile(TEMPLES_FILE, "utf8");
  return JSON.parse(data);
}

async function writeTemples(temples) {
  await fs.writeFile(TEMPLES_FILE, `${JSON.stringify(temples, null, 2)}\n`);
}

function normalizeTemple(input, existing = {}) {
  const required = ["name", "state", "city", "deity", "history"];
  for (const field of required) {
    if (!String(input[field] || existing[field] || "").trim()) {
      const error = new Error(`${field} is required`);
      error.status = 400;
      throw error;
    }
  }

  return {
    ...existing,
    id: existing.id || crypto.randomUUID(),
    name: String(input.name ?? existing.name).trim(),
    state: String(input.state ?? existing.state).trim(),
    city: String(input.city ?? existing.city).trim(),
    deity: String(input.deity ?? existing.deity).trim(),
    circuit: String(input.circuit ?? existing.circuit ?? "Regional Heritage Trail").trim(),
    image: String(input.image ?? existing.image ?? "").trim(),
    featured: Boolean(input.featured ?? existing.featured),
    approved: Boolean(input.approved ?? existing.approved),
    history: String(input.history ?? existing.history).trim(),
    significance: String(input.significance ?? existing.significance ?? "").trim(),
    darshanTimings: String(input.darshanTimings ?? existing.darshanTimings ?? "").trim(),
    rituals: Array.isArray(input.rituals) ? input.rituals : existing.rituals || [],
    festivals: Array.isArray(input.festivals) ? input.festivals : existing.festivals || [],
    guidelines: Array.isArray(input.guidelines) ? input.guidelines : existing.guidelines || [],
    facilities: Array.isArray(input.facilities) ? input.facilities : existing.facilities || [],
    updatedAt: new Date().toISOString()
  };
}

function matchesTemple(temple, query) {
  const text = [
    temple.name,
    temple.state,
    temple.city,
    temple.deity,
    temple.circuit,
    temple.history,
    temple.significance,
    ...(temple.festivals || [])
  ]
    .join(" ")
    .toLowerCase();

  return !query || text.includes(query.toLowerCase());
}

async function handleApi(req, res, url) {
  if (url.pathname === "/api/health") {
    return send(res, 200, { ok: true, service: "India Temple Heritage Portal" });
  }

  if (url.pathname === "/api/admin/login" && req.method === "POST") {
    const body = await readBody(req);
    if (body.username === ADMIN_USER && body.password === ADMIN_PASS) {
      const token = crypto.randomBytes(24).toString("hex");
      sessions.set(token, { user: ADMIN_USER, createdAt: Date.now() });
      return send(res, 200, { ok: true, user: ADMIN_USER }, {
        "Set-Cookie": `session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400`
      });
    }
    return send(res, 401, { error: "Invalid admin credentials" });
  }

  if (url.pathname === "/api/admin/logout" && req.method === "POST") {
    const cookies = parseCookies(req.headers.cookie);
    if (cookies.session) sessions.delete(cookies.session);
    return send(res, 200, { ok: true }, {
      "Set-Cookie": "session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0"
    });
  }

  if (url.pathname === "/api/admin/me") {
    return send(res, 200, { authenticated: isAdmin(req), user: isAdmin(req) ? ADMIN_USER : null });
  }

  if (url.pathname === "/api/temples" && req.method === "GET") {
    const temples = await readTemples();
    const includePending = url.searchParams.get("includePending") === "true" && isAdmin(req);
    const query = url.searchParams.get("q") || "";
    const state = url.searchParams.get("state") || "";
    const city = url.searchParams.get("city") || "";
    const deity = url.searchParams.get("deity") || "";
    const circuit = url.searchParams.get("circuit") || "";
    const featured = url.searchParams.get("featured") === "true";

    const filtered = temples.filter((temple) => {
      if (!includePending && !temple.approved) return false;
      if (state && temple.state !== state) return false;
      if (city && temple.city !== city) return false;
      if (deity && temple.deity !== deity) return false;
      if (circuit && temple.circuit !== circuit) return false;
      if (featured && !temple.featured) return false;
      return matchesTemple(temple, query);
    });

    return send(res, 200, { temples: filtered });
  }

  if (url.pathname === "/api/metadata" && req.method === "GET") {
    const temples = (await readTemples()).filter((temple) => temple.approved);
    const unique = (field) => [...new Set(temples.map((temple) => temple[field]).filter(Boolean))].sort();
    return send(res, 200, {
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
    });
  }

  const templeIdMatch = url.pathname.match(/^\/api\/temples\/([^/]+)$/);
  if (templeIdMatch && req.method === "GET") {
    const temples = await readTemples();
    const temple = temples.find((item) => item.id === templeIdMatch[1]);
    if (!temple || (!temple.approved && !isAdmin(req))) return send(res, 404, { error: "Temple not found" });
    return send(res, 200, { temple });
  }

  if (url.pathname === "/api/admin/temples" && req.method === "POST") {
    if (!isAdmin(req)) return send(res, 401, { error: "Admin login required" });
    const body = await readBody(req);
    const temples = await readTemples();
    const temple = normalizeTemple(body, { approved: false, featured: false });
    temples.unshift(temple);
    await writeTemples(temples);
    return send(res, 201, { temple });
  }

  const adminTempleMatch = url.pathname.match(/^\/api\/admin\/temples\/([^/]+)$/);
  if (adminTempleMatch && ["PUT", "DELETE"].includes(req.method)) {
    if (!isAdmin(req)) return send(res, 401, { error: "Admin login required" });
    const temples = await readTemples();
    const index = temples.findIndex((item) => item.id === adminTempleMatch[1]);
    if (index === -1) return send(res, 404, { error: "Temple not found" });

    if (req.method === "DELETE") {
      const [deleted] = temples.splice(index, 1);
      await writeTemples(temples);
      return send(res, 200, { temple: deleted });
    }

    const body = await readBody(req);
    temples[index] = normalizeTemple(body, temples[index]);
    await writeTemples(temples);
    return send(res, 200, { temple: temples[index] });
  }

  return send(res, 404, { error: "API route not found" });
}

async function serveStatic(req, res, url) {
  const requested = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const filePath = path.normalize(path.join(PUBLIC_DIR, requested));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  try {
    const content = await fs.readFile(filePath);
    res.writeHead(200, {
      "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "public, max-age=3600"
    });
    res.end(content);
  } catch {
    const fallback = await fs.readFile(path.join(PUBLIC_DIR, "index.html"));
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(fallback);
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
    } else {
      await serveStatic(req, res, url);
    }
  } catch (error) {
    send(res, error.status || 500, { error: error.message || "Server error" });
  }
});

server.listen(PORT, () => {
  console.log(`India Temple Heritage Portal running at http://localhost:${PORT}`);
});

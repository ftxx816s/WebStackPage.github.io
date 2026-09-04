// Cloudflare Pages Function: /api/state
// V16.1 Private Login - no Cloudflare Zero Trust required.
//
// Required Pages bindings / variables:
//   DB              -> D1 database binding
//   NAV_USERNAME    -> text variable, e.g. admin
//   NAV_PASSWORD    -> secret variable, your strong password
//   SESSION_SECRET  -> secret variable, long random string (32+ bytes)
//
// Routes handled by this ONE file:
//   GET  /api/state?mode=me
//   POST /api/state?mode=login
//   POST /api/state?mode=logout
//   GET  /api/state
//   PUT  /api/state

const MAX_JSON_BYTES = 4_500_000;
const BACKUP_KEEP = 20;
const SESSION_COOKIE = "fxnav_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const LOGIN_WINDOW_SECONDS = 15 * 60;
const LOGIN_MAX_FAILURES = 5;

const enc = new TextEncoder();
const dec = new TextDecoder();

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      ...extraHeaders
    }
  });
}

function configured(env) {
  return !!(env.DB && env.NAV_USERNAME && env.NAV_PASSWORD && env.SESSION_SECRET);
}

async function ensureSchema(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS nav_state (
      owner TEXT PRIMARY KEY,
      revision INTEGER NOT NULL DEFAULT 1,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      client_id TEXT
    )
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS nav_backup (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner TEXT NOT NULL,
      revision INTEGER NOT NULL,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      client_id TEXT
    )
  `).run();

  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS idx_nav_backup_owner_id
    ON nav_backup(owner, id DESC)
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS auth_rate (
      rate_key TEXT PRIMARY KEY,
      failures INTEGER NOT NULL DEFAULT 0,
      window_started INTEGER NOT NULL,
      blocked_until INTEGER NOT NULL DEFAULT 0
    )
  `).run();
}

function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

function getCookie(request, name) {
  const raw = request.headers.get("Cookie") || "";
  for (const part of raw.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return rest.join("=");
  }
  return "";
}

function base64UrlEncode(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const raw = atob(padded);
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

async function sha256Bytes(value) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(String(value))));
}

function constantTimeEqual(a, b) {
  if (!(a instanceof Uint8Array) || !(b instanceof Uint8Array)) return false;
  let diff = a.length ^ b.length;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    diff |= (a[i % a.length] || 0) ^ (b[i % b.length] || 0);
  }
  return diff === 0;
}

async function hmacSign(secret, text) {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(String(secret)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(text)));
}

async function passwordMatches(input, expected) {
  const [a, b] = await Promise.all([sha256Bytes(input), sha256Bytes(expected)]);
  return constantTimeEqual(a, b);
}

function sameOriginMutation(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

async function makeSession(env, username) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    u: normalizeUsername(username),
    iat: now,
    exp: now + SESSION_MAX_AGE,
    n: crypto.randomUUID()
  };
  const payloadPart = base64UrlEncode(enc.encode(JSON.stringify(payload)));
  const sig = await hmacSign(env.SESSION_SECRET, payloadPart);
  return payloadPart + "." + base64UrlEncode(sig);
}

async function verifySession(env, token) {
  if (!token || !token.includes(".")) return null;
  const [payloadPart, sigPart] = token.split(".", 2);
  try {
    const expected = await hmacSign(env.SESSION_SECRET, payloadPart);
    const actual = base64UrlDecode(sigPart);
    if (!constantTimeEqual(expected, actual)) return null;

    const payload = JSON.parse(dec.decode(base64UrlDecode(payloadPart)));
    const now = Math.floor(Date.now() / 1000);
    if (!payload || payload.exp < now || payload.iat > now + 60) return null;

    const configuredUser = normalizeUsername(env.NAV_USERNAME);
    if (normalizeUsername(payload.u) !== configuredUser) return null;

    return payload;
  } catch {
    return null;
  }
}

async function requireAuth(request, env) {
  const token = getCookie(request, SESSION_COOKIE);
  const session = await verifySession(env, token);
  if (!session) {
    return { error: json({ ok: false, error: "Authentication required." }, 401) };
  }
  return { owner: normalizeUsername(env.NAV_USERNAME), session };
}

function sessionCookie(token) {
  return [
    `${SESSION_COOKIE}=${token}`,
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
    "Path=/api",
    `Max-Age=${SESSION_MAX_AGE}`
  ].join("; ");
}

function clearSessionCookie() {
  return [
    `${SESSION_COOKIE}=`,
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
    "Path=/api",
    "Max-Age=0"
  ].join("; ");
}

async function loginRateKey(request, username) {
  const ip =
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For") ||
    "unknown";
  const digest = await sha256Bytes(ip + "|" + normalizeUsername(username));
  return base64UrlEncode(digest);
}

async function checkLoginRate(env, key) {
  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare(`
    SELECT failures, window_started, blocked_until
    FROM auth_rate
    WHERE rate_key = ?
    LIMIT 1
  `).bind(key).first();

  if (!row) return { allowed: true, failures: 0, windowStarted: now };

  const blockedUntil = Number(row.blocked_until) || 0;
  if (blockedUntil > now) {
    return { allowed: false, retryAfter: blockedUntil - now };
  }

  const windowStarted = Number(row.window_started) || now;
  if (now - windowStarted > LOGIN_WINDOW_SECONDS) {
    await env.DB.prepare(`DELETE FROM auth_rate WHERE rate_key = ?`).bind(key).run();
    return { allowed: true, failures: 0, windowStarted: now };
  }

  return {
    allowed: true,
    failures: Number(row.failures) || 0,
    windowStarted
  };
}

async function recordLoginFailure(env, key, current) {
  const now = Math.floor(Date.now() / 1000);
  const failures = (Number(current.failures) || 0) + 1;
  const blockedUntil = failures >= LOGIN_MAX_FAILURES ? now + LOGIN_WINDOW_SECONDS : 0;

  await env.DB.prepare(`
    INSERT INTO auth_rate(rate_key, failures, window_started, blocked_until)
    VALUES(?, ?, ?, ?)
    ON CONFLICT(rate_key) DO UPDATE SET
      failures = excluded.failures,
      window_started = excluded.window_started,
      blocked_until = excluded.blocked_until
  `).bind(
    key,
    failures,
    Number(current.windowStarted) || now,
    blockedUntil
  ).run();

  return blockedUntil;
}

async function handleMe(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.error;
  return json({
    ok: true,
    authenticated: true,
    username: auth.owner
  });
}

async function handleLogin(request, env) {
  if (!sameOriginMutation(request)) {
    return json({ ok: false, error: "Invalid request origin." }, 403);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON body." }, 400);
  }

  const username = normalizeUsername(body?.username);
  const password = String(body?.password || "");
  if (!username || !password) {
    return json({ ok: false, error: "Username and password are required." }, 400);
  }

  const rateKey = await loginRateKey(request, username);
  const rate = await checkLoginRate(env, rateKey);
  if (!rate.allowed) {
    return json(
      { ok: false, error: "Too many login attempts. Try again later." },
      429,
      { "Retry-After": String(rate.retryAfter || LOGIN_WINDOW_SECONDS) }
    );
  }

  const usernameOk = username === normalizeUsername(env.NAV_USERNAME);
  const passwordOk = usernameOk && await passwordMatches(password, env.NAV_PASSWORD);

  if (!usernameOk || !passwordOk) {
    await recordLoginFailure(env, rateKey, rate);
    return json({ ok: false, error: "Invalid username or password." }, 401);
  }

  await env.DB.prepare(`DELETE FROM auth_rate WHERE rate_key = ?`).bind(rateKey).run();

  const token = await makeSession(env, username);
  return json(
    { ok: true, authenticated: true, username },
    200,
    { "Set-Cookie": sessionCookie(token) }
  );
}

async function handleLogout(request) {
  if (!sameOriginMutation(request)) {
    return json({ ok: false, error: "Invalid request origin." }, 403);
  }
  return json(
    { ok: true, authenticated: false },
    200,
    { "Set-Cookie": clearSessionCookie() }
  );
}

async function handleStateGet(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.error;

  const row = await env.DB.prepare(`
    SELECT revision, data, updated_at
    FROM nav_state
    WHERE owner = ?
    LIMIT 1
  `).bind(auth.owner).first();

  if (!row) {
    return json({
      ok: true,
      exists: false,
      revision: 0,
      data: null,
      updatedAt: null
    });
  }

  let data = null;
  try {
    data = JSON.parse(row.data);
  } catch {
    return json({ ok: false, error: "Stored cloud state is invalid JSON." }, 500);
  }

  return json({
    ok: true,
    exists: true,
    revision: Number(row.revision) || 0,
    data,
    updatedAt: row.updated_at
  });
}

async function handleStatePut(request, env) {
  if (!sameOriginMutation(request)) {
    return json({ ok: false, error: "Invalid request origin." }, 403);
  }

  const auth = await requireAuth(request, env);
  if (auth.error) return auth.error;

  let body;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_JSON_BYTES) {
      return json({ ok: false, error: "Navigation state is too large." }, 413);
    }
    body = JSON.parse(raw);
  } catch {
    return json({ ok: false, error: "Invalid JSON body." }, 400);
  }

  const data = body?.data;
  const baseRevision = Math.max(0, Number(body?.baseRevision) || 0);
  const force = body?.force === true;
  const clientId = String(body?.clientId || "").slice(0, 128);

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return json({ ok: false, error: "Missing or invalid data object." }, 400);
  }

  const dataText = JSON.stringify(data);
  if (new TextEncoder().encode(dataText).byteLength > MAX_JSON_BYTES) {
    return json({ ok: false, error: "Navigation state is too large." }, 413);
  }

  const current = await env.DB.prepare(`
    SELECT revision, data, updated_at
    FROM nav_state
    WHERE owner = ?
    LIMIT 1
  `).bind(auth.owner).first();

  if (!current) {
    const revision = 1;
    await env.DB.prepare(`
      INSERT INTO nav_state(owner, revision, data, updated_at, client_id)
      VALUES(?, ?, ?, CURRENT_TIMESTAMP, ?)
    `).bind(auth.owner, revision, dataText, clientId).run();

    const row = await env.DB.prepare(`
      SELECT updated_at FROM nav_state WHERE owner = ?
    `).bind(auth.owner).first();

    return json({
      ok: true,
      created: true,
      revision,
      updatedAt: row?.updated_at || null
    });
  }

  const currentRevision = Number(current.revision) || 0;

  if (!force && baseRevision !== currentRevision) {
    return json({
      ok: false,
      error: "Revision conflict.",
      revision: currentRevision,
      updatedAt: current.updated_at
    }, 409);
  }

  await env.DB.prepare(`
    INSERT INTO nav_backup(owner, revision, data, created_at, client_id)
    VALUES(?, ?, ?, CURRENT_TIMESTAMP, ?)
  `).bind(auth.owner, currentRevision, current.data, clientId).run();

  const nextRevision = currentRevision + 1;

  await env.DB.prepare(`
    UPDATE nav_state
    SET revision = ?, data = ?, updated_at = CURRENT_TIMESTAMP, client_id = ?
    WHERE owner = ?
  `).bind(nextRevision, dataText, clientId, auth.owner).run();

  await env.DB.prepare(`
    DELETE FROM nav_backup
    WHERE owner = ?
      AND id NOT IN (
        SELECT id FROM nav_backup
        WHERE owner = ?
        ORDER BY id DESC
        LIMIT ?
      )
  `).bind(auth.owner, auth.owner, BACKUP_KEEP).run();

  const row = await env.DB.prepare(`
    SELECT updated_at FROM nav_state WHERE owner = ?
  `).bind(auth.owner).first();

  return json({
    ok: true,
    revision: nextRevision,
    updatedAt: row?.updated_at || null
  });
}

async function route(context) {
  const { request, env } = context;

  if (!configured(env)) {
    return json({
      ok: false,
      error: "Server login is not configured. Required: DB, NAV_USERNAME, NAV_PASSWORD, SESSION_SECRET."
    }, 500);
  }

  await ensureSchema(env);

  const url = new URL(request.url);
  const mode = String(url.searchParams.get("mode") || "").toLowerCase();

  if (mode === "me" && request.method === "GET") {
    return handleMe(request, env);
  }

  if (mode === "login" && request.method === "POST") {
    return handleLogin(request, env);
  }

  if (mode === "logout" && request.method === "POST") {
    return handleLogout(request);
  }

  if (!mode && request.method === "GET") {
    return handleStateGet(request, env);
  }

  if (!mode && request.method === "PUT") {
    return handleStatePut(request, env);
  }

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Allow": "GET, PUT, POST, OPTIONS",
        "Cache-Control": "no-store"
      }
    });
  }

  return json({ ok: false, error: "Not found." }, 404);
}

export async function onRequest(context) {
  try {
    return await route(context);
  } catch (error) {
    return json({
      ok: false,
      error: "Server error: " + String(error?.message || error)
    }, 500);
  }
}

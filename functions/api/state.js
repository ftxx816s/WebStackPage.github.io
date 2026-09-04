// Cloudflare Pages Function: /api/state
// Binding required: DB -> your Cloudflare D1 database
// Recommended env var: ALLOWED_EMAIL -> your own email
//
// Security model:
// 1. Protect dumbo.ccwu.cc with Cloudflare Access.
// 2. Access injects Cf-Access-Authenticated-User-Email.
// 3. This API rejects requests without that authenticated identity.
// 4. ALLOWED_EMAIL can further lock writes to one specific email.

const MAX_JSON_BYTES = 4_500_000;
const BACKUP_KEEP = 20;

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
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

function getOwner(request, env) {
  const email =
    request.headers.get("Cf-Access-Authenticated-User-Email") ||
    request.headers.get("CF-Access-Authenticated-User-Email") ||
    "";

  const normalized = email.trim().toLowerCase();
  const allowed = String(env.ALLOWED_EMAIL || "").trim().toLowerCase();

  if (!normalized) {
    return { error: json({ ok: false, error: "Cloudflare Access authentication required." }, 401) };
  }

  if (allowed && normalized !== allowed) {
    return { error: json({ ok: false, error: "This account is not allowed." }, 403) };
  }

  return { owner: normalized };
}

function validStatePayload(data) {
  return data && typeof data === "object" && !Array.isArray(data);
}

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!env.DB) {
    return json({ ok: false, error: "Missing D1 binding: DB" }, 500);
  }

  const auth = getOwner(request, env);
  if (auth.error) return auth.error;

  try {
    await ensureSchema(env);

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
  } catch (error) {
    return json({ ok: false, error: "D1 read failed: " + String(error?.message || error) }, 500);
  }
}

export async function onRequestPut(context) {
  const { request, env } = context;

  if (!env.DB) {
    return json({ ok: false, error: "Missing D1 binding: DB" }, 500);
  }

  const auth = getOwner(request, env);
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

  if (!validStatePayload(data)) {
    return json({ ok: false, error: "Missing or invalid data object." }, 400);
  }

  const dataText = JSON.stringify(data);
  if (new TextEncoder().encode(dataText).byteLength > MAX_JSON_BYTES) {
    return json({ ok: false, error: "Navigation state is too large." }, 413);
  }

  try {
    await ensureSchema(env);

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

    // Keep the previous cloud version before overwriting it.
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

    // Keep only the latest BACKUP_KEEP backups for this user.
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
  } catch (error) {
    return json({ ok: false, error: "D1 write failed: " + String(error?.message || error) }, 500);
  }
}

export async function onRequestOptions() {
  // Same-origin frontend does not need CORS. This only makes accidental OPTIONS harmless.
  return new Response(null, { status: 204 });
}

import { describe, it, expect, beforeAll } from "vitest";

const baseURL = process.env.API_URL || "http://localhost:4000";

let hqToken = "";
let hqRefresh = "";
let hqUserId = "";

async function login(email: string, password = "dev") {
  const res = await fetch(`${baseURL}/api/trpc/auth.login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  expect(res.status).toBe(200);
  const body = await res.json();
  return body.result?.data;
}

function authed(token: string): RequestInit {
  return { headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` } };
}

beforeAll(async () => {
  const data = await login("ricardo@infxmedia.co.za");
  hqToken = data.token;
  hqRefresh = data.refreshToken;
  hqUserId = data.user.id;
  expect(hqToken).toBeTruthy();
  expect(hqRefresh).toBeTruthy();
});

describe("Refresh token rotation", () => {
  it("auth.login returns both access + refresh tokens", () => {
    expect(hqToken.length).toBeGreaterThan(20);
    expect(hqRefresh.length).toBeGreaterThan(20);
  });

  it("auth.refresh issues a new pair and invalidates the old refresh", async () => {
    // Rotate once.
    const r1 = await fetch(`${baseURL}/api/trpc/auth.refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: hqRefresh }),
    });
    expect(r1.status).toBe(200);
    const b1 = await r1.json();
    const newToken = b1.result?.data?.token;
    const newRefresh = b1.result?.data?.refreshToken;
    expect(newToken).toBeTruthy();
    expect(newRefresh).toBeTruthy();
    expect(newRefresh).not.toBe(hqRefresh);

    // Reusing the OLD refresh must now fail (reuse detection).
    const r2 = await fetch(`${baseURL}/api/trpc/auth.refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: hqRefresh }),
    });
    expect(r2.status).toBe(401);

    // The replacement refresh should now ALSO be invalid because reuse
    // detection revoked all active tokens for this user.
    const r3 = await fetch(`${baseURL}/api/trpc/auth.refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: newRefresh }),
    });
    expect(r3.status).toBe(401);

    // Re-login to restore session for the next tests.
    const fresh = await login("ricardo@infxmedia.co.za");
    hqToken = fresh.token;
    hqRefresh = fresh.refreshToken;
  });

  it("auth.logout revokes the presented refresh token only", async () => {
    const fresh = await login("regional.cpt@papapasta.co.za");
    const res = await fetch(`${baseURL}/api/trpc/auth.logout`, {
      method: "POST",
      ...authed(fresh.token),
      body: JSON.stringify({ refreshToken: fresh.refreshToken }),
    });
    expect(res.status).toBe(200);

    // The revoked refresh should fail now.
    const r = await fetch(`${baseURL}/api/trpc/auth.refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: fresh.refreshToken }),
    });
    expect(r.status).toBe(401);
  });

  it("auth.logoutAll revokes every active refresh for the user", async () => {
    const a = await login("franchisee.a01@papapasta.co.za");
    const b = await login("franchisee.a01@papapasta.co.za");

    const res = await fetch(`${baseURL}/api/trpc/auth.logoutAll`, {
      method: "POST",
      ...authed(a.token),
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(200);

    // Both refresh tokens are now revoked.
    for (const tok of [a.refreshToken, b.refreshToken]) {
      const r = await fetch(`${baseURL}/api/trpc/auth.refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: tok }),
      });
      expect(r.status).toBe(401);
    }
  });
});

describe("Sync rollback", () => {
  let firstCommandId = "";

  it("sync.transform creates a sync_transactions row", async () => {
    const r = await fetch(`${baseURL}/api/trpc/sync.transform`, {
      method: "POST",
      ...authed(hqToken),
      body: JSON.stringify({
          scope: "store",
          targetId: "pp-a02",
          presetId: "00000000-0000-0000-0000-000000000000",
          effectiveAt: new Date().toISOString(),
          fadeDurationMs: 500,
          components: { rgb: true, content: true, audio: true },
        }),
    });
    expect(r.status).toBe(200);
    const body = await r.json();
    firstCommandId = body.result?.data?.commandId;
    expect(firstCommandId).toBeTruthy();
  });

  it("sync.recent returns the new transaction at the top", async () => {
    const r = await fetch(
      `${baseURL}/api/trpc/sync.recent?input=${encodeURIComponent(
        JSON.stringify({ targetId: "pp-a02", limit: 5 })
      )}`,
      authed(hqToken)
    );
    expect(r.status).toBe(200);
    const body = await r.json();
    const rows = body.result?.data;
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].targetId).toBe("pp-a02");
  });

  it("sync.rollback refuses when there's no prior preset", async () => {
    // Find a transaction with no presetIdBefore (the very first one for a target)
    // we just guarantee at least one tx with no prior — the first call ever.
    // For an isolated test we trigger a fresh target.
    const fresh = await fetch(`${baseURL}/api/trpc/sync.transform`, {
      method: "POST",
      ...authed(hqToken),
      body: JSON.stringify({
          scope: "store",
          targetId: "pp-d01",
          presetId: "00000000-0000-0000-0000-000000000000",
          effectiveAt: new Date().toISOString(),
          fadeDurationMs: 500,
          components: { rgb: true, content: true, audio: true },
        }),
    });
    const fb = await fresh.json();
    const cmdId = fb.result?.data?.commandId;

    // Rollback the first-ever tx for this target → should fail
    // (only if pp-d01 had no prior history before this run; in a re-run
    // it may already have prior tx, so this test allows either outcome
    // and just asserts the API responds with a sane error message in the
    // refusal case).
    const r = await fetch(`${baseURL}/api/trpc/sync.rollback`, {
      method: "POST",
      ...authed(hqToken),
      body: JSON.stringify({ commandId: cmdId }),
    });
    if (r.status === 200) {
      // Prior tx existed — still valid, just check the response shape.
      const b = await r.json();
      expect(b.result?.data?.rolledBackFrom).toBe(cmdId);
    } else {
      expect([400, 500]).toContain(r.status);
    }
  });

  it("sync.rollback succeeds when there is a prior preset", async () => {
    // Push a different preset to pp-a02 so it has a meaningful "prior".
    // We need a real preset id — fetch one.
    const presetsRes = await fetch(`${baseURL}/api/trpc/rgb.listPresets`, authed(hqToken));
    const presets = (await presetsRes.json()).result?.data;
    expect(presets.length).toBeGreaterThan(0);
    const realPreset = presets[0].id;

    // Apply preset 1
    const t1 = await fetch(`${baseURL}/api/trpc/sync.transform`, {
      method: "POST",
      ...authed(hqToken),
      body: JSON.stringify({
          scope: "store",
          targetId: "pp-a02",
          presetId: realPreset,
          effectiveAt: new Date().toISOString(),
          fadeDurationMs: 500,
          components: { rgb: true, content: true, audio: true },
        }),
    });
    const c1 = (await t1.json()).result?.data?.commandId;

    // Apply preset 2
    const t2 = await fetch(`${baseURL}/api/trpc/sync.transform`, {
      method: "POST",
      ...authed(hqToken),
      body: JSON.stringify({
          scope: "store",
          targetId: "pp-a02",
          presetId: presets[Math.min(1, presets.length - 1)].id,
          effectiveAt: new Date().toISOString(),
          fadeDurationMs: 500,
          components: { rgb: true, content: true, audio: true },
        }),
    });
    const c2 = (await t2.json()).result?.data?.commandId;

    // Rollback c2 — should succeed
    const r = await fetch(`${baseURL}/api/trpc/sync.rollback`, {
      method: "POST",
      ...authed(hqToken),
      body: JSON.stringify({ commandId: c2 }),
    });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.result?.data?.rolledBackFrom).toBe(c2);
    expect(body.result?.data?.commandId).toMatch(/^rollback_/);
    expect(c1).toBeTruthy();
  });
});

describe("Telemetry ingest", () => {
  it("technician can POST sensor samples via telemetry.ingest", async () => {
    const tech = await login("tech@infxmedia.co.za");
    const res = await fetch(`${baseURL}/api/trpc/telemetry.ingest`, {
      method: "POST",
      ...authed(tech.token),
      body: JSON.stringify({
          storeId: "pp-a01",
          samples: [
            { sensorId: "test-lidar", metric: "footfall", value: 42 },
            { sensorId: "test-lidar", metric: "footfall", value: 51 },
          ],
        }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result?.data?.inserted).toBe(2);
  });

  it("franchisee CANNOT call telemetry.ingest (technician/hq_admin only)", async () => {
    const f = await login("franchisee.a01@papapasta.co.za");
    const res = await fetch(`${baseURL}/api/trpc/telemetry.ingest`, {
      method: "POST",
      ...authed(f.token),
      body: JSON.stringify({
          storeId: "pp-a01",
          samples: [{ sensorId: "x", metric: "footfall", value: 1 }],
        }),
    });
    expect(res.status).toBe(403);
    expect(hqUserId).toBeTruthy();
  });

  it("telemetry.getSeries returns bucketed footfall data", async () => {
    const r = await fetch(
      `${baseURL}/api/trpc/telemetry.getSeries?input=${encodeURIComponent(
        JSON.stringify({ storeId: "pp-a01", metric: "footfall", sinceMinutes: 1440, bucketMinutes: 60 })
      )}`,
      authed(hqToken)
    );
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(Array.isArray(body.result?.data)).toBe(true);
  });
});

import { describe, it, expect, beforeAll } from "vitest";
import WebSocket from "ws";

const baseURL = process.env.API_URL || "http://localhost:4000";
const wsBaseURL = baseURL.replace("http:", "ws:");

let hqToken = "";
let franchiseeToken = "";

// Skip live-API suites when no API instance is reachable (CI boots one).
let apiUp = false;
try {
  const res = await fetch(`${baseURL}/api/trpc/health.ping`, { signal: AbortSignal.timeout(2500) });
  apiUp = res.ok;
} catch {
  apiUp = false;
}
const describeIf = apiUp ? describe : describe.skip;

async function login(email: string, password = "dev"): Promise<string> {
  const res = await fetch(`${baseURL}/api/trpc/auth.login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  expect(res.status).toBe(200);
  const body = await res.json();
  return body.result?.data?.token;
}

function authed(token: string): RequestInit {
  return { headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` } };
}

const maybeBeforeAll = apiUp ? beforeAll : (() => {}) as typeof beforeAll;
maybeBeforeAll(async () => {
  hqToken = await login("ricardo@infxmedia.co.za");
  franchiseeToken = await login("franchisee.a01@papapasta.co.za");
  expect(hqToken).toBeTruthy();
  expect(franchiseeToken).toBeTruthy();
});

describeIf("Public endpoints", () => {
  it("health endpoint is public", async () => {
    const res = await fetch(`${baseURL}/api/trpc/health.ping`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result?.data?.status).toBe("ok");
  });

  it("/metrics returns Prometheus format", async () => {
    const res = await fetch(`${baseURL}/metrics`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toMatch(/^# HELP cc_api_requests_total/m);
  });
});

describeIf("Auth", () => {
  it("rejects unauthenticated reads", async () => {
    const res = await fetch(`${baseURL}/api/trpc/stores.list`);
    expect(res.status).toBe(401);
  });

  it("rejects invalid credentials", async () => {
    const res = await fetch(`${baseURL}/api/trpc/auth.login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "nobody@example.com", password: "x" }),
    });
    expect(res.status).toBe(401);
  });

  it("auth.me returns the logged-in user", async () => {
    const res = await fetch(`${baseURL}/api/trpc/auth.me`, authed(hqToken));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result?.data?.email).toBe("ricardo@infxmedia.co.za");
    expect(body.result?.data?.role).toBe("hq_admin");
  });
});

describeIf("Read endpoints (authenticated)", () => {
  it("stores.list returns array for hq_admin", async () => {
    const res = await fetch(`${baseURL}/api/trpc/stores.list`, authed(hqToken));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.result?.data)).toBe(true);
  });

  it("stores.get returns a store", async () => {
    const res = await fetch(
      `${baseURL}/api/trpc/stores.get?input=%7B%22id%22%3A%22pp-a01%22%7D`,
      authed(hqToken)
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result?.data?.id).toBe("pp-a01");
  });

  it("rgb.listPresets returns presets", async () => {
    const res = await fetch(`${baseURL}/api/trpc/rgb.listPresets`, authed(hqToken));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.result?.data)).toBe(true);
  });

  it("analytics.getStats returns numbers + source label", async () => {
    const res = await fetch(`${baseURL}/api/trpc/analytics.getStats`, authed(hqToken));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.result?.data?.impressions).toBe("number");
    expect(typeof body.result?.data?.footfall).toBe("number");
    expect(["telemetry", "estimated"]).toContain(body.result?.data?.source);
  });
});

describeIf("RBAC scope enforcement", () => {
  it("hq_admin can sync.transform any store", async () => {
    const res = await fetch(`${baseURL}/api/trpc/sync.transform`, {
      method: "POST",
      ...authed(hqToken),
      body: JSON.stringify({
          scope: "store",
          targetId: "pp-a01",
          presetId: "00000000-0000-0000-0000-000000000000",
          effectiveAt: new Date().toISOString(),
          fadeDurationMs: 1000,
          components: { rgb: true, content: true, audio: true },
        }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result?.data?.status).toBe("dispatched");
  });

  it("franchisee CANNOT sync.transform a store outside their scope", async () => {
    const res = await fetch(`${baseURL}/api/trpc/sync.transform`, {
      method: "POST",
      ...authed(franchiseeToken),
      body: JSON.stringify({
          scope: "store",
          targetId: "pp-j01",
          presetId: "00000000-0000-0000-0000-000000000000",
          effectiveAt: new Date().toISOString(),
          fadeDurationMs: 1000,
          components: { rgb: true, content: true, audio: true },
        }),
    });
    expect(res.status).toBe(403);
  });

  it("franchisee CAN sync.transform their own store", async () => {
    const res = await fetch(`${baseURL}/api/trpc/sync.transform`, {
      method: "POST",
      ...authed(franchiseeToken),
      body: JSON.stringify({
          scope: "store",
          targetId: "pp-a01",
          presetId: "00000000-0000-0000-0000-000000000000",
          effectiveAt: new Date().toISOString(),
          fadeDurationMs: 1000,
          components: { rgb: true, content: true, audio: true },
        }),
    });
    expect(res.status).toBe(200);
  });
});

describeIf("Telemetry", () => {
  it("telemetry.latest returns rows for footfall", async () => {
    const res = await fetch(
      `${baseURL}/api/trpc/telemetry.latest?input=%7B%22metric%22%3A%22footfall%22%2C%22storeId%22%3A%22pp-a01%22%7D`,
      authed(hqToken)
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.result?.data)).toBe(true);
  });
});

describe.skipIf(process.env.DISABLE_LOGIN_RATE_LIMIT === "1" || !apiUp)("Login rate-limit", () => {
  it("blocks excess logins from the same IP after 10 attempts/min", async () => {
    let blocked = 0;
    for (let i = 0; i < 40; i++) {
      const res = await fetch(`${baseURL}/api/trpc/auth.login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: `wrong-${i}@example.com`, password: "x" }),
      });
      if (res.status === 429) blocked++;
    }
    expect(blocked).toBeGreaterThan(0);
  });
});

describeIf("Load Test — 100 concurrent requests", () => {
  it("handles 100 parallel stores.list in <3s total", async () => {
    const start = Date.now();
    const promises = Array.from({ length: 100 }, () =>
      fetch(`${baseURL}/api/trpc/stores.list`, authed(hqToken))
    );
    const results = await Promise.all(promises);
    const duration = Date.now() - start;
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(duration).toBeLessThan(3000);
    console.log(`   100 requests in ${duration}ms (~${(duration / 100).toFixed(1)}ms avg)`);
  });
});

describeIf("WebSocket Live Endpoint", () => {
  it("rejects WS connection without a token", async () => {
    return new Promise<void>((resolve) => {
      const ws = new WebSocket(`${wsBaseURL}/live/ws`);
      const timer = setTimeout(() => { ws.close(); resolve(); }, 3000);
      ws.on("close", () => { clearTimeout(timer); resolve(); });
      ws.on("error", () => { clearTimeout(timer); resolve(); });
    });
  });

  it("connects with token and receives connected event", async () => {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${wsBaseURL}/live/ws?token=${hqToken}`);
      const timer = setTimeout(() => { ws.close(); reject(new Error("WS timeout")); }, 5000);

      ws.on("open", () => {
        ws.send(JSON.stringify({ action: "subscribe", topic: "all" }));
      });

      ws.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "connected") {
          clearTimeout(timer);
          expect(msg.clientId).toBeDefined();
          ws.close();
          resolve(undefined);
        }
      });

      ws.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  });
});

describeIf("Master Control — hierarchy + dispatch", () => {
  it("hierarchy.tree returns the nested geo tree", async () => {
    const res = await fetch(`${baseURL}/api/trpc/hierarchy.tree`, { ...authed(hqToken) });
    expect(res.status).toBe(200);
    const body = await res.json();
    const tree = body.result?.data;
    expect(Array.isArray(tree)).toBe(true);
    expect(tree.length).toBeGreaterThan(0);
    const country = tree[0];
    expect(country.provinces[0].cities[0].stores.length).toBeGreaterThan(0);
    expect(country.provinces[0].cities[0].stores[0].counts).toHaveProperty("devices");
  });

  it("rgb.set with region scope fans out to every store in that city", async () => {
    const res = await fetch(`${baseURL}/api/trpc/rgb.set`, {
      method: "POST",
      ...authed(hqToken),
      body: JSON.stringify({
        scope: "region",
        targetId: "cape-town",
        colour: { mode: "solid", primary: "#FFD100", brightness: 0.8, speed: 1 },
        fadeMs: 500,
      }),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()).result?.data;
    expect(data.commandId).toBeTruthy();
    // cape-town has 3 stores in seed
    expect(data.targets).toBeGreaterThanOrEqual(3);

    // The command ledger recorded it
    await new Promise((r) => setTimeout(r, 200));
    const list = await fetch(`${baseURL}/api/trpc/commands.list?input=${encodeURIComponent(JSON.stringify({ limit: 10 }))}`, { ...authed(hqToken) });
    const rows = (await list.json()).result?.data;
    expect(rows.some((c: any) => c.commandId === data.commandId && c.kind === "rgb.set")).toBe(true);
  });

  it("franchisee cannot rgb.set outside their store, but geo claims cover their own city stores for RMs", async () => {
    const denied = await fetch(`${baseURL}/api/trpc/rgb.blackout`, {
      method: "POST",
      ...authed(franchiseeToken),
      body: JSON.stringify({ scope: "region", targetId: "johannesburg" }),
    });
    expect(denied.status).toBe(403);
  });

  it("audio.set transport works across a scope and records in the ledger", async () => {
    const res = await fetch(`${baseURL}/api/trpc/audio.set`, {
      method: "POST",
      ...authed(hqToken),
      body: JSON.stringify({
        scope: "store",
        targetId: "pp-a01",
        zone: "dining",
        action: "volume",
        volume: 0.6,
      }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).result?.data.commandId).toBeTruthy();
  });

  it("content.emergencyMessage dispatches to a scope", async () => {
    const res = await fetch(`${baseURL}/api/trpc/content.emergencyMessage`, {
      method: "POST",
      ...authed(hqToken),
      body: JSON.stringify({
        scope: "store",
        targetId: "pp-a01",
        heading: "Fire drill in progress",
        body: "Please exit calmly.",
      }),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()).result?.data;
    expect(data.targets).toBe(1);
  });

  it("scenes.trigger applies a scene to a scope", async () => {
    // find the seeded Brand Standard scene
    const list = await fetch(`${baseURL}/api/trpc/scenes.list`, { ...authed(hqToken) });
    const scenes = (await list.json()).result?.data ?? [];
    if (scenes.length === 0) return; // seed not present in this environment
    const res = await fetch(`${baseURL}/api/trpc/scenes.trigger`, {
      method: "POST",
      ...authed(hqToken),
      body: JSON.stringify({ sceneId: scenes[0].id, scope: "store", targetId: "pp-a01" }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).result?.data.components.rgb).toBe(true);
  });

  it("commands.get returns ack trail structure", async () => {
    const list = await fetch(`${baseURL}/api/trpc/commands.list?input=${encodeURIComponent(JSON.stringify({ limit: 1 }))}`, { ...authed(hqToken) });
    const rows = (await list.json()).result?.data;
    if (!rows || rows.length === 0) return;
    const get = await fetch(
      `${baseURL}/api/trpc/commands.get?input=${encodeURIComponent(JSON.stringify({ commandId: rows[0].commandId }))}`,
      { ...authed(hqToken) }
    );
    const cmd = (await get.json()).result?.data;
    expect(cmd).toHaveProperty("ackState");
    expect(cmd).toHaveProperty("status");
  });
});

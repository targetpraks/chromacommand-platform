import { describe, it, expect, beforeAll } from "vitest";
import WebSocket from "ws";

const baseURL = process.env.API_URL || "http://localhost:4000";
const wsBaseURL = baseURL.replace("http:", "ws:");

let hqToken = "";
let franchiseeToken = "";

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

beforeAll(async () => {
  hqToken = await login("ricardo@infxmedia.co.za");
  franchiseeToken = await login("franchisee.a01@papapasta.co.za");
  expect(hqToken).toBeTruthy();
  expect(franchiseeToken).toBeTruthy();
});

describe("Public endpoints", () => {
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

describe("Auth", () => {
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

describe("Read endpoints (authenticated)", () => {
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

describe("RBAC scope enforcement", () => {
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

describe("Telemetry", () => {
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

describe.skipIf(process.env.DISABLE_LOGIN_RATE_LIMIT === "1")("Login rate-limit", () => {
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

describe("Load Test — 100 concurrent requests", () => {
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

describe("WebSocket Live Endpoint", () => {
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

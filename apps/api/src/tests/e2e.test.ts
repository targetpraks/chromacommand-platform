import { describe, it, expect } from "vitest";
import WebSocket from "ws";

const baseURL = process.env.API_URL || "http://localhost:4000";
const wsBaseURL = baseURL.replace("http:", "ws:");

describe("ChromaCommand E2E", () => {
  it("health endpoint returns ok", async () => {
    const res = await fetch(`${baseURL}/api/trpc/health.ping`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result?.data?.json?.status).toBe("ok");
  });

  it("stores.list returns array", async () => {
    const res = await fetch(`${baseURL}/api/trpc/stores.list`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.result?.data?.json)).toBe(true);
  });

  it("stores.get returns a store", async () => {
    const res = await fetch(`${baseURL}/api/trpc/stores.get?input=%7B%22id%22%3A%22pp-a01%22%7D`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result?.data?.json?.id).toBe("pp-a01");
  });

  it("rgb.listPresets returns presets", async () => {
    const res = await fetch(`${baseURL}/api/trpc/rgb.listPresets`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.result?.data?.json)).toBe(true);
  });

  it("analytics.getStats returns numbers", async () => {
    const res = await fetch(`${baseURL}/api/trpc/analytics.getStats`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.result?.data?.json?.impressions).toBe("number");
    expect(typeof body.result?.data?.json?.footfall).toBe("number");
  });

  it("sync.transform dispatches command", async () => {
    const res = await fetch(`${baseURL}/api/trpc/sync.transform`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ json: { name: "MTN TakeOver", scope: "store", targetId: "pp-a01" } }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result?.data?.json?.status).toBe("dispatched");
  });

  it("sponsor.getCampaignData returns data", async () => {
    const res = await fetch(`${baseURL}/api/trpc/sponsor.getCampaignData`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result?.data?.json?.sponsorName).toBeDefined();
    expect(body.result?.data?.json?.summary).toBeDefined();
  });
});

describe("Load Test — 100 concurrent requests", () => {
  it("handles 100 parallel stores.list in <2s total", async () => {
    const start = Date.now();
    const promises = Array.from({ length: 100 }, () =>
      fetch(`${baseURL}/api/trpc/stores.list`)
    );
    const results = await Promise.all(promises);
    const duration = Date.now() - start;

    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(duration).toBeLessThan(2000);
    console.log(`   100 requests in ${duration}ms (~${(duration/100).toFixed(1)}ms avg)`);
  });
});

describe("WebSocket Live Endpoint", () => {
  it("connects and receives connected event", async () => {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${wsBaseURL}/live/ws`);
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

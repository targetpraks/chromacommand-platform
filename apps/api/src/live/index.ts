import { FastifyInstance } from "fastify";
import { WebSocket } from "ws";

interface LiveClient {
  ws: WebSocket;
  subscriptions: Set<string>;
}

const clients = new Map<string, LiveClient>();

export function broadcast(event: {
  type: string;
  storeId?: string;
  scope?: string;
  payload: Record<string, unknown>;
}) {
  const message = JSON.stringify(event);
  for (const [, client] of clients) {
    if (client.subscriptions.has("all") || client.subscriptions.has(event.storeId ?? "all")) {
      try { client.ws.send(message); } catch { /* ignore closed */ }
    }
  }
}

export function registerLiveRoutes(fastify: FastifyInstance) {
  fastify.get("/live/ws", { websocket: true }, (connection) => {
    const ws = connection.socket;
    const clientId = `client_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const client: LiveClient = { ws, subscriptions: new Set() };
    clients.set(clientId, client);

    ws.on("message", (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString()) as Record<string, string>;
        if (msg.action === "subscribe") {
          client.subscriptions.add(msg.topic);
          ws.send(JSON.stringify({ type: "subscribed", topic: msg.topic }));
        }
        if (msg.action === "unsubscribe") {
          client.subscriptions.delete(msg.topic);
        }
      } catch { /* ignore malformed */ }
    });

    ws.on("close", () => clients.delete(clientId));

    ws.send(JSON.stringify({ type: "connected", clientId }));
  });

  fastify.get("/live/health", async () => ({ clients: clients.size, uptime: process.uptime() }));
}

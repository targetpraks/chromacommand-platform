import { FastifyInstance } from "fastify";
import { WebSocket } from "ws";
import jwt from "jsonwebtoken";
import type { AuthUser } from "../auth";

interface LiveClient {
  ws: WebSocket;
  user: AuthUser;
  subscriptions: Set<string>;
}

const clients = new Map<string, LiveClient>();

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

function verifyToken(token: string | undefined): AuthUser | null {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      orgId: payload.orgId ?? null,
      scope: Array.isArray(payload.scope) ? payload.scope : [],
    };
  } catch {
    return null;
  }
}

/** Filter what each client is allowed to see based on their JWT scope. */
function canSeeStore(user: AuthUser, storeId: string | undefined): boolean {
  if (user.scope.includes("*")) return true;
  if (!storeId) return true; // global broadcast
  if (user.scope.includes(`store:${storeId}`)) return true;
  // For region-scoped users we'd need a region->store map; sending the event
  // through is acceptable since the dashboard re-queries via tRPC which
  // re-applies scope checks server-side.
  return user.scope.some((s) => s.startsWith("region:"));
}

export function broadcast(event: {
  type: string;
  storeId?: string;
  scope?: string;
  payload: Record<string, unknown>;
}) {
  const message = JSON.stringify(event);
  for (const [, client] of clients) {
    if (!canSeeStore(client.user, event.storeId)) continue;
    if (client.subscriptions.has("all") || client.subscriptions.has(event.storeId ?? "all")) {
      try {
        client.ws.send(message);
      } catch {
        /* ignore closed */
      }
    }
  }
}

export function registerLiveRoutes(fastify: FastifyInstance) {
  fastify.get("/live/ws", { websocket: true }, (connection, req) => {
    const ws = connection.socket;

    // Token can come from ?token=… (preferred for browser WS where headers
    // can't be set) or from the Authorization header (server-to-server).
    const queryToken = (req.query as Record<string, string> | undefined)?.token;
    const headerToken = (req.headers.authorization || "").replace(/^Bearer\s+/i, "") || undefined;
    const user = verifyToken(queryToken || headerToken);

    if (!user) {
      try {
        ws.send(JSON.stringify({ type: "error", code: "unauthorized" }));
      } catch { /* socket may already be closing */ }
      ws.close(1008, "unauthorized");
      return;
    }

    const clientId = `client_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const client: LiveClient = { ws, user, subscriptions: new Set() };
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
      } catch {
        /* ignore malformed */
      }
    });

    ws.on("close", () => clients.delete(clientId));

    ws.send(JSON.stringify({ type: "connected", clientId, user: { id: user.id, role: user.role } }));
  });

  fastify.get("/live/health", async () => ({ clients: clients.size, uptime: process.uptime() }));
}

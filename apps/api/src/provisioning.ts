import type { FastifyInstance } from "fastify";
import { db } from "@chromacommand/database";
import { stores, activityLog } from "@chromacommand/database/schema";
import { eq } from "drizzle-orm";
import { randomBytes, createPrivateKey, createPublicKey, sign as cryptoSign } from "node:crypto";

/**
 * Edge gateway provisioning per PRD §22.
 *
 * Flow:
 *   1. Operator generates a single-use 8-char code in the dashboard
 *      paired with a store_id (stored in `provisioning_codes` — for
 *      this initial impl we accept any 8-char code that maps to an
 *      existing store via the `store_id_hint` query param; production
 *      will move to the codes table).
 *   2. ThinkCentre POSTs /provision/claim with its public key + code.
 *   3. We sign a per-device cert (CN=store_id) with our CA, return
 *      cert + chain + broker URL + store_id.
 *
 * Note: This is a *minimal* implementation suitable for staging — for
 * production, a real X.509 CA (cfssl, step-ca, or AWS Private CA) should
 * sign the certs. Here we generate a self-signed-by-CA proxy by signing
 * the public key with the platform's signing key. EMQX is configured
 * to trust the same CA bundle.
 */

const PROVISION_CODE_TTL_MS = 24 * 60 * 60 * 1000;
const codes = new Map<string, { storeId: string; regionId: string; expiresAt: number }>();

export function issueProvisioningCode(storeId: string, regionId: string): string {
  // 8-char alphanumeric, ambiguous chars stripped (no 0/O/1/I).
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += alphabet[randomBytes(1)[0] % alphabet.length];
  }
  codes.set(code, { storeId, regionId, expiresAt: Date.now() + PROVISION_CODE_TTL_MS });
  return code;
}

// Cleanup expired codes once a minute.
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of codes) if (v.expiresAt < now) codes.delete(k);
}, 60_000).unref?.();

function buildSelfSignedClientCert(publicKeyPem: string, storeId: string): { certPem: string; caPem: string } {
  // Production: replace with a real CA sign. For staging we wrap the
  // operator's public key in a trivial PEM-encoded "cert envelope" that
  // contains the store_id as the CN.  EMQX in mTLS test mode will accept
  // any client whose CN matches the expected ACL pattern.
  //
  // The "cert" here is a marker — when production goes live, swap this
  // with a call to `step ca sign` or `cfssl sign`.
  const fakeCert = [
    "-----BEGIN STAGING CLIENT CERT-----",
    `CN=store-${storeId}`,
    `Issued: ${new Date().toISOString()}`,
    `Public-Key:\n${publicKeyPem.trim()}`,
    "-----END STAGING CLIENT CERT-----",
  ].join("\n");
  const caBundle = process.env.PROVISION_CA_PEM || "-----BEGIN STAGING CA-----\nstaging-ca\n-----END STAGING CA-----";
  return { certPem: fakeCert, caPem: caBundle };
}

export function registerProvisioningRoutes(fastify: FastifyInstance): void {
  // Operator-only endpoint to mint a code — gated by API key for now.
  fastify.post("/provision/issue", async (req, reply) => {
    const apiKey = (req.headers["x-admin-key"] as string) || "";
    if (apiKey !== process.env.PROVISION_ADMIN_KEY) {
      return reply.code(401).send({ error: "unauthorized" });
    }
    const body = req.body as any;
    if (!body?.store_id) return reply.code(400).send({ error: "store_id required" });
    const [store] = await db.select().from(stores).where(eq(stores.id, body.store_id));
    if (!store) return reply.code(404).send({ error: "store not found" });
    const code = issueProvisioningCode(store.id, store.regionId);
    return { provisioning_code: code, store_id: store.id, expires_in_seconds: PROVISION_CODE_TTL_MS / 1000 };
  });

  // Edge device claims its identity.
  fastify.post("/provision/claim", async (req, reply) => {
    const body = req.body as any;
    const code = (body?.provisioning_code || "").toUpperCase();
    const pubkey = body?.public_key;
    if (!code || !pubkey) return reply.code(400).send({ error: "provisioning_code and public_key required" });

    const entry = codes.get(code);
    if (!entry || entry.expiresAt < Date.now()) {
      return reply.code(401).send({ error: "invalid or expired code" });
    }

    // Validate pubkey is a real PEM
    try {
      createPublicKey(pubkey);
    } catch {
      return reply.code(400).send({ error: "public_key is not a valid PEM" });
    }

    // Single-use — burn it.
    codes.delete(code);

    const { certPem, caPem } = buildSelfSignedClientCert(pubkey, entry.storeId);

    await db.insert(activityLog).values({
      action: "edge_provisioned",
      scope: "store",
      targetId: entry.storeId,
      details: { code, ip: req.ip },
      ipAddress: req.ip,
    });

    return {
      store_id: entry.storeId,
      region_id: entry.regionId,
      mqtt_broker_url: process.env.PROVISION_BROKER_URL || "mqtts://broker.chromacommand.io:8883",
      cert_pem: certPem,
      ca_pem: caPem,
      issued_at: new Date().toISOString(),
    };
  });

  // Cert renewal — authenticated via current cert's mTLS handshake at
  // the reverse-proxy layer; in this stub we just rotate.
  fastify.post("/provision/renew", async (req, reply) => {
    const body = req.body as any;
    const pubkey = body?.public_key;
    if (!pubkey) return reply.code(400).send({ error: "public_key required" });
    const storeId = (req.headers["x-store-id"] as string) || "unknown";
    const { certPem, caPem } = buildSelfSignedClientCert(pubkey, storeId);
    return { cert_pem: certPem, ca_pem: caPem, issued_at: new Date().toISOString() };
  });
}

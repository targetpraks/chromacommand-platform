import { pgTable, uuid, varchar, text, jsonb, timestamp, doublePrecision, boolean, inet, integer, bigserial, index } from "drizzle-orm/pg-core";

export const orgs = pgTable("orgs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 128 }).notNull(),
  type: varchar("type", { length: 32 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  firebaseUid: varchar("firebase_uid", { length: 64 }).notNull().unique(),
  email: varchar("email", { length: 256 }).notNull().unique(),
  name: varchar("name", { length: 128 }),
  role: varchar("role", { length: 32 }).notNull(),
  orgId: uuid("org_id").references(() => orgs.id),
  scope: jsonb("scope").default("[]").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const stores = pgTable("stores", {
  id: varchar("id", { length: 32 }).primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  regionId: varchar("region_id", { length: 32 }).notNull(),
  address: text("address"),
  lat: doublePrecision("lat"),
  lon: doublePrecision("lon"),
  managerId: uuid("manager_id"),
  orgId: uuid("org_id"),
  status: varchar("status", { length: 16 }).default("setup").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const ledZones = pgTable("led_zones", {
  id: varchar("id", { length: 64 }).primaryKey(),
  storeId: varchar("store_id", { length: 32 }).notNull().references(() => stores.id),
  displayName: varchar("display_name", { length: 128 }).notNull(),
  group: varchar("group", { length: 32 }).notNull(),
  controllerMac: varchar("controller_mac", { length: 17 }).notNull(),
  ledCount: integer("led_count").default(0).notNull(),
  position: jsonb("position"),
  dimensions: jsonb("dimensions"),
  ledType: varchar("led_type", { length: 16 }).default("WS2812B"),
  voltage: doublePrecision("voltage").default(5),
  maxBrightness: doublePrecision("max_brightness").default(1.0),
  currentColour: varchar("current_colour", { length: 7 }).default("#1B2A4A"),
  currentMode: varchar("current_mode", { length: 32 }).default("solid"),
  status: varchar("status", { length: 16 }).default("setup").notNull(),
  lastHeartbeat: timestamp("last_heartbeat", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const screens = pgTable("screens", {
  id: varchar("id", { length: 64 }).primaryKey(),
  storeId: varchar("store_id", { length: 32 }).notNull().references(() => stores.id),
  screenType: varchar("screen_type", { length: 32 }).notNull(),
  hardwareType: varchar("hardware_type", { length: 64 }),
  macAddress: varchar("mac_address", { length: 17 }).unique(),
  ipAddress: inet("ip_address"),
  dimensions: jsonb("dimensions"),
  firmwareVersion: varchar("firmware_version", { length: 32 }),
  status: varchar("status", { length: 16 }).default("offline").notNull(),
  lastHeartbeat: timestamp("last_heartbeat", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const audioZones = pgTable("audio_zones", {
  id: varchar("id", { length: 64 }).primaryKey(),
  storeId: varchar("store_id", { length: 32 }).notNull().references(() => stores.id),
  zoneType: varchar("zone_type", { length: 32 }).notNull(),
  sinkName: varchar("sink_name", { length: 64 }),
  volume: doublePrecision("volume").default(0.5),
  status: varchar("status", { length: 16 }).default("offline").notNull(),
  lastHeartbeat: timestamp("last_heartbeat", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const rgbPresets = pgTable("rgb_presets", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 64 }).notNull(),
  description: text("description"),
  colours: jsonb("colours").notNull(),
  mode: varchar("mode", { length: 32 }).default("solid"),
  brightness: doublePrecision("brightness").default(1.0),
  speed: doublePrecision("speed").default(1.0),
  orgId: uuid("org_id").references(() => orgs.id),
  isGlobal: boolean("is_global").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const rgbSchedules = pgTable("rgb_schedules", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 64 }).notNull(),
  presetId: uuid("preset_id").references(() => rgbPresets.id),
  scope: varchar("scope", { length: 16 }).notNull(),
  targetId: varchar("target_id", { length: 32 }).notNull(),
  cronExpression: varchar("cron_expression", { length: 64 }).notNull(),
  timezone: varchar("timezone", { length: 64 }).default("Africa/Johannesburg"),
  active: boolean("active").default(true),
  priority: integer("priority").default(100),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const contentTemplates = pgTable("content_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 128 }).notNull(),
  htmlStructure: text("html_structure").notNull(),
  cssBase: text("css_base"),
  variableSchema: jsonb("variable_schema"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const contentAssets = pgTable("content_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 128 }).notNull(),
  type: varchar("type", { length: 32 }).notNull(),
  templateId: uuid("template_id").references(() => contentTemplates.id),
  variables: jsonb("variables"),
  htmlContent: text("html_content"),
  css: text("css"),
  dimensions: jsonb("dimensions"),
  durationSeconds: integer("duration_seconds").default(15),
  priority: integer("priority").default(100),
  validFrom: timestamp("valid_from", { withTimezone: true }),
  validUntil: timestamp("valid_until", { withTimezone: true }),
  tags: jsonb("tags").default("[]"),
  orgId: uuid("org_id").references(() => orgs.id),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const playlists = pgTable("playlists", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 128 }).notNull(),
  items: jsonb("items").notNull(),
  loopDuration: integer("loop_duration"),
  schedule: jsonb("schedule"),
  createdBy: uuid("created_by"),
  orgId: uuid("org_id").references(() => orgs.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const playlistAssignments = pgTable("playlist_assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  playlistId: uuid("playlist_id").references(() => playlists.id),
  screenId: varchar("screen_id", { length: 64 }).references(() => screens.id),
  scope: varchar("scope", { length: 16 }).notNull(),
  targetId: varchar("target_id", { length: 32 }).notNull(),
  priority: integer("priority").default(100),
  active: boolean("active").default(true),
  assignedAt: timestamp("assigned_at", { withTimezone: true }).defaultNow(),
  assignedBy: uuid("assigned_by"),
});

export const audioPlaylists = pgTable("audio_playlists", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 128 }).notNull(),
  tracks: jsonb("tracks").notNull(),
  tags: jsonb("tags").default("[]"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const activityLog = pgTable("activity_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id),
  action: varchar("action", { length: 64 }).notNull(),
  scope: varchar("scope", { length: 16 }).notNull(),
  targetId: varchar("target_id", { length: 32 }).notNull(),
  details: jsonb("details"),
  ipAddress: inet("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const sensorTelemetry = pgTable("sensor_telemetry", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  storeId: varchar("store_id", { length: 32 }).notNull().references(() => stores.id),
  sensorId: varchar("sensor_id", { length: 64 }).notNull(),
  metric: varchar("metric", { length: 32 }).notNull(),
  value: doublePrecision("value").notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => ({
  byStoreMetric: index("idx_telemetry_store_metric_time").on(t.storeId, t.metric, t.recordedAt),
  byTime: index("idx_telemetry_recorded_at").on(t.recordedAt),
}));

export const deviceHeartbeats = pgTable("device_heartbeats", {
  deviceId: varchar("device_id", { length: 64 }).primaryKey(),
  deviceType: varchar("device_type", { length: 32 }).notNull(),
  storeId: varchar("store_id", { length: 32 }).notNull().references(() => stores.id),
  lastSeen: timestamp("last_seen", { withTimezone: true }).notNull(),
  ipAddress: inet("ip_address"),
  firmwareVersion: varchar("firmware_version", { length: 32 }),
});

export const syncTransactions = pgTable("sync_transactions", {
  commandId: varchar("command_id", { length: 64 }).primaryKey(),
  scope: varchar("scope", { length: 16 }).notNull(),
  targetId: varchar("target_id", { length: 32 }).notNull(),
  presetIdBefore: uuid("preset_id_before"),
  presetIdAfter: uuid("preset_id_after"),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  ackState: jsonb("ack_state").default("{}"),
  initiatedBy: uuid("initiated_by"),
});

/**
 * Refresh tokens — server-side record so we can revoke without waiting for
 * JWT expiry. Each row = one issued refresh token. Rotation: on /auth/refresh
 * we mark the old row revoked and insert a new one (refresh-token rotation
 * pattern — detects stolen tokens because the original presenter sees a 401
 * the first time the thief uses it).
 */
export const refreshTokens = pgTable("refresh_tokens", {
  jti: varchar("jti", { length: 64 }).primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  issuedAt: timestamp("issued_at", { withTimezone: true }).defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  replacedByJti: varchar("replaced_by_jti", { length: 64 }),
  ipAddress: inet("ip_address"),
  userAgent: text("user_agent"),
});

/**
 * Sponsor activations — billing record per TakeOver invocation.
 * Created on every sync.transform that targets a sponsor preset.
 * Closed when a subsequent sync.transform replaces it (endedAt set).
 *
 * Billing model: sponsors are billed on (impressions × duration_seconds).
 * Impressions are joined from sensor_telemetry at invoice time.
 */
export const sponsorActivations = pgTable("sponsor_activations", {
  id: uuid("id").primaryKey().defaultRandom(),
  sponsorName: varchar("sponsor_name", { length: 64 }).notNull(),
  presetId: uuid("preset_id").references(() => rgbPresets.id),
  scope: varchar("scope", { length: 16 }).notNull(),
  targetId: varchar("target_id", { length: 32 }).notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  durationSeconds: integer("duration_seconds"),
  affectedStores: integer("affected_stores").default(0),
  initiatedBy: uuid("initiated_by").references(() => users.id),
  commandId: varchar("command_id", { length: 64 }),
  ratePerImpressionCents: integer("rate_per_impression_cents").default(5),  // 5c per impression default
});

/**
 * Firmware releases — OTA payload registry. PRD §11.3 (LED) + §11.4 (screen).
 * Each row = one firmware version available for a device class.
 */
export const firmwareReleases = pgTable("firmware_releases", {
  id: uuid("id").primaryKey().defaultRandom(),
  deviceClass: varchar("device_class", { length: 32 }).notNull(),    // led_controller | screen_player | audio_player | gateway
  version: varchar("version", { length: 32 }).notNull(),
  url: text("url").notNull(),                                         // CDN URL (signed S3/R2)
  sha256: varchar("sha256", { length: 64 }).notNull(),                // hex
  sizeBytes: integer("size_bytes"),
  notes: text("notes"),
  releasedAt: timestamp("released_at", { withTimezone: true }).defaultNow(),
  createdBy: uuid("created_by").references(() => users.id),
});

/**
 * Firmware deployments — which release was pushed to which target.
 * Tracks rollout status so we can compute the §15.3 A14 success-rate SLO.
 */
export const firmwareDeployments = pgTable("firmware_deployments", {
  id: uuid("id").primaryKey().defaultRandom(),
  releaseId: uuid("release_id").notNull().references(() => firmwareReleases.id),
  scope: varchar("scope", { length: 16 }).notNull(),
  targetId: varchar("target_id", { length: 32 }).notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  status: varchar("status", { length: 16 }).default("pending").notNull(),  // pending|success|failed|partial
  totalDevices: integer("total_devices").default(0),
  successCount: integer("success_count").default(0),
  failureCount: integer("failure_count").default(0),
  initiatedBy: uuid("initiated_by").references(() => users.id),
});

/**
 * Alert rules — declarative threshold checks against sensor_telemetry.
 * Eval'd by the alerts engine (apps/api/src/alerts.ts) every 60s.
 *
 * Example: R638 fridge compliance
 *   metric=temperature, comparator=">", threshold=5.0, sustainedMinutes=10
 *   → fires Slack alert if any fridge sensor stays above 5°C for >10 min.
 */
export const alertRules = pgTable("alert_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 128 }).notNull(),
  description: text("description"),
  metric: varchar("metric", { length: 32 }).notNull(),
  comparator: varchar("comparator", { length: 8 }).notNull(),  // > | < | >= | <= | ==
  threshold: doublePrecision("threshold").notNull(),
  sustainedMinutes: integer("sustained_minutes").default(0),    // 0 = fire on first sample
  scope: varchar("scope", { length: 16 }).notNull(),            // global | region | store
  targetId: varchar("target_id", { length: 32 }).notNull(),
  severity: varchar("severity", { length: 16 }).default("warning"),  // info|warning|critical
  webhookUrl: text("webhook_url"),                               // Slack/Teams/Discord webhook
  active: boolean("active").default(true),
  cooldownMinutes: integer("cooldown_minutes").default(15),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

/**
 * Alert events — one row per fired alert. We keep a history so dashboards
 * can show "last 24h alerts" + investigate flapping rules.
 */
export const alertEvents = pgTable("alert_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  ruleId: uuid("rule_id").references(() => alertRules.id),
  storeId: varchar("store_id", { length: 32 }).references(() => stores.id),
  metric: varchar("metric", { length: 32 }).notNull(),
  observedValue: doublePrecision("observed_value").notNull(),
  threshold: doublePrecision("threshold").notNull(),
  severity: varchar("severity", { length: 16 }).notNull(),
  message: text("message"),
  firedAt: timestamp("fired_at", { withTimezone: true }).defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  webhookDelivered: boolean("webhook_delivered").default(false),
});

/**
 * Spotify accounts — OAuth credentials for operator-controlled Spotify
 * playback. A single account can be flagged as the platform default and
 * used for all stores ("shared"), or per-store accounts can be linked
 * for true independent multi-store playback.
 *
 * Refreshed automatically when access_token nears expiry.
 */
export const spotifyAccounts = pgTable("spotify_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  scope: varchar("scope", { length: 16 }).notNull().default("global"),    // global | region | store
  targetId: varchar("target_id", { length: 32 }).notNull().default("all"),
  spotifyUserId: varchar("spotify_user_id", { length: 128 }).notNull(),
  displayName: varchar("display_name", { length: 128 }),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  tokenScope: text("token_scope"),                                          // OAuth scopes granted
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  productTier: varchar("product_tier", { length: 16 }),                     // free | premium
  active: boolean("active").default(true),
  linkedBy: uuid("linked_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

/**
 * Spotify auth state — short-lived nonce used in the OAuth flow to
 * correlate the redirect callback to the user who initiated it.
 */
export const spotifyAuthStates = pgTable("spotify_auth_states", {
  state: varchar("state", { length: 64 }).primaryKey(),
  userId: uuid("user_id").references(() => users.id),
  scope: varchar("scope", { length: 16 }).notNull().default("global"),
  targetId: varchar("target_id", { length: 32 }).notNull().default("all"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

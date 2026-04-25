import { pgTable, uuid, varchar, text, jsonb, timestamp, float, boolean, inet, integer, bigserial, doublePrecision, index } from "drizzle-orm/pg-core";

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
  lat: float("lat"),
  lon: float("lon"),
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
  voltage: float("voltage").default(5),
  maxBrightness: float("max_brightness").default(1.0),
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
  volume: float("volume").default(0.5),
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
  brightness: float("brightness").default(1.0),
  speed: float("speed").default(1.0),
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

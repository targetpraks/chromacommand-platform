-- ChromaCommand initial schema baseline.
-- This is the hand-written equivalent of `drizzle-kit generate` output as of
-- the v1.2 schema (Phase 6.1). Future schema changes should add new files
-- via `drizzle-kit generate` rather than editing this one.

CREATE TABLE IF NOT EXISTS "orgs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" varchar(128) NOT NULL,
  "type" varchar(32) NOT NULL,
  "created_at" timestamptz DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "firebase_uid" varchar(64) NOT NULL UNIQUE,
  "email" varchar(256) NOT NULL UNIQUE,
  "name" varchar(128),
  "role" varchar(32) NOT NULL,
  "org_id" uuid REFERENCES "orgs"("id"),
  "scope" jsonb DEFAULT '[]' NOT NULL,
  "created_at" timestamptz DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "stores" (
  "id" varchar(32) PRIMARY KEY,
  "name" varchar(128) NOT NULL,
  "region_id" varchar(32) NOT NULL,
  "address" text,
  "lat" double precision,
  "lon" double precision,
  "manager_id" uuid,
  "org_id" uuid,
  "status" varchar(16) DEFAULT 'setup' NOT NULL,
  "created_at" timestamptz DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "led_zones" (
  "id" varchar(64) PRIMARY KEY,
  "store_id" varchar(32) NOT NULL REFERENCES "stores"("id"),
  "display_name" varchar(128) NOT NULL,
  "group" varchar(32) NOT NULL,
  "controller_mac" varchar(17) NOT NULL,
  "led_count" integer DEFAULT 0 NOT NULL,
  "position" jsonb,
  "dimensions" jsonb,
  "led_type" varchar(16) DEFAULT 'WS2812B',
  "voltage" double precision DEFAULT 5,
  "max_brightness" double precision DEFAULT 1.0,
  "current_colour" varchar(7) DEFAULT '#1B2A4A',
  "current_mode" varchar(32) DEFAULT 'solid',
  "status" varchar(16) DEFAULT 'setup' NOT NULL,
  "last_heartbeat" timestamptz,
  "created_at" timestamptz DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "screens" (
  "id" varchar(64) PRIMARY KEY,
  "store_id" varchar(32) NOT NULL REFERENCES "stores"("id"),
  "screen_type" varchar(32) NOT NULL,
  "hardware_type" varchar(64),
  "mac_address" varchar(17) UNIQUE,
  "ip_address" inet,
  "dimensions" jsonb,
  "firmware_version" varchar(32),
  "status" varchar(16) DEFAULT 'offline' NOT NULL,
  "last_heartbeat" timestamptz,
  "created_at" timestamptz DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "audio_zones" (
  "id" varchar(64) PRIMARY KEY,
  "store_id" varchar(32) NOT NULL REFERENCES "stores"("id"),
  "zone_type" varchar(32) NOT NULL,
  "sink_name" varchar(64),
  "volume" double precision DEFAULT 0.5,
  "status" varchar(16) DEFAULT 'offline' NOT NULL,
  "last_heartbeat" timestamptz,
  "created_at" timestamptz DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "rgb_presets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" varchar(64) NOT NULL,
  "description" text,
  "colours" jsonb NOT NULL,
  "mode" varchar(32) DEFAULT 'solid',
  "brightness" double precision DEFAULT 1.0,
  "speed" double precision DEFAULT 1.0,
  "org_id" uuid REFERENCES "orgs"("id"),
  "is_global" boolean DEFAULT false,
  "created_at" timestamptz DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "rgb_schedules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" varchar(64) NOT NULL,
  "preset_id" uuid REFERENCES "rgb_presets"("id"),
  "scope" varchar(16) NOT NULL,
  "target_id" varchar(32) NOT NULL,
  "cron_expression" varchar(64) NOT NULL,
  "timezone" varchar(64) DEFAULT 'Africa/Johannesburg',
  "active" boolean DEFAULT true,
  "priority" integer DEFAULT 100,
  "created_at" timestamptz DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "content_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" varchar(128) NOT NULL,
  "html_structure" text NOT NULL,
  "css_base" text,
  "variable_schema" jsonb,
  "created_at" timestamptz DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "content_assets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" varchar(128) NOT NULL,
  "type" varchar(32) NOT NULL,
  "template_id" uuid REFERENCES "content_templates"("id"),
  "variables" jsonb,
  "html_content" text,
  "css" text,
  "dimensions" jsonb,
  "duration_seconds" integer DEFAULT 15,
  "priority" integer DEFAULT 100,
  "valid_from" timestamptz,
  "valid_until" timestamptz,
  "tags" jsonb DEFAULT '[]',
  "org_id" uuid REFERENCES "orgs"("id"),
  "created_by" uuid,
  "created_at" timestamptz DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "playlists" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" varchar(128) NOT NULL,
  "items" jsonb NOT NULL,
  "loop_duration" integer,
  "schedule" jsonb,
  "created_by" uuid,
  "org_id" uuid REFERENCES "orgs"("id"),
  "created_at" timestamptz DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "playlist_assignments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "playlist_id" uuid REFERENCES "playlists"("id"),
  "screen_id" varchar(64) REFERENCES "screens"("id"),
  "scope" varchar(16) NOT NULL,
  "target_id" varchar(32) NOT NULL,
  "priority" integer DEFAULT 100,
  "active" boolean DEFAULT true,
  "assigned_at" timestamptz DEFAULT NOW(),
  "assigned_by" uuid
);

CREATE TABLE IF NOT EXISTS "audio_playlists" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" varchar(128) NOT NULL,
  "tracks" jsonb NOT NULL,
  "tags" jsonb DEFAULT '[]',
  "created_at" timestamptz DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "activity_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid REFERENCES "users"("id"),
  "action" varchar(64) NOT NULL,
  "scope" varchar(16) NOT NULL,
  "target_id" varchar(32) NOT NULL,
  "details" jsonb,
  "ip_address" inet,
  "user_agent" text,
  "created_at" timestamptz DEFAULT NOW()
);

-- Phase 6 additions: telemetry pipeline + sync transactions.

CREATE TABLE IF NOT EXISTS "sensor_telemetry" (
  "id" bigserial PRIMARY KEY,
  "store_id" varchar(32) NOT NULL REFERENCES "stores"("id"),
  "sensor_id" varchar(64) NOT NULL,
  "metric" varchar(32) NOT NULL,
  "value" double precision NOT NULL,
  "recorded_at" timestamptz NOT NULL,
  "created_at" timestamptz DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "idx_telemetry_store_metric_time"
  ON "sensor_telemetry" ("store_id", "metric", "recorded_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_telemetry_recorded_at"
  ON "sensor_telemetry" ("recorded_at" DESC);

CREATE TABLE IF NOT EXISTS "device_heartbeats" (
  "device_id" varchar(64) PRIMARY KEY,
  "device_type" varchar(32) NOT NULL,
  "store_id" varchar(32) NOT NULL REFERENCES "stores"("id"),
  "last_seen" timestamptz NOT NULL,
  "ip_address" inet,
  "firmware_version" varchar(32)
);

CREATE TABLE IF NOT EXISTS "sync_transactions" (
  "command_id" varchar(64) PRIMARY KEY,
  "scope" varchar(16) NOT NULL,
  "target_id" varchar(32) NOT NULL,
  "preset_id_before" uuid,
  "preset_id_after" uuid,
  "started_at" timestamptz DEFAULT NOW(),
  "completed_at" timestamptz,
  "ack_state" jsonb DEFAULT '{}',
  "initiated_by" uuid
);

-- Phase 6.2 additions: refresh token rotation.

CREATE TABLE IF NOT EXISTS "refresh_tokens" (
  "jti" varchar(64) PRIMARY KEY,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "issued_at" timestamptz DEFAULT NOW(),
  "expires_at" timestamptz NOT NULL,
  "revoked_at" timestamptz,
  "replaced_by_jti" varchar(64),
  "ip_address" inet,
  "user_agent" text
);
CREATE INDEX IF NOT EXISTS "idx_refresh_user_active"
  ON "refresh_tokens" ("user_id") WHERE "revoked_at" IS NULL;

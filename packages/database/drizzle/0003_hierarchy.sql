-- 0003: Master-control hierarchy + inventory.
--   countries → provinces → cities → stores (geo tree for scope expansion)
--   led_zones.segments (per-segment pixel addressing)
--   devices (unified device inventory)
--   commands (dispatch → ack command ledger)
--   scenes (multi-component TakeOver presets)

CREATE TABLE IF NOT EXISTS "countries" (
  "id" varchar(32) PRIMARY KEY,
  "name" varchar(128) NOT NULL,
  "code" varchar(8),
  "created_at" timestamptz DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "provinces" (
  "id" varchar(32) PRIMARY KEY,
  "country_id" varchar(32) NOT NULL REFERENCES "countries"("id") ON DELETE CASCADE,
  "name" varchar(128) NOT NULL,
  "created_at" timestamptz DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "idx_provinces_country" ON "provinces" ("country_id");

CREATE TABLE IF NOT EXISTS "cities" (
  "id" varchar(32) PRIMARY KEY,
  "province_id" varchar(32) NOT NULL REFERENCES "provinces"("id") ON DELETE CASCADE,
  "name" varchar(128) NOT NULL,
  "created_at" timestamptz DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "idx_cities_province" ON "cities" ("province_id");

ALTER TABLE "stores"
  ADD COLUMN IF NOT EXISTS "country_id" varchar(32) REFERENCES "countries"("id"),
  ADD COLUMN IF NOT EXISTS "province_id" varchar(32) REFERENCES "provinces"("id"),
  ADD COLUMN IF NOT EXISTS "city_id" varchar(32) REFERENCES "cities"("id");
CREATE INDEX IF NOT EXISTS "idx_stores_geo" ON "stores" ("country_id", "province_id", "city_id");

ALTER TABLE "led_zones" ADD COLUMN IF NOT EXISTS "segments" jsonb DEFAULT '[]';

CREATE TABLE IF NOT EXISTS "devices" (
  "id" varchar(64) PRIMARY KEY,
  "store_id" varchar(32) NOT NULL REFERENCES "stores"("id"),
  "device_type" varchar(32) NOT NULL,
  "label" varchar(128),
  "entity_ref" varchar(64),
  "mac_address" varchar(17),
  "ip_address" inet,
  "firmware_version" varchar(32),
  "status" varchar(16) DEFAULT 'offline' NOT NULL,
  "last_seen" timestamptz,
  "meta" jsonb DEFAULT '{}',
  "created_at" timestamptz DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "idx_devices_store" ON "devices" ("store_id");
CREATE INDEX IF NOT EXISTS "idx_devices_status" ON "devices" ("status", "last_seen" DESC);

CREATE TABLE IF NOT EXISTS "commands" (
  "command_id" varchar(96) PRIMARY KEY,
  "kind" varchar(48) NOT NULL,
  "scope" varchar(16) NOT NULL,
  "target_id" varchar(64) NOT NULL,
  "payload" jsonb,
  "targets" jsonb DEFAULT '{}',
  "ack_state" jsonb DEFAULT '{}',
  "status" varchar(16) DEFAULT 'dispatched' NOT NULL,
  "retries" integer DEFAULT 0 NOT NULL,
  "initiated_by" uuid REFERENCES "users"("id"),
  "created_at" timestamptz DEFAULT NOW(),
  "completed_at" timestamptz
);
CREATE INDEX IF NOT EXISTS "idx_commands_created" ON "commands" ("created_at" DESC);

CREATE TABLE IF NOT EXISTS "scenes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" varchar(64) NOT NULL,
  "description" text,
  "preset_id" uuid REFERENCES "rgb_presets"("id"),
  "content_playlist_id" uuid REFERENCES "playlists"("id"),
  "audio_playlist_id" uuid REFERENCES "audio_playlists"("id"),
  "audio_volume" double precision,
  "transition_ms" integer DEFAULT 3000,
  "org_id" uuid REFERENCES "orgs"("id"),
  "is_global" boolean DEFAULT true,
  "created_at" timestamptz DEFAULT NOW()
);

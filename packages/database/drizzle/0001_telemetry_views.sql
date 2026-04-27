-- Phase 6.5: pre-aggregated telemetry views for snappy dashboards.
-- These are materialized views refreshed by a nightly job; if they don't
-- exist yet, the API analytics router falls back to the raw
-- sensor_telemetry table, so this is purely a perf optimisation.

CREATE MATERIALIZED VIEW IF NOT EXISTS telemetry_hourly AS
SELECT
  store_id,
  metric,
  date_trunc('hour', recorded_at) AS bucket,
  COUNT(*) AS sample_count,
  AVG(value)::float AS avg_value,
  SUM(value)::float AS sum_value,
  MIN(value)::float AS min_value,
  MAX(value)::float AS max_value
FROM sensor_telemetry
GROUP BY store_id, metric, date_trunc('hour', recorded_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tel_hourly_pk
  ON telemetry_hourly (store_id, metric, bucket);

CREATE MATERIALIZED VIEW IF NOT EXISTS telemetry_daily AS
SELECT
  store_id,
  metric,
  date_trunc('day', recorded_at) AS day,
  COUNT(*) AS sample_count,
  AVG(value)::float AS avg_value,
  SUM(value)::float AS sum_value,
  MIN(value)::float AS min_value,
  MAX(value)::float AS max_value
FROM sensor_telemetry
GROUP BY store_id, metric, date_trunc('day', recorded_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tel_daily_pk
  ON telemetry_daily (store_id, metric, day);

-- Refresh helper. Call from a nightly cron / pg_cron job:
--   REFRESH MATERIALIZED VIEW CONCURRENTLY telemetry_hourly;
--   REFRESH MATERIALIZED VIEW CONCURRENTLY telemetry_daily;

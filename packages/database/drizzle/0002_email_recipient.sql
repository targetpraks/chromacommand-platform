-- Add optional email recipient column to alert_rules for SMTP alert delivery.
ALTER TABLE "alert_rules" ADD COLUMN "email_recipient" text;

-- Track email delivery status on alert events.
ALTER TABLE "alert_events" ADD COLUMN "email_delivered" boolean DEFAULT false;

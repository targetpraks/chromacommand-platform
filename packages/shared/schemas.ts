import { z } from "zod";

export const ZoneGroup = z.enum([
  "ambient", "decorative", "furniture", "floor", "service", "exterior", "all",
]);

export const ColourMode = z.enum([
  "solid", "gradient", "pulse", "chase", "breath", "sparkle", "wave", "rainbow",
]);

export const RgbColour = z.object({
  mode: ColourMode,
  primary: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  secondary: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  brightness: z.number().min(0).max(1).default(1.0),
  speed: z.number().min(0).max(5).default(1.0),
});

export const RgbSetCommand = z.object({
  scope: z.enum(["global", "region", "store", "zone"]),
  targetId: z.string(),
  zone: z.string().optional(),
  colour: RgbColour,
  schedule: z.object({
    startAt: z.string().datetime(),
    endAt: z.string().datetime().optional(),
    fadeDurationMs: z.number().min(0).max(10000).default(2000),
  }).optional(),
});

export const ContentAsset = z.object({
  assetId: z.string(),
  name: z.string(),
  type: z.enum(["html", "image", "video", "template"]),
  htmlContent: z.string().optional(),
  css: z.string().optional(),
  dimensions: z.object({ width: z.number(), height: z.number() }).optional(),
  durationSeconds: z.number().min(1).default(15),
  priority: z.number().default(100),
  tags: z.array(z.string()).default([]),
});

export const AudioZoneType = z.enum([
  "dining", "pickup", "exterior", "back-of-house",
]);

export const SyncTransformCommand = z.object({
  scope: z.enum(["global", "region", "store"]),
  targetId: z.string(),
  presetId: z.string(),
  effectiveAt: z.string().datetime(),
  fadeDurationMs: z.number().min(0).max(30000).default(3000),
  components: z.object({
    rgb: z.boolean().default(true),
    content: z.boolean().default(true),
    audio: z.boolean().default(true),
  }),
});

export type RgbColourType = z.infer<typeof RgbColour>;
export type RgbSetCommandType = z.infer<typeof RgbSetCommand>;
export type ContentAssetType = z.infer<typeof ContentAsset>;
export type SyncTransformCommandType = z.infer<typeof SyncTransformCommand>;

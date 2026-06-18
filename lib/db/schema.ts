import {
  pgTable,
  serial,
  text,
  varchar,
  timestamp,
  date,
  decimal,
  boolean,
  jsonb,
  unique,
  index,
} from "drizzle-orm/pg-core";

/**
 * Dashboard accounts. role "admin" = LSD Agency (full access — push budgets,
 * trigger refresh, settings). role "client" = Avis team (view-only).
 * Admin + client are seeded from env on first run.
 */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: varchar("name", { length: 120 }).notNull().default(""),
  role: varchar("role", { length: 16 }).notNull().default("client"), // admin | client
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Raw platform data — one row per campaign per day per platform. */
export const campaignSnapshots = pgTable(
  "campaign_snapshots",
  {
    id: serial("id").primaryKey(),
    snapshotDate: date("snapshot_date").notNull(),
    platform: text("platform").notNull(), // META | REDDIT | TIKTOK
    campaignId: text("campaign_id").notNull(),
    campaignName: text("campaign_name").notNull(),
    region: text("region").notNull(), // ISO 3166-1 alpha-2 — e.g. GB, FR, DE
    funnelStage: text("funnel_stage").notNull(), // PROSPECTING | RETARGETING
    spend: decimal("spend", { precision: 12, scale: 2 }).notNull().default("0"),
    revenue: decimal("revenue", { precision: 12, scale: 2 }).notNull().default("0"),
    roas: decimal("roas", { precision: 8, scale: 4 }).notNull().default("0"),
    currentBudget: decimal("current_budget", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    uniq: unique("campaign_snapshots_uniq").on(
      t.snapshotDate,
      t.platform,
      t.campaignId,
    ),
  }),
);

/** Calculated recommendations — one row per campaign per day per platform. */
export const budgetRecommendations = pgTable(
  "budget_recommendations",
  {
    id: serial("id").primaryKey(),
    recommendationDate: date("recommendation_date").notNull(),
    platform: text("platform").notNull(), // META | REDDIT | TIKTOK
    campaignId: text("campaign_id").notNull(),
    campaignName: text("campaign_name").notNull(),
    region: text("region").notNull(),
    funnelStage: text("funnel_stage").notNull(),
    spend: decimal("spend", { precision: 12, scale: 2 }).notNull().default("0"),
    revenue: decimal("revenue", { precision: 12, scale: 2 }).notNull().default("0"),
    roas: decimal("roas", { precision: 8, scale: 4 }).notNull(),
    currentBudget: decimal("current_budget", { precision: 12, scale: 2 }).notNull(),
    currentWeightPct: decimal("current_weight_pct", { precision: 6, scale: 4 }).notNull(),
    recommendedBudget: decimal("recommended_budget", {
      precision: 12,
      scale: 2,
    }).notNull(),
    recommendedWeightPct: decimal("recommended_weight_pct", {
      precision: 6,
      scale: 4,
    }).notNull(),
    budgetDelta: decimal("budget_delta", { precision: 12, scale: 2 }).notNull(),
    floorTriggered: boolean("floor_triggered").notNull().default(false),
    z1Boosted: boolean("z1_boosted").notNull().default(false),
    applied: boolean("applied").notNull().default(false),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
  },
  (t) => ({
    uniq: unique("budget_recommendations_uniq").on(
      t.recommendationDate,
      t.platform,
      t.campaignId,
    ),
  }),
);

/** TTL cache for platform API responses, keyed by platform + date. */
export const apiCache = pgTable("api_cache", {
  key: text("key").primaryKey(),
  data: jsonb("data").notNull(),
  cachedAt: timestamp("cached_at", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

/**
 * Encrypted key/value store for integration credentials + config entered via
 * Settings. `value` is an AES-256-GCM payload (never plaintext). One row per field.
 */
export const appSettings = pgTable("app_settings", {
  key: varchar("key", { length: 64 }).primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

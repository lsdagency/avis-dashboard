import { eq, sql } from "drizzle-orm";
import { db, dbAvailable, schema } from "./db";

/**
 * Lightweight app config stored as plaintext rows in app_settings. Distinct from
 * lib/credentials.ts (which encrypts API keys) — these keys are never in ALL_KEYS,
 * so the credential resolver never touches them. In-memory fallback when no DB.
 */

const mem = new Map<string, string>();

async function getRaw(key: string): Promise<string | undefined> {
  if (dbAvailable && db) {
    const rows = await db
      .select()
      .from(schema.appSettings)
      .where(eq(schema.appSettings.key, key))
      .limit(1);
    return rows[0]?.value;
  }
  return mem.get(key);
}

async function setRaw(key: string, value: string) {
  if (dbAvailable && db) {
    await db
      .insert(schema.appSettings)
      .values({ key, value })
      .onConflictDoUpdate({
        target: schema.appSettings.key,
        set: { value, updatedAt: sql`now()` },
      });
  } else {
    mem.set(key, value);
  }
}

const FLOOR_KEY = "prospecting_floor";
export const DEFAULT_PROSPECTING_FLOOR = 0.5; // 50%
const MAX_FLOOR = 0.9;

/** Prospecting minimum share of each platform's budget pool, as a 0–1 fraction. */
export async function getProspectingFloor(): Promise<number> {
  const stored = await getRaw(FLOOR_KEY);
  const fromEnv = process.env.PROSPECTING_FLOOR;
  let n =
    stored != null
      ? Number(stored)
      : fromEnv != null
        ? Number(fromEnv)
        : DEFAULT_PROSPECTING_FLOOR;
  if (!Number.isFinite(n)) n = DEFAULT_PROSPECTING_FLOOR;
  return Math.min(MAX_FLOOR, Math.max(0, n));
}

export async function setProspectingFloor(fraction: number): Promise<void> {
  const n = Math.min(MAX_FLOOR, Math.max(0, fraction));
  await setRaw(FLOOR_KEY, String(n));
}

const Z1_KEY = "z1_multiplier";
export const DEFAULT_Z1_MULTIPLIER = 1.25;
export const MIN_Z1_MULTIPLIER = 1.0; // 1.0 = no boost
export const MAX_Z1_MULTIPLIER = 2.0;

/** ROAS multiplier applied to Z1 priority regions (GB/FR/ES/DE/IT). 1.0 = off. */
export async function getZ1Multiplier(): Promise<number> {
  const stored = await getRaw(Z1_KEY);
  const fromEnv = process.env.Z1_MULTIPLIER;
  let n =
    stored != null
      ? Number(stored)
      : fromEnv != null
        ? Number(fromEnv)
        : DEFAULT_Z1_MULTIPLIER;
  if (!Number.isFinite(n)) n = DEFAULT_Z1_MULTIPLIER;
  return Math.min(MAX_Z1_MULTIPLIER, Math.max(MIN_Z1_MULTIPLIER, n));
}

export async function setZ1Multiplier(multiplier: number): Promise<void> {
  const n = Math.min(MAX_Z1_MULTIPLIER, Math.max(MIN_Z1_MULTIPLIER, multiplier));
  await setRaw(Z1_KEY, String(n));
}

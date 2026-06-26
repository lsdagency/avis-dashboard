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

// ── Monthly budget & pacing ──
const MONTHLY_BUDGET_KEY = "monthly_budget";
const PACING_STANCE_KEY = "pacing_stance"; // -50..+50 (percent vs even pace)
const MTD_OVERRIDE_KEY = "mtd_override"; // "YYYY-MM|amount"; blank = unset
export const MAX_PACING_STANCE = 50;

/** Total monthly budget for the account (all platforms). 0 = pacing disabled. */
export async function getMonthlyBudget(): Promise<number> {
  const stored = await getRaw(MONTHLY_BUDGET_KEY);
  const n =
    stored != null && stored !== ""
      ? Number(stored)
      : process.env.MONTHLY_BUDGET
        ? Number(process.env.MONTHLY_BUDGET)
        : 0;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export async function setMonthlyBudget(amount: number): Promise<void> {
  await setRaw(MONTHLY_BUDGET_KEY, String(Math.max(0, amount)));
}

/** Pacing stance: -50 (hold back) … 0 (even) … +50 (push spend now). */
export async function getPacingStance(): Promise<number> {
  const stored = await getRaw(PACING_STANCE_KEY);
  let n =
    stored != null && stored !== ""
      ? Number(stored)
      : process.env.PACING_STANCE != null
        ? Number(process.env.PACING_STANCE)
        : 0;
  if (!Number.isFinite(n)) n = 0;
  return Math.min(MAX_PACING_STANCE, Math.max(-MAX_PACING_STANCE, n));
}

export async function setPacingStance(pct: number): Promise<void> {
  const n = Math.min(MAX_PACING_STANCE, Math.max(-MAX_PACING_STANCE, pct));
  await setRaw(PACING_STANCE_KEY, String(Math.round(n)));
}

/** Manual month-to-date spend override for `month` (YYYY-MM). null = use tracked spend. */
export async function getMtdOverride(month: string): Promise<number | null> {
  const stored = await getRaw(MTD_OVERRIDE_KEY);
  if (!stored) return null;
  const [m, amt] = stored.split("|");
  if (m !== month) return null; // stale override from a previous month
  const n = Number(amt);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export async function setMtdOverride(
  month: string,
  amount: number | null,
): Promise<void> {
  if (amount == null || !(amount >= 0)) {
    await setRaw(MTD_OVERRIDE_KEY, "");
    return;
  }
  await setRaw(MTD_OVERRIDE_KEY, `${month}|${amount}`);
}

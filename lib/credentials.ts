import { eq, sql } from "drizzle-orm";
import { db, dbAvailable, schema } from "./db";
import { encrypt, decrypt } from "./crypto";

export interface CredField {
  key: string;
  label: string;
  secret: boolean;
  multiline?: boolean;
  placeholder?: string;
}
export interface CredGroup {
  provider: string;
  title: string;
  hint: string;
  docUrl: string;
  docLabel: string;
  fields: CredField[];
}

export const CREDENTIAL_GROUPS: CredGroup[] = [
  {
    provider: "meta",
    title: "Meta Ads",
    hint: "In Meta Business → System Users, generate a long-lived access token with ads_read + ads_management. The ad account ID starts with act_.",
    docUrl: "https://developers.facebook.com/docs/marketing-api/get-started",
    docLabel: "Meta Marketing API — getting started",
    fields: [
      { key: "META_ACCESS_TOKEN", label: "Access token", secret: true },
      { key: "META_AD_ACCOUNT_ID", label: "Ad account ID (act_…)", secret: false, placeholder: "act_000000000000" },
    ],
  },
  {
    provider: "reddit",
    title: "Reddit Ads",
    hint: "Create an app in Reddit Ads → Apps for the client ID/secret. A long-lived access token can be pasted directly, or it is refreshed via client credentials.",
    docUrl: "https://ads-api.reddit.com/docs/",
    docLabel: "Reddit Ads API docs",
    fields: [
      { key: "REDDIT_CLIENT_ID", label: "Client ID", secret: false },
      { key: "REDDIT_CLIENT_SECRET", label: "Client secret", secret: true },
      { key: "REDDIT_AD_ACCOUNT_ID", label: "Ad account ID", secret: false },
      { key: "REDDIT_ACCESS_TOKEN", label: "Access token (optional)", secret: true },
    ],
  },
  {
    provider: "tiktok",
    title: "TikTok Ads",
    hint: "In TikTok for Business → Developers, create an app for the app ID/secret and generate a long-lived access token. The advertiser ID is in Ads Manager.",
    docUrl: "https://business-api.tiktok.com/portal/docs",
    docLabel: "TikTok Business API docs",
    fields: [
      { key: "TIKTOK_APP_ID", label: "App ID", secret: false },
      { key: "TIKTOK_APP_SECRET", label: "App secret", secret: true },
      { key: "TIKTOK_ADVERTISER_ID", label: "Advertiser ID", secret: false },
      { key: "TIKTOK_ACCESS_TOKEN", label: "Access token", secret: true },
    ],
  },
];

// Fields that are optional and shouldn't block a "Connected" status.
export const OPTIONAL_KEYS = new Set(["REDDIT_ACCESS_TOKEN"]);

const ALL_FIELDS = CREDENTIAL_GROUPS.flatMap((g) => g.fields);
export const ALL_KEYS = ALL_FIELDS.map((f) => f.key);
const SECRET_KEYS = new Set(ALL_FIELDS.filter((f) => f.secret).map((f) => f.key));

// In-memory fallback (no database). Stores the encrypted payloads.
const mem = new Map<string, string>();

async function readEncrypted(): Promise<Map<string, string>> {
  if (dbAvailable && db) {
    const rows = await db.select().from(schema.appSettings);
    return new Map(rows.map((r) => [r.key, r.value]));
  }
  return new Map(mem);
}

export async function setCredential(key: string, value: string) {
  if (!ALL_KEYS.includes(key)) throw new Error("Unknown credential key");
  const enc = encrypt(value);
  if (dbAvailable && db) {
    await db
      .insert(schema.appSettings)
      .values({ key, value: enc })
      .onConflictDoUpdate({
        target: schema.appSettings.key,
        set: { value: enc, updatedAt: sql`now()` },
      });
  } else {
    mem.set(key, enc);
  }
  cache = null;
}

export async function deleteCredential(key: string) {
  if (dbAvailable && db) {
    await db.delete(schema.appSettings).where(eq(schema.appSettings.key, key));
  } else {
    mem.delete(key);
  }
  cache = null;
}

// ---- resolver: saved (decrypted) value wins over env var ----
let cache: { at: number; env: Record<string, string | undefined> } | null = null;
const TTL_MS = 15_000;

export async function resolveEnv(): Promise<Record<string, string | undefined>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.env;
  const stored = await readEncrypted();
  const env: Record<string, string | undefined> = {};
  for (const k of ALL_KEYS) {
    if (stored.has(k)) {
      try {
        env[k] = decrypt(stored.get(k)!);
      } catch {
        env[k] = process.env[k];
      }
    } else {
      env[k] = process.env[k];
    }
  }
  cache = { at: Date.now(), env };
  return env;
}

function mask(v: string) {
  if (v.length <= 6) return "••••";
  return `${v.slice(0, 3)}…${v.slice(-3)}`;
}

export interface CredStatus {
  key: string;
  configured: boolean;
  source: "saved" | "env" | "none";
  preview: string;
}

/** Masked status for the Settings UI — never returns full secrets. */
export async function credentialStatus(): Promise<CredStatus[]> {
  const stored = await readEncrypted();
  return ALL_KEYS.map((k) => {
    const inDb = stored.has(k);
    const envVal = process.env[k];
    let value: string | undefined;
    if (inDb) {
      try {
        value = decrypt(stored.get(k)!);
      } catch {
        value = undefined;
      }
    } else {
      value = envVal;
    }
    const configured = Boolean(value);
    const source: CredStatus["source"] = inDb ? "saved" : envVal ? "env" : "none";
    let preview = "";
    if (value) preview = SECRET_KEYS.has(k) ? mask(value) : value;
    return { key: k, configured, source, preview };
  });
}

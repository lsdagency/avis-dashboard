import bcrypt from "bcryptjs";
import { eq, asc } from "drizzle-orm";
import { db, dbAvailable, schema } from "./db";

export type Role = "admin" | "client";

export interface UserRecord {
  id: number;
  email: string;
  name: string;
  role: Role;
}

/**
 * Data access for dashboard users. Uses Neon when a connection string is
 * configured; otherwise an in-memory store so the dashboard is fully usable
 * locally with zero infrastructure (resets on restart).
 */

// ---------- in-memory fallback ----------
const mem = {
  users: [] as (UserRecord & { passwordHash: string })[],
  seq: 1,
};

function defaultUserSeeds() {
  const adminEmail = (process.env.ADMIN_EMAIL || "admin@avis.local").toLowerCase();
  const adminPass = process.env.ADMIN_PASSWORD || "avis-demo";
  const clientEmail = (process.env.CLIENT_EMAIL || "client@avis.local").toLowerCase();
  const clientPass = process.env.CLIENT_PASSWORD || "avis-demo";
  return [
    {
      email: adminEmail,
      name: "LSD Agency",
      role: "admin" as Role,
      passwordHash: bcrypt.hashSync(adminPass, 10),
    },
    {
      email: clientEmail,
      name: process.env.APP_NAME || "Avis Budget Group",
      role: "client" as Role,
      passwordHash: bcrypt.hashSync(clientPass, 10),
    },
  ];
}

let bootPromise: Promise<void> | null = null;
function ensureBootstrap() {
  if (!bootPromise) bootPromise = doBootstrap();
  return bootPromise;
}

async function doBootstrap() {
  if (dbAvailable && db) {
    const u = await db.select({ id: schema.users.id }).from(schema.users).limit(1);
    if (u.length === 0) await db.insert(schema.users).values(defaultUserSeeds());
    return;
  }
  if (mem.users.length === 0) {
    for (const s of defaultUserSeeds()) mem.users.push({ id: mem.seq++, ...s });
  }
}

// ---------- auth ----------
export async function verifyLogin(
  email: string,
  password: string,
): Promise<UserRecord | null> {
  await ensureBootstrap();
  const e = email.trim().toLowerCase();

  if (dbAvailable && db) {
    const rows = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, e))
      .limit(1);
    const row = rows[0];
    if (!row || !bcrypt.compareSync(password, row.passwordHash)) return null;
    return toUser(row);
  }

  const row = mem.users.find((u) => u.email === e);
  if (!row || !bcrypt.compareSync(password, row.passwordHash)) return null;
  return stripHash(row);
}

// ---------- users ----------
export async function listUsers(): Promise<UserRecord[]> {
  await ensureBootstrap();
  if (dbAvailable && db) {
    const rows = await db.select().from(schema.users).orderBy(asc(schema.users.id));
    return rows.map(toUser);
  }
  return mem.users.map(stripHash);
}

export async function createUser(input: {
  email: string;
  name: string;
  role: Role;
  password: string;
}): Promise<UserRecord> {
  await ensureBootstrap();
  const passwordHash = bcrypt.hashSync(input.password, 10);
  const email = input.email.trim().toLowerCase();

  if (dbAvailable && db) {
    const [row] = await db
      .insert(schema.users)
      .values({ email, name: input.name, role: input.role, passwordHash })
      .returning();
    return toUser(row);
  }
  if (mem.users.some((u) => u.email === email)) {
    throw new Error("A user with that email already exists.");
  }
  const rec = { id: mem.seq++, email, name: input.name, role: input.role, passwordHash };
  mem.users.push(rec);
  return stripHash(rec);
}

export async function deleteUser(id: number): Promise<void> {
  await ensureBootstrap();
  if (dbAvailable && db) {
    await db.delete(schema.users).where(eq(schema.users.id, id));
    return;
  }
  mem.users = mem.users.filter((u) => u.id !== id);
}

// ---------- helpers ----------
function toUser(row: typeof schema.users.$inferSelect): UserRecord {
  return { id: row.id, email: row.email, name: row.name, role: row.role as Role };
}
function stripHash(row: UserRecord & { passwordHash: string }): UserRecord {
  const { passwordHash, ...rest } = row;
  void passwordHash;
  return rest;
}

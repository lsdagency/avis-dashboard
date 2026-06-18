import type { Config } from "@netlify/functions";

/**
 * Scheduled function — fires daily at 09:00 UTC and calls the internal cron
 * route with the shared secret. Keeps the heavy lifting (platform pulls, Claude,
 * persistence) inside the Next.js app.
 */
export default async () => {
  const base = (
    process.env.APP_URL ||
    process.env.URL ||
    process.env.DEPLOY_PRIME_URL ||
    ""
  ).replace(/\/$/, "");

  if (!base) {
    return new Response("No site URL available", { status: 500 });
  }

  const res = await fetch(`${base}/api/cron/refresh`, {
    method: "POST",
    headers: { "x-cron-secret": process.env.CRON_SECRET || "" },
  });

  const body = await res.text();
  return new Response(body, { status: res.status });
};

export const config: Config = {
  schedule: "0 9 * * *", // 09:00 UTC daily
};

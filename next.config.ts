import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Platform payloads are fetched server-side; no remote images needed.
};

export default nextConfig;

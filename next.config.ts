import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Node-only queue libraries used by Server Actions (enqueue): load from node_modules instead of bundling
  // (BullMQ has optional drivers webpack can't resolve).
  serverExternalPackages: ["bullmq", "ioredis"],
};

export default nextConfig;

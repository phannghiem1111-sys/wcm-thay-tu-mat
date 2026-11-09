import type { NextConfig } from "next";
const config: NextConfig = {
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
};
export default config;

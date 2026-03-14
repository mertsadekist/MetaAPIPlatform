import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["pino", "pino-pretty", "@prisma/client", "prisma"],
};

export default nextConfig;

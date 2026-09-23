import type { NextConfig } from "next";

const isProductionBuild = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["descope-one.local"],
  ...(isProductionBuild ? { output: "export" } : {}),
};

export default nextConfig;

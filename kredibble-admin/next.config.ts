import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["192.168.56.1"],
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;

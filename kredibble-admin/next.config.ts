import path from "path";
import type { NextConfig } from "next";
import { ACTIVE_REDIRECTS } from "./src/config/redirects";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["192.168.56.1"],
  // The dev-tools badge sits bottom-left so it never covers page content, the sticky action bars or the toasts
  // (both live bottom-right). In development the sidebar keeps its bottom padding clear of it (see Sidebar.tsx).
  devIndicators: { position: "bottom-left" },
  async redirects() {
    return ACTIVE_REDIRECTS;
  },
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;

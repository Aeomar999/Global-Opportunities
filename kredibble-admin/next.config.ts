import path from "path";
import type { NextConfig } from "next";

// The dashboard calls the API on its own origin, so connect-src must name it or
// the browser blocks every request (login included). NEXT_PUBLIC_API_URL is
// inlined at build time, and so is this header; both come from the same value.
// Mirrors getApiUrl() in src/lib/api.ts, including its bare-hostname handling.
const apiOrigin = (() => {
  const raw = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
  try {
    return new URL(raw.startsWith("http") ? raw : `https://${raw}`).origin;
  } catch {
    return null;
  }
})();

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  ["connect-src 'self'", apiOrigin].filter(Boolean).join(" "),
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["192.168.56.1"],
  turbopack: {
    root: path.resolve(__dirname),
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: csp,
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

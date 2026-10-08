import path from "path";
import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";
import { ACTIVE_REDIRECTS } from "./src/config/redirects";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

// The dashboard calls the API on its own origin, so connect-src must name it or
// the browser blocks every request (login included). NEXT_PUBLIC_API_URL is
// inlined at build time, and so is this header; both come from the same value.
// Mirrors getApiUrl() in src/lib/api.ts, including its bare-hostname handling.
// A relative URL (the proxy below) is same-origin and needs nothing beyond 'self'.
const apiOrigin = (() => {
  if (apiUrl.startsWith("/")) return null;
  try {
    return new URL(apiUrl.startsWith("http") ? apiUrl : `https://${apiUrl}`).origin;
  } catch {
    return null;
  }
})();

const wsOrigin = apiOrigin ? apiOrigin.replace(/^http/, "ws") : null;

// Same-origin API proxy. The admin session cookie is SameSite=Strict, so the
// browser only sends it to the dashboard's own site. When the dashboard and API
// are on different sites (e.g. *.vercel.app and *.onrender.com), set
// NEXT_PUBLIC_API_URL=/api and API_PROXY_TARGET=https://<api-host>/api: the
// dashboard then calls itself and the platform forwards to the API, keeping the
// cookie first-party. The API must still list the dashboard origin in CORS_ORIGIN.
const apiProxyTarget = process.env.API_PROXY_TARGET?.replace(/\/$/, "");

const isProduction = process.env.NODE_ENV === "production";

const csp = [
  "default-src 'self'",
  isProduction
    ? "script-src 'self' 'unsafe-inline'"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  ["connect-src 'self'", apiOrigin, wsOrigin].filter(Boolean).join(" "),
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

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
  async rewrites() {
    return apiProxyTarget
      ? [{ source: "/api/:path*", destination: `${apiProxyTarget}/:path*` }]
      : [];
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

export default withSentryConfig(nextConfig, {
  // Routes Sentry events through Next.js server rewrite to keep CSP connect-src 'self' intact
  tunnelRoute: "/monitoring-tunnel",
  silent: !process.env.CI,
});

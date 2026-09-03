import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Emits .next/standalone: a self-contained server with only the packages it
     actually imports. The runtime image is then Node plus that folder, which
     keeps the container small and means node_modules is never shipped whole. */
  output: "standalone",

  /* App Runner terminates TLS at the load balancer and forwards over HTTP, so
     the app must trust the proxy headers to know the real scheme and host. */
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          /* No customer data is ever legitimately framed by another site, and
             a queue token in an iframe is a phishing surface. */
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
      {
        /* Application data must never be cached by a proxy or a shared device
           in a lobby. The shell may be; the answers may not. */
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }],
      },
    ];
  },
};

export default nextConfig;

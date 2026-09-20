/** @type {import('next').NextConfig} */ // Tells your IDE to provide autocomplete for Next.js configs
const nextConfig = {
  // 1. The Reverse Proxy (Solves CORS and Cross-Origin Cookie issues)
  async rewrites() {
    return [
      {
        // Intercept any request to /api/* on port 3000
        source: "/api/:path*",
        // Silently forward it to the backend (uses env var in prod, defaults to localhost)
        destination: `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/:path*`,
      },
    ];
  },

  // 2. Strict Security Headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data: https://lh3.googleusercontent.com https://*.r2.dev; connect-src 'self' http://localhost:3001 ${process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL : ""} https://*.cloudflarestorage.com;`,
          },
          {
            // Prevents "MIME-sniffing".
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            // Clickjacking Defense. This tells the browser: "Do not let ANY other website embed my app inside an <iframe>."
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            // A legacy security header for older browsers (like Internet Explorer). It tells the browser to block the page from loading if it detects a reflected XSS attack. Modern browsers use CSP instead, but this is a good safety net.
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

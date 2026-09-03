import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/**
 * Derive the API origin from NEXT_PUBLIC_API_URL so the CSP `connect-src`
 * directive permits the streaming fetch in Crisis/Coach mode. Falls back to
 * the local dev backend. If the value is malformed we omit it rather than
 * crash the build.
 */
function getApiOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
  try {
    return new URL(raw).origin;
  } catch {
    return '';
  }
}

const apiOrigin = getApiOrigin();

/**
 * Content-Security-Policy.
 *
 * - `script-src` includes 'unsafe-inline' because Next.js App Router injects
 *   inline bootstrap/runtime scripts (and 'unsafe-eval' is needed by the
 *   dev/turbopack runtime). A nonce-based policy would require middleware and
 *   is intentionally out of scope here.
 * - `style-src` includes 'unsafe-inline' for Tailwind/Next inline styles and
 *   the inline CSS custom properties used for theming and per-language fonts.
 * - `connect-src` includes the API origin so the SSE coach stream can connect,
 *   plus ws:/wss: for the dev HMR socket.
 * - `img-src` allows self, data: (inline SVG/icons) and blob: (generated media).
 * - `font-src` allows self and data: for embedded/next-font assets.
 */
function buildContentSecurityPolicy(): string {
  const connectSrc = ["'self'", apiOrigin, 'ws:', 'wss:'].filter(Boolean).join(' ');

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src ${connectSrc}`,
    "manifest-src 'self'",
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    'upgrade-insecure-requests',
  ];

  return directives.join('; ');
}

const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: buildContentSecurityPolicy(),
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'Permissions-Policy',
    // Crisis Mode uses the microphone (voice input) so it is allowed for self.
    // Everything else is disabled by default.
    value: [
      'accelerometer=()',
      'autoplay=()',
      'camera=()',
      'display-capture=()',
      'encrypted-media=()',
      'fullscreen=(self)',
      'geolocation=()',
      'gyroscope=()',
      'magnetometer=()',
      'microphone=(self)',
      'midi=()',
      'payment=()',
      'usb=()',
    ].join(', '),
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // 'standalone' bundles a self-contained server.js — frontend/Dockerfile
  // copies .next/standalone directly (see its runner stage) for the
  // self-hosted Docker deployment. Vercel needs the *opposite*: its own build
  // pipeline post-processes the default output (traces
  // .next/next-server.js.nft.json for its serverless function bundling), and
  // 'standalone' skips producing that file, which breaks the build with
  // `ENOENT … next-server.js.nft.json` after `next build` itself has already
  // succeeded. Vercel sets VERCEL=1 during build, so this is off there and on
  // everywhere else (Docker, local `npm run build`).
  output: process.env.VERCEL ? undefined : 'standalone',
  images: {
    // Next's default for the image optimizer route is
    // `Content-Disposition: attachment`, which some Chromium builds treat as
    // a download signal for the *entire* response -- including when the
    // resource is requested by an <img>/<Image> element rather than a
    // top-level navigation. The practical effect: optimized images (e.g. the
    // header logo, which is `priority`-loaded through next/image) never fire
    // `load` or `error` and simply never render, with no console error to
    // point at. Serving them inline fixes rendering without weakening the
    // CSP already applied to the route (see securityHeaders above).
    contentDispositionType: 'inline',
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default withNextIntl(nextConfig);

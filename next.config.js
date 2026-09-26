const isCapacitorStaticExport = process.env.MAWQIFI_CAPACITOR_BUILD === '1';

const withPWA = require('next-pwa')({
  dest: 'public',
  // App Router does not reliably run next-pwa's legacy main.js registrar.
  // Register the one root worker from ServiceWorkerRegistrar instead.
  register: false,
  scope: '/',
  skipWaiting: true,
  clientsClaim: true,
  // Next.js keeps this manifest server-side, so precaching its public URL
  // makes Workbox installation fail with a 404 on Vercel.
  buildExcludes: [/app-build-manifest\.json$/],
  // Keep the push event handlers at a stable URL. A build-hashed custom
  // worker can be missing while an installed iOS PWA is upgrading.
  importScripts: ['/push-worker.js'],
  // The iOS archive uses a local static bundle and must not carry a Workbox
  // app shell. Browser/PWA production builds retain the existing worker.
  disable: process.env.NODE_ENV === 'development' || isCapacitorStaticExport,
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'supabase-api',
        expiration: { maxEntries: 32, maxAgeSeconds: 24 * 60 * 60 },
      },
    },
    {
      urlPattern: /\/_next\/static\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'next-static',
        expiration: { maxEntries: 64, maxAgeSeconds: 30 * 24 * 60 * 60 },
      },
    },
    {
      urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-images',
        expiration: { maxEntries: 64, maxAgeSeconds: 7 * 24 * 60 * 60 },
      },
    },
  ],
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  ...(isCapacitorStaticExport
    ? {
        output: 'export',
        trailingSlash: true,
      }
    : {}),
  images: {
    // The native archive has no Next.js image optimizer. Supabase Storage URLs
    // remain remote while the UI bundle itself is copied locally by Capacitor.
    unoptimized: isCapacitorStaticExport,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  ...(isCapacitorStaticExport
    ? {}
    : {
        // Keep existing browser/PWA deep links working after moving the live
        // post screen to one static route for the native export. The native
        // build must not declare redirect rules because it has no server.
        async redirects() {
          return [
            {
              source: '/post/:id([0-9a-fA-F-]{36})',
              destination: '/post/view?id=:id',
              permanent: false,
            },
          ];
        },
      }),
}

module.exports = withPWA(nextConfig)

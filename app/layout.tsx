import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { Cairo } from 'next/font/google'
import AuthProvider from '@/components/AuthProvider'
import PwaInstallPrompt from '@/components/PwaInstallPrompt'
import PwaSplash from '@/components/PwaSplash'
import './globals.css'

const cairo = Cairo({ 
  subsets: ['arabic'],
  weight: ['400', '600', '700'],
  variable: '--font-cairo',
})

export const metadata: Metadata = {
  title: 'موقفي - Mawqifi',
  description: 'تطبيق مجتمعي لمشاركة المواقف المتاحة في جامعة الكويت — الشدادية',
  applicationName: 'موقفي',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'موقفي',
    statusBarStyle: 'black-translucent',
    startupImage: [
      {
        url: '/splash-iphone.png',
        media:
          '(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
      },
      {
        url: '/splash-iphone.png',
        media:
          '(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
      },
      {
        url: '/splash-android.png',
        media: '(orientation: portrait)',
      },
    ],
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-title': 'موقفي',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0a1128' },
    { color: '#0a1128' },
  ],
}

export default function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="icon" href="/icon-192.png" sizes="192x192" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />
        <meta name="theme-color" content="#0a1128" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="موقفي" />
        <meta name="format-detection" content="telephone=no" />
      </head>
      <body className={`${cairo.variable} flex min-h-screen flex-col font-sans antialiased text-white`}>
        <PwaSplash />
        <AuthProvider>
          <div className="flex min-h-screen flex-1 flex-col">{children}</div>
        </AuthProvider>
        <PwaInstallPrompt />
      </body>
    </html>
  )
}

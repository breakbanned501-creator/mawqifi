import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { Cairo } from 'next/font/google'
import AuthProvider from '@/components/AuthProvider'
import './globals.css'

const cairo = Cairo({ 
  subsets: ['arabic'],
  weight: ['400', '600', '700'],
  variable: '--font-cairo',
})

export const metadata: Metadata = {
  title: 'موقفي - Mawqifi',
  description: 'تطبيق لمشاركة مواقف السيارات المتاحة',
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#0a1128',
}

export default function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="icon" href="/icon.svg" />
        <link rel="apple-touch-icon" href="/icon.svg" />
        <meta name="theme-color" content="#0a1128" />
      </head>
      <body className={`${cairo.variable} flex min-h-screen flex-col font-sans antialiased text-white`}>
        <AuthProvider>
          <div className="flex min-h-screen flex-1 flex-col">{children}</div>
        </AuthProvider>
      </body>
    </html>
  )
}

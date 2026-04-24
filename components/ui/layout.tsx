import type { Metadata, Viewport } from 'next'
import { Instrument_Sans, IBM_Plex_Mono } from "next/font/google"
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const _instrumentSans = Instrument_Sans({ variable: "--font-instrument-sans", subsets: ["latin"], weight: ["400", "500", "600"] })
const _ibmPlexMono = IBM_Plex_Mono({ variable: "--font-ibm-plex-mono", subsets: ["latin"], weight: ["400", "500"] })

export const metadata: Metadata = {
  title: 'drank - rank your drinks',
  description: 'Snap, rank, and share your drink reviews as receipt cards for Instagram Stories.',
  generator: 'v0.app',
  icons: {
    icon: '/favicon.png',
    apple: '/favicon.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#1a1408',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning className={`${_instrumentSans.variable} ${_ibmPlexMono.variable} font-sans antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
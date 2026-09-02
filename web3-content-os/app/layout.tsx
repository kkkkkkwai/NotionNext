import type { Metadata, Viewport } from 'next'
import './globals.css'
import { ToastProvider } from '@/components/ui/toast'

export const metadata: Metadata = {
  title: { default: 'Web3 Brand & Content OS', template: '%s · Web3 Brand & Content OS' },
  description: 'One Project. One AI Brain. Unlimited Content.'
}

export const viewport: Viewport = { themeColor: '#080A09', width: 'device-width', initialScale: 1 }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-full">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  )
}

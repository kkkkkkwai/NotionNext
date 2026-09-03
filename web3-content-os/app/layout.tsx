import type { Metadata, Viewport } from 'next'
import './globals.css'
import { ToastProvider } from '@/components/ui/toast'

export const metadata: Metadata = {
  title: { default: 'Web3 项目智能内容中台', template: '%s · Web3 项目智能内容中台' },
  description: '一个项目，一个持续记忆的 AI 大脑，无限内容。'
}

export const viewport: Viewport = { themeColor: '#080A09', width: 'device-width', initialScale: 1 }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="dark">
      <body className="min-h-full">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  )
}

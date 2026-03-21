import './globals.css'

import { zhCN } from '@clerk/localizations'
import { ClerkProvider } from '@clerk/nextjs'
import { SpeedInsights } from '@vercel/speed-insights/next'
import type { Metadata } from 'next'
import { Noto_Sans_SC } from 'next/font/google'

import { Toaster } from '@/components/ui/sonner'
import { TRPCProvider } from '@/trpc/client'

export const metadata: Metadata = {
  title: 'Reson Cast',
  description: '现代化视频分享平台，支持视频上传、AI 生成内容、用户订阅和互动等功能',
}

const notoSansSC = Noto_Sans_SC({
  weight: ['400', '700'],
  display: 'swap',
  preload: false,
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProvider localization={zhCN}>
      <html lang="zh-CN">
        <body className={notoSansSC.className}>
          <TRPCProvider>
            <Toaster />
            {children}
            <SpeedInsights />
          </TRPCProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}

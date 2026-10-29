import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AI Development Canvas',
  description: 'A local workspace for product design and workflow planning.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}

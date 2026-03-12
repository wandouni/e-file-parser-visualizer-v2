import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '电网E文件解析与可视化管理工具',
  description: '电网E文件解析、多表关联、可视化图表分析工具',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}

import type { Metadata } from 'next';
import './globals.css';
import { AppLayout } from '@/components/layout/app-layout';

export const metadata: Metadata = {
  title: {
    default: '访客管理系统',
    template: '%s | 访客管理系统',
  },
  description: '企业访客管理系统，支持访客预约、签到签退、访客证打印等功能',
  keywords: [
    '访客管理',
    '访客预约',
    '访客系统',
    '企业安全',
    '门卫管理',
  ],
  authors: [{ name: 'Coze Code Team' }],
  generator: 'Coze Code',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        {/* 强制360、搜狗、QQ等双核浏览器使用极速模式（webkit内核） */}
        <meta name="renderer" content="webkit" />
        {/* 强制IE使用最高版本渲染模式 */}
        <meta httpEquiv="X-UA-Compatible" content="IE=edge,chrome=1" />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        <AppLayout>{children}</AppLayout>
      </body>
    </html>
  );
}

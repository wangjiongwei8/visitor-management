import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  output: 'standalone', // Docker 部署必需
  outputFileTracingRoot: path.join(__dirname), // 防止多 lockfile 导致路径错误
  // Docker 部署必需：standalone 模式不会自动追踪 node_modules 中的服务端依赖
  outputFileTracingIncludes: {
    '/api/**/*': [
      'node_modules/drizzle-orm/**/*',
      'node_modules/drizzle-orm',
      'node_modules/pg/**/*',
      'node_modules/pg',
      'node_modules/bcryptjs/**/*',
      'node_modules/bcryptjs',
      'node_modules/postgres/**/*',
      'node_modules/postgres',
    ],
  },
  allowedDevOrigins: ['*.dev.coze.site'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lf3-static.bytednsdoc.com',
        pathname: '/**',
      },
    ],
  },
  // 生产环境去除 console
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
  // 实验性功能：优化包加载和 CSS
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-icons',
      'recharts',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-select',
      '@radix-ui/react-tooltip',
      '@radix-ui/react-avatar',
      '@radix-ui/react-badge',
    ],
  },

  // ==================== 安全响应头 ====================
  async headers() {
    const isDev = process.env.NODE_ENV === 'development';
    
    return [
      {
        source: '/(.*)',
        headers: [
          // 防止 MIME 类型嗅探
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // 防止点击劫持（禁止 iframe 嵌入）
          { key: 'X-Frame-Options', value: 'DENY' },
          // XSS 保护（启用浏览器内联脚本过滤）
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          // 限制引用来源策略
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // 权限策略（禁用不必要功能）
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          // 内容安全策略（开发环境放宽，生产环境兼容360等国产浏览器）
          ...(isDev ? [] : [{
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' 'unsafe-eval' https://fonts.googleapis.com data:",
              "font-src 'self' https://fonts.gstatic.com data:",
              "img-src 'self' data: blob: https://lf3-static.bytednsdoc.com",
              "connect-src 'self'",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          }]),
        ],
      },
    ];
  },
};

export default nextConfig;

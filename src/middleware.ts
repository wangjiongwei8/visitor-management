import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Token 过期时间（与 auth.ts 一致）
const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000;

// ==================== 全局速率限制 ====================
const globalRateLimit = new Map<string, { count: number; resetAt: number }>();
const GLOBAL_RATE_LIMIT = 300; // 每IP每分钟最多300次请求（放宽，页面刷新会同时请求多个API）
const GLOBAL_WINDOW_MS = 60 * 1000;

function checkGlobalRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = globalRateLimit.get(ip);
  if (!record || now > record.resetAt) {
    globalRateLimit.set(ip, { count: 1, resetAt: now + GLOBAL_WINDOW_MS });
    return true;
  }
  if (record.count >= GLOBAL_RATE_LIMIT) return false;
  record.count++;
  return true;
}

// 解析 token（基础版本，不含签名验证，兼容 Edge Runtime）
// 注意：完整的 HMAC 签名验证在 API 层（parseToken）执行
function parseToken(token: string): { userId: number; username: string; role: string; mustChangePassword: boolean } | null {
  try {
    const lastDotIndex = token.lastIndexOf('.');
    if (lastDotIndex === -1) return null;

    const base64Payload = token.substring(0, lastDotIndex);

    const data = JSON.parse(Buffer.from(base64Payload, 'base64').toString('utf-8'));
    if (Date.now() - data.timestamp > TOKEN_EXPIRY_MS) return null;

    return {
      userId: data.userId,
      username: data.username,
      role: data.role,
      mustChangePassword: data.mustChangePassword || false,
    };
  } catch (error) {
    return null;
  }
}

// 检查页面访问权限
function hasPagePermission(role: string, pagePath: string): boolean {
  // 管理员可以访问所有页面
  if (role === 'admin') return true;

  const rolePermissions = {
    employee: ['/', '/appointment', '/appointment/edit', '/my-appointments', '/admin/long-term-vehicles', '/login'],
    visitor: ['/', '/appointment', '/scan', '/login'],
    security: ['/', '/security', '/security/check-in', '/security/check-out', '/security/long-term-vehicles', '/login'],
  };

  const allowedPages = rolePermissions[role as keyof typeof rolePermissions] || [];
  // 支持前缀匹配（如 /appointment/edit/123 匹配 /appointment/edit）
  return allowedPages.some(allowed => pagePath === allowed || pagePath.startsWith(allowed + '/'));
}

// 需要登录才能访问的页面
const protectedPaths = [
  '/',
  '/appointment',
  '/my-appointments',
  '/scan',
  '/management',
  '/management/visitor-query',
  '/security',
  '/security/check-in',
  '/security/check-out',
  '/security/long-term-vehicles',
  '/admin',
  '/admin/users',
  '/admin/visitors',
  '/admin/appointments',
  '/admin/long-term-vehicles',
  '/admin/logs',
  '/admin/security',
  '/admin/settings',
  '/admin/qrcode',
];

// 不需要登录就能访问的页面
const publicPaths = [
  '/login',
  '/change-password', // 修改密码页面（必须修改密码的用户可访问）
  '/api/auth/login',
  '/api/auth/me',
  '/api/auth/change-password', // 修改密码 API
  '/api/auth/password-policy', // 密码策略 API
  '/api/scan-appointment', // 访客扫码预约API
  '/api/settings/public', // 公开设置API（审核开关）
  '/api/visitor-board', // 访客看板API
  '/api/health', // 健康检查 API（供 Docker/Nginx 使用）
  '/visitor-board', // 访客看板页面
  '/public', // 公开预约页面
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 排除静态资源（不计入速率限制）
  const isStaticAsset = 
    pathname.startsWith('/_next/static') ||
    pathname.startsWith('/_next/image') ||
    pathname.includes('/favicon') ||
    pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/);
  
  if (isStaticAsset) {
    return NextResponse.next();
  }

  // 全局 IP 速率限制（防止暴力攻击）
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
  if (!checkGlobalRateLimit(clientIp)) {
    return NextResponse.json({ error: '请求过于频繁，请稍后再试' }, { status: 429 });
  }

  // 公开的API路径（无需登录）
  const publicApiPaths = [
    '/api/auth/login',
    '/api/auth/me',
    '/api/auth/password-policy',
    '/api/scan-appointment', // 访客扫码预约API（自带速率限制）
    '/api/settings/public', // 公开设置API（审核开关）
    '/api/visitor-board', // 访客看板API（自带速率限制+脱敏）
    '/api/health', // 健康检查API（供 Docker/Nginx 使用）
  ];

  // 检查是否是 API 路由（除了公开的API）
  const isPublicApi = publicApiPaths.some(path => pathname === path || pathname.startsWith(path + '/'));
  
  if (pathname.startsWith('/api') && !isPublicApi) {
    const token = request.cookies.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const userData = parseToken(token);
    if (!userData) {
      return NextResponse.json({ error: '登录已过期' }, { status: 401 });
    }

    // API 权限检查可以在这里添加
    // 目前简化处理，只检查是否登录
    return NextResponse.next();
  }

  // 检查是否是静态资源
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.includes('.') // 图片、CSS、JS 等静态文件
  ) {
    return NextResponse.next();
  }

  // 检查是否是公开页面
  if (publicPaths.some(path => pathname.startsWith(path))) {
    // 如果已登录且访问登录页，重定向到首页
    const token = request.cookies.get('auth-token')?.value;
    if (pathname === '/login' && token) {
      const userData = parseToken(token);
      if (userData) {
        // 根据角色重定向到不同页面
        const redirectPath = userData.role === 'admin'
          ? '/management'
          : userData.role === 'security'
          ? '/security'
          : '/';
        return NextResponse.redirect(new URL(redirectPath, request.url));
      }
    }
    return NextResponse.next();
  }

  // API 登录和初始化接口直接放行
  if (pathname.startsWith('/api/auth/login') || pathname.startsWith('/api/init-users')) {
    return NextResponse.next();
  }

  // 检查是否需要登录
  if (protectedPaths.some(path => pathname === path || pathname.startsWith(path + '/'))) {
    const token = request.cookies.get('auth-token')?.value;

    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    const userData = parseToken(token);
    if (!userData) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // 如果用户必须修改密码，强制重定向到修改密码页面
    if (userData.mustChangePassword && pathname !== '/change-password') {
      return NextResponse.redirect(new URL('/change-password?force=true', request.url));
    }

    // 检查页面访问权限
    if (!hasPagePermission(userData.role, pathname)) {
      // 没有权限，重定向到首页
      return NextResponse.redirect(new URL('/', request.url));
    }

    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * 匹配所有路径除了：
     * - _next/static (静态文件)
     * - _next/image (图片优化文件)
     * - favicon.ico (网站图标)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};

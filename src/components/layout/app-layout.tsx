'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Calendar,
  Users,
  Shield,
  Building2,
  LogOut,
  FileText,
  Car,
  History,
  UserCog,
  LayoutDashboard,
  ChevronLeft,
  ChevronRight,
  Menu,
  Search,
  ClipboardList,
  LogIn,
  LogOut as LogOutIcon,
  Clock,
  CheckCircle,
  Ban,
  KeyRound,
  QrCode,
  BarChart3,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useIsMobile } from '@/hooks/use-mobile';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { APP_VERSION } from '@/lib/version';

interface UserInfo {
  id: number;
  username: string;
  name: string;
  role: string;
}

const ROLE_LABELS: Record<string, string> = {
  admin: '管理员',
  security: '门卫',
  employee: '员工',
  visitor: '访客',
};

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-purple-500',
  security: 'bg-emerald-500',
  employee: 'bg-blue-500',
  visitor: 'bg-orange-500',
};

const ROLE_BADGE_COLORS: Record<string, string> = {
  admin: 'text-purple-700 bg-purple-50 dark:text-purple-300 dark:bg-purple-950/50',
  security: 'text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/50',
  employee: 'text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-950/50',
  visitor: 'text-orange-700 bg-orange-50 dark:text-orange-300 dark:bg-orange-950/50',
};

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  roles?: string[];
  excludeRoles?: string[];
  badge?: string;
}

const navItems: NavItem[] = [
  {
    title: '首页概览',
    href: '/',
    icon: LayoutDashboard,
  },
  // ========== 访客预约（全员可访问） ==========
  {
    title: '访客预约',
    href: '/appointment',
    icon: Calendar,
    roles: ['employee', 'visitor', 'admin'],
  },
  // ========== 我的预约（管理员、员工） ==========
  {
    title: '我的预约',
    href: '/my-appointments',
    icon: ClipboardList,
    roles: ['employee', 'admin'],
  },
  // ========== 门卫功能 ==========
  {
    title: '预约查询',
    href: '/security/appointments',
    icon: ClipboardList,
    roles: ['security'],
  },
  {
    title: '访客签到',
    href: '/security/check-in',
    icon: LogIn,
    roles: ['security'],
  },
  {
    title: '访客签退',
    href: '/security/check-out',
    icon: LogOutIcon,
    roles: ['security'],
  },
  // ========== 管理员功能 ==========
  {
    title: '访客查询',
    href: '/management/visitor-query',
    icon: Search,
    roles: ['admin'],
  },
  {
    title: '访客签到',
    href: '/security/check-in',
    icon: LogIn,
    roles: ['admin'],
  },
  {
    title: '访客签退',
    href: '/security/check-out',
    icon: LogOutIcon,
    roles: ['admin'],
  },
  {
    title: '用户管理',
    href: '/admin/users',
    icon: UserCog,
    roles: ['admin'],
  },
  {
    title: '密码策略',
    href: '/admin/password-policy',
    icon: KeyRound,
    roles: ['admin'],
  },
  {
    title: '黑名单管理',
    href: '/admin/blacklist',
    icon: Ban,
    roles: ['admin'],
  },
  {
    title: '长约管理',
    href: '/admin/long-term-vehicles',
    icon: Shield,
    roles: ['employee', 'admin'],
  },
  {
    title: '受访人清单',
    href: '/admin/host-contacts',
    icon: Users,
    roles: ['admin'],
  },
  {
    title: '预约二维码',
    href: '/admin/qrcode',
    icon: QrCode,
    roles: ['admin'],
  },
];

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [user, setUser] = React.useState<UserInfo | null>(null);
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = React.useState(false);
  const [passwordForm, setPasswordForm] = React.useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [changingPassword, setChangingPassword] = React.useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const isMobile = useIsMobile();

  // 公开页面：不需要登录，不显示侧边栏布局
  const isPublicPage = pathname.startsWith('/public/') ||
    pathname.startsWith('/scan-appointment') ||
    pathname.startsWith('/visitor-board') ||
    pathname === '/login' ||
    pathname === '/change-password';

  React.useEffect(() => {
    setMounted(true);
    if (!isPublicPage) {
      fetchUserInfo();
    }
  }, [isPublicPage]);

  const fetchUserInfo = async () => {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const data = await response.json();
        setUser(data);
        if (data.role === 'admin') {
          setCollapsed(false);
        }
      } else {
        // 硬跳转确保一定会跳到登录页
        window.location.href = '/login';
      }
    } catch (error) {
      console.error('Failed to fetch user info:', error);
      window.location.href = '/login';
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleChangePassword = async () => {
    if (!passwordForm.oldPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      toast.error('请填写完整信息');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('两次输入的新密码不一致');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      toast.error('新密码长度不能少于6位');
      return;
    }

    setChangingPassword(true);
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oldPassword: passwordForm.oldPassword,
          newPassword: passwordForm.newPassword,
        }),
      });

      if (response.ok) {
        toast.success('密码修改成功');
        setPasswordDialogOpen(false);
        setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        const error = await response.json();
        toast.error(error.error || '修改密码失败');
      }
    } catch (error) {
      toast.error('修改密码失败');
    } finally {
      setChangingPassword(false);
    }
  };

  const filteredNavItems = React.useMemo(() => {
    if (!user) return [];
    return navItems.filter((item) => {
      if (item.roles && !item.roles.includes(user.role)) return false;
      if (item.excludeRoles && item.excludeRoles.includes(user.role)) return false;
      return true;
    });
  }, [user]);

  // 公开页面直接渲染，不显示侧边栏布局
  if (isPublicPage) {
    return (
      <>
        {children}
        <Toaster />
      </>
    );
  }

  // 用户信息未加载时显示骨架屏
  if (!mounted || !user) {
    return (
      <div className="flex h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-900">
        {/* Sidebar 骨架 */}
        <aside className="hidden md:flex flex-col border-r border-slate-200/80 dark:border-slate-800 w-64 bg-white dark:bg-slate-950 shrink-0">
          <div className="flex h-16 items-center gap-3 px-4 border-b border-slate-100 dark:border-slate-800">
            <div className="h-9 w-9 rounded-xl skeleton" />
            <div className="flex flex-col gap-1.5">
              <div className="h-4 w-24 rounded skeleton" />
              <div className="h-3 w-16 rounded skeleton" />
            </div>
          </div>
          <nav className="flex-1 py-4 px-2 space-y-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl">
                <div className="h-5 w-5 rounded skeleton" />
                <div className="h-4 rounded skeleton" style={{ width: `${60 + i * 8}px` }} />
              </div>
            ))}
          </nav>
        </aside>

        {/* Main 骨架 */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <header className="flex h-16 items-center justify-between border-b border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-950 px-6">
            <div className="h-9 w-64 rounded-xl skeleton hidden md:block" />
            <div className="h-9 w-9 rounded-full skeleton ml-auto" />
          </header>
          <main className="flex-1 overflow-auto p-6">
            <div className="space-y-6 animate-pulse">
              <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded-lg w-1/3" />
              <div className="grid gap-4 md:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-28 bg-slate-200 dark:bg-slate-800 rounded-xl" />
                ))}
              </div>
              <div className="h-48 bg-slate-200 dark:bg-slate-800 rounded-xl" />
            </div>
          </main>
        </div>
        <Toaster />
      </div>
    );
  }

  const isAdmin = user.role === 'admin';
  const showCollapsed = isAdmin ? false : collapsed;

  const SidebarContent = () => (
    <div className="flex h-full flex-col bg-white dark:bg-slate-950">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-4 border-b border-slate-100 dark:border-slate-800/80">
        <div
          className={cn(
            'flex items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-sm shadow-blue-500/30 transition-all duration-300',
            showCollapsed ? 'h-9 w-9' : 'h-9 w-9 shrink-0'
          )}
        >
          <Building2 className="h-5 w-5 text-white" />
        </div>
        {!showCollapsed && (
          <div className="flex flex-col overflow-hidden">
            <span className="text-[15px] font-bold text-slate-900 dark:text-slate-50 truncate leading-tight">
              访客管理
            </span>
            <span className="text-[11px] text-slate-400 dark:text-slate-500 tracking-wider">
              Visitor System · v{APP_VERSION}
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        <ul className="space-y-0.5">
          {filteredNavItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/' && pathname.startsWith(item.href + '/'));
            return (
              <li key={item.href}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      href={item.href}
                      onClick={() => isMobile && setMobileOpen(false)}
                      className={cn(
                        'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150',
                        isActive
                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200',
                        showCollapsed && 'justify-center px-2'
                      )}
                    >
                      {/* 激活左侧指示条 */}
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-blue-600 dark:bg-blue-400 rounded-r-full" />
                      )}

                      <item.icon
                        className={cn(
                          'h-[18px] w-[18px] shrink-0 transition-colors duration-150',
                          isActive
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300'
                        )}
                      />
                      {!showCollapsed && (
                        <span className="truncate">{item.title}</span>
                      )}
                    </Link>
                  </TooltipTrigger>
                  {showCollapsed && (
                    <TooltipContent side="right" className="font-medium text-xs">
                      {item.title}
                    </TooltipContent>
                  )}
                </Tooltip>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User Info in Sidebar */}
      {!showCollapsed && (
        <div className="border-t border-slate-100 dark:border-slate-800/80 p-3">
          <div className="flex items-center gap-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2.5">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className={cn('text-white text-xs font-semibold', ROLE_COLORS[user.role])}>
                {user.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-slate-900 dark:text-slate-100">{user.name}</p>
              <p className={cn('text-xs truncate font-medium', ROLE_BADGE_COLORS[user.role])}>
                {ROLE_LABELS[user.role]}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Collapse Button - Desktop (非管理员) */}
      {!isMobile && !isAdmin && (
        <div className="border-t border-slate-100 dark:border-slate-800/80 p-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            className="w-full justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl h-8 transition-all"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 dark:bg-[oklch(0.13_0.01_240)]">
      {/* Mobile Sidebar Overlay */}
      {isMobile && mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'flex flex-col border-r border-slate-200/80 dark:border-slate-800 transition-all duration-300 z-50 shrink-0',
          isMobile
            ? `fixed inset-y-0 left-0 w-72 transform shadow-2xl ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`
            : showCollapsed
            ? 'w-[60px]'
            : 'w-[220px]'
        )}
      >
        <SidebarContent />
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* Header */}
        <header className="flex h-14 items-center justify-between border-b border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-sm px-4 shrink-0 z-30">
          {/* Left */}
          <div className="flex items-center gap-3">
            {isMobile && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileOpen(true)}
                className="text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg h-8 w-8"
              >
                <Menu className="h-4 w-4" />
              </Button>
            )}

            {/* Search Bar */}
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                type="search"
                placeholder="搜索访客、预约..."
                className="w-64 h-8 pl-9 text-sm bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-lg focus-visible:ring-1 focus-visible:ring-blue-500/50 transition-all"
              />
            </div>
          </div>

          {/* Right */}
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex items-center gap-2.5 px-2 h-9 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all"
                >
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className={cn('text-white text-[11px] font-semibold', ROLE_COLORS[user.role])}>
                      {user.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden md:flex flex-col items-start gap-0.5">
                    <span className="text-[13px] font-semibold leading-none text-slate-800 dark:text-slate-200">
                      {user.name}
                    </span>
                    <span className={cn('text-[10px] font-medium leading-none', ROLE_BADGE_COLORS[user.role])}>
                      {ROLE_LABELS[user.role]}
                    </span>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 rounded-xl shadow-lg border-slate-200/80 dark:border-slate-700">
                <DropdownMenuLabel className="pb-2">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className={cn('text-white text-sm font-semibold', ROLE_COLORS[user.role])}>
                        {user.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold">{user.name}</span>
                      <span className="text-xs font-normal text-muted-foreground">@{user.username}</span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer rounded-lg mx-1 gap-2"
                  onClick={() => setPasswordDialogOpen(true)}
                >
                  <KeyRound className="h-4 w-4 text-slate-500" />
                  修改密码
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-red-600 dark:text-red-400 cursor-pointer rounded-lg mx-1 mb-1 gap-2 focus:bg-red-50 focus:text-red-700 dark:focus:bg-red-950/30"
                >
                  <LogOut className="h-4 w-4" />
                  退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6">
          <div className="page-content">
            {children}
          </div>
        </main>
      </div>

      {/* 修改密码对话框 */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg">修改密码</DialogTitle>
            <DialogDescription>请输入原密码和新密码</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="oldPassword" className="text-sm font-medium">原密码</Label>
              <Input
                id="oldPassword"
                type="password"
                value={passwordForm.oldPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, oldPassword: e.target.value })}
                placeholder="请输入原密码"
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-sm font-medium">新密码</Label>
              <Input
                id="newPassword"
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                placeholder="请输入新密码（至少6位）"
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-medium">确认新密码</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                placeholder="请再次输入新密码"
                className="h-10"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setPasswordDialogOpen(false)}
              className="rounded-lg"
            >
              取消
            </Button>
            <Button
              onClick={handleChangePassword}
              disabled={changingPassword}
              className="rounded-lg bg-blue-600 hover:bg-blue-700"
            >
              {changingPassword ? '修改中...' : '确认修改'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Toaster />
    </div>
  );
}

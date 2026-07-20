'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, Loader2, Lock, User, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('登录成功，正在跳转...');
        
        // 检查是否需要强制修改密码
        if (data.mustChangePassword) {
          router.push('/change-password?force=true');
          return;
        }
        
        const role = data.user.role;
        if (role === 'admin') {
          router.push('/management');
        } else if (role === 'security') {
          router.push('/security');
        } else {
          router.push('/');
        }
      } else {
        toast.error(data.error || '用户名或密码错误');
      }
    } catch {
      toast.error('网络异常，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* 左侧装饰区域 */}
      <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center overflow-hidden">
        {/* 渐变背景 */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600" />
        {/* 装饰圆圈 */}
        <div className="absolute top-[-10%] right-[-5%] w-80 h-80 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-[-10%] left-[-5%] w-96 h-96 rounded-full bg-indigo-400/20 blur-3xl" />
        <div className="absolute top-1/3 left-1/4 w-48 h-48 rounded-full bg-blue-300/15 blur-2xl" />

        {/* 网格点阵装饰 */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
            backgroundSize: '30px 30px',
          }}
        />

        {/* 内容 */}
        <div className="relative z-10 text-white px-12 text-center animate-fade-in-up">
          <div className="flex justify-center mb-8">
            <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-white/15 backdrop-blur-sm border border-white/20 shadow-xl">
              <Building2 className="h-12 w-12 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-4 tracking-tight">访客管理系统</h1>
          <p className="text-blue-100 text-lg leading-relaxed max-w-sm mx-auto">
            统一管理访客预约、签到签退<br />让每一次来访都安全、高效
          </p>

          {/* 特性标签 */}
          <div className="flex flex-wrap justify-center gap-2 mt-8">
            {['智能预约', '安全管控', '数据分析', '快速签到'].map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm text-sm border border-white/20"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* 右侧登录区域 */}
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="w-full max-w-md animate-fade-in-scale">
          {/* 移动端 Logo */}
          <div className="flex lg:hidden justify-center mb-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg">
              <Building2 className="h-8 w-8 text-white" />
            </div>
          </div>

          {/* 标题 */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50 lg:text-3xl">
              欢迎回来
            </h2>
            <p className="mt-2 text-slate-500 dark:text-slate-400">
              登录以继续使用访客管理系统
            </p>
          </div>

          {/* 表单 */}
          <form onSubmit={handleLogin} className="space-y-5">
            {/* 用户名 */}
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                用户名
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="username"
                  type="text"
                  placeholder="请输入用户名"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  disabled={isLoading}
                  className="pl-10 h-11 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-blue-500/20 transition-all"
                />
              </div>
            </div>

            {/* 密码 */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                密码
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="password"
                  type="password"
                  placeholder="请输入密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className="pl-10 h-11 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-blue-500/20 transition-all"
                />
              </div>
            </div>

            {/* 登录按钮 */}
            <Button
              type="submit"
              className={cn(
                'w-full h-11 text-base font-medium rounded-xl',
                'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600',
                'text-white border-0 shadow-md shadow-blue-500/25',
                'transition-all duration-200',
                'hover:shadow-lg hover:shadow-blue-500/30 hover:-translate-y-0.5',
                'active:translate-y-0 active:shadow-md',
                'disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none'
              )}
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>登录中...</span>
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <span>立即登录</span>
                  <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </Button>
          </form>

          {/* 底部版权 */}
          <p className="mt-10 text-center text-xs text-slate-400 dark:text-slate-600">
            访客管理系统 &copy; {new Date().getFullYear()} &nbsp;·&nbsp; 安全 · 高效 · 智能
          </p>
        </div>
      </div>
    </div>
  );
}

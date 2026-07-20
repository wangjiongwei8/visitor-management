'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export default function ChangePasswordPage() {
  return (
    <React.Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="animate-pulse text-slate-400">加载中...</div>
      </div>
    }>
      <ChangePasswordContent />
    </React.Suspense>
  );
}

function ChangePasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const forceChange = searchParams.get('force') === 'true';

  const [isLoading, setIsLoading] = React.useState(false);
  const [showOldPassword, setShowOldPassword] = React.useState(false);
  const [showNewPassword, setShowNewPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

  const [formData, setFormData] = React.useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // 密码策略（从后端获取）
  const [policy, setPolicy] = React.useState({
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumber: true,
    requireSpecialChar: true,
    specialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?',
  });

  React.useEffect(() => {
    // 获取密码策略
    fetch('/api/auth/password-policy')
      .then(res => res.json())
      .then(data => {
        if (data.minLength) {
          setPolicy(data);
        }
      })
      .catch(console.error);
  }, []);

  // 验证密码复杂度
  const getPasswordValidation = () => {
    const password = formData.newPassword;
    return {
      length: password.length >= policy.minLength,
      uppercase: !policy.requireUppercase || /[A-Z]/.test(password),
      lowercase: !policy.requireLowercase || /[a-z]/.test(password),
      number: !policy.requireNumber || /[0-9]/.test(password),
      special: !policy.requireSpecialChar || /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password),
    };
  };

  const validation = getPasswordValidation();
  const isPasswordValid = Object.values(validation).every(Boolean);
  const passwordsMatch = formData.newPassword === formData.confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isPasswordValid) {
      toast.error('密码不符合复杂度要求');
      return;
    }

    if (!passwordsMatch) {
      toast.error('两次输入的密码不一致');
      return;
    }

    if (!forceChange && !formData.oldPassword) {
      toast.error('请输入原密码');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oldPassword: formData.oldPassword,
          newPassword: formData.newPassword,
          forceChange: forceChange,
        }),
      });

      if (response.ok) {
        toast.success('密码修改成功，正在跳转...');
        // 使用 window.location 硬跳转确保新 cookie 完全生效
        setTimeout(() => {
          window.location.href = '/';
        }, 800);
      } else {
        const data = await response.json();
        toast.error(data.error || '修改失败');
      }
    } catch (error) {
      console.error('Change password failed:', error);
      toast.error('修改密码失败');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
      <Card className="w-full max-w-md rounded-2xl shadow-xl border-slate-200/80 dark:border-slate-700">
        <CardHeader className="text-center pb-2 pt-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4">
            <KeyRound className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          </div>
          <CardTitle className="text-xl font-bold">修改密码</CardTitle>
          <CardDescription className="text-sm">
            {forceChange
              ? '首次登录需要修改初始密码'
              : '请设置一个安全的新密码'}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          {forceChange && (
            <div className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  为了账户安全，您必须修改初始密码后才能继续使用系统。
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 原密码（非强制修改时显示） */}
            {!forceChange && (
              <div className="space-y-2">
                <Label htmlFor="oldPassword">原密码</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="oldPassword"
                    type={showOldPassword ? 'text' : 'password'}
                    value={formData.oldPassword}
                    onChange={(e) => setFormData({ ...formData, oldPassword: e.target.value })}
                    placeholder="请输入原密码"
                    className="pl-10 pr-10 h-10 rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOldPassword(!showOldPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showOldPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* 新密码 */}
            <div className="space-y-2">
              <Label htmlFor="newPassword">新密码</Label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="newPassword"
                  type={showNewPassword ? 'text' : 'password'}
                  value={formData.newPassword}
                  onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                  placeholder="请输入新密码"
                  className="pl-10 pr-10 h-10 rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* 密码复杂度提示 */}
            {formData.newPassword && (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className={cn('flex items-center gap-1', validation.length ? 'text-green-600' : 'text-slate-400')}>
                  {validation.length ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                  至少 {policy.minLength} 位
                </div>
                {policy.requireUppercase && (
                  <div className={cn('flex items-center gap-1', validation.uppercase ? 'text-green-600' : 'text-slate-400')}>
                    {validation.uppercase ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                    包含大写字母
                  </div>
                )}
                {policy.requireLowercase && (
                  <div className={cn('flex items-center gap-1', validation.lowercase ? 'text-green-600' : 'text-slate-400')}>
                    {validation.lowercase ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                    包含小写字母
                  </div>
                )}
                {policy.requireNumber && (
                  <div className={cn('flex items-center gap-1', validation.number ? 'text-green-600' : 'text-slate-400')}>
                    {validation.number ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                    包含数字
                  </div>
                )}
                {policy.requireSpecialChar && (
                  <div className={cn('flex items-center gap-1 col-span-2', validation.special ? 'text-green-600' : 'text-slate-400')}>
                    {validation.special ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                    包含特殊字符
                  </div>
                )}
              </div>
            )}

            {/* 确认密码 */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">确认密码</Label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  placeholder="请再次输入新密码"
                  className="pl-10 pr-10 h-10 rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {formData.confirmPassword && !passwordsMatch && (
                <p className="text-xs text-red-500">两次输入的密码不一致</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full h-10 rounded-lg bg-blue-600 hover:bg-blue-700"
              disabled={isLoading || !isPasswordValid || !passwordsMatch}
            >
              {isLoading ? '修改中...' : '确认修改'}
            </Button>
            
            {/* 禁用原因提示 */}
            {(!isPasswordValid || !passwordsMatch) && (
              <div className="mt-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50">
                <p className="text-xs text-red-600 dark:text-red-400 font-medium mb-1.5">无法保存，请检查以下问题：</p>
                <ul className="text-xs text-red-600 dark:text-red-400 space-y-0.5">
                  {!isPasswordValid && (
                    <li>• 密码不符合复杂度要求（请确保所有条件打勾）</li>
                  )}
                  {!passwordsMatch && (
                    <li>• 两次输入的密码不一致</li>
                  )}
                </ul>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

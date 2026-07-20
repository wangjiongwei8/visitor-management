'use client';

import * as React from 'react';
import { toast } from 'sonner';
import {
  Shield,
  Lock,
  Save,
  RefreshCw,
  KeyRound,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface PasswordPolicy {
  id: number;
  name: string;
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumber: boolean;
  requireSpecialChar: boolean;
  specialChars: string;
  maxPasswordAge: number | null;
  passwordExpiryWarningDays: number;
  passwordHistoryCount: number;
  defaultPassword: string;
  forceChangeOnFirstLogin: boolean;
  maxLoginAttempts: number;
  lockoutDuration: number;
  isActive: boolean;
}

export default function PasswordPolicyPage() {
  const [policy, setPolicy] = React.useState<PasswordPolicy | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);

  const fetchPolicy = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/password-policy');
      if (response.ok) {
        const data = await response.json();
        setPolicy(data);
      } else {
        // 如果没有策略，创建默认值
        setPolicy({
          id: 0,
          name: 'default',
          minLength: 8,
          requireUppercase: true,
          requireLowercase: true,
          requireNumber: true,
          requireSpecialChar: true,
          specialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?',
          maxPasswordAge: 90,
          passwordExpiryWarningDays: 7,
          passwordHistoryCount: 5,
          defaultPassword: '123456',
          forceChangeOnFirstLogin: true,
          maxLoginAttempts: 5,
          lockoutDuration: 30,
          isActive: true,
        });
      }
    } catch (error) {
      console.error('Failed to fetch password policy:', error);
      toast.error('获取密码策略失败');
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    fetchPolicy();
  }, []);

  const handleSave = async () => {
    if (!policy) return;

    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/password-policy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(policy),
      });

      if (response.ok) {
        toast.success('密码策略保存成功');
        fetchPolicy();
      } else {
        const error = await response.json();
        toast.error(error.error || '保存失败');
      }
    } catch (error) {
      console.error('Failed to save password policy:', error);
      toast.error('保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  const updatePolicy = (key: keyof PasswordPolicy, value: any) => {
    if (policy) {
      setPolicy({ ...policy, [key]: value });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!policy) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-slate-400">加载失败</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">密码策略管理</h1>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-0.5">
            配置系统密码复杂度要求和过期策略
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="h-8 rounded-lg bg-blue-600 hover:bg-blue-700 gap-1.5"
        >
          {isSaving ? (
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          保存设置
        </Button>
      </div>

      {/* 密码复杂度要求 */}
      <Card className="border-slate-200/80 dark:border-slate-800">
        <CardHeader className="pb-3 pt-4 px-5">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-blue-600" />
            密码复杂度要求
          </CardTitle>
          <CardDescription className="text-xs">
            设置用户密码必须满足的复杂度条件
          </CardDescription>
        </CardHeader>
        <CardContent className="px-5 pb-5 space-y-5">
          {/* 最小长度 */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm">最小密码长度</Label>
              <p className="text-xs text-slate-500">密码最少需要多少个字符</p>
            </div>
            <Input
              type="number"
              min={6}
              max={32}
              value={policy.minLength}
              onChange={(e) => updatePolicy('minLength', parseInt(e.target.value) || 8)}
              className="w-24 h-9 text-sm rounded-lg"
            />
          </div>

          {/* 复杂度开关 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="space-y-0.5">
                <Label className="text-sm">需要大写字母</Label>
                <p className="text-xs text-slate-500">A-Z</p>
              </div>
              <Switch
                checked={policy.requireUppercase}
                onCheckedChange={(v) => updatePolicy('requireUppercase', v)}
              />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="space-y-0.5">
                <Label className="text-sm">需要小写字母</Label>
                <p className="text-xs text-slate-500">a-z</p>
              </div>
              <Switch
                checked={policy.requireLowercase}
                onCheckedChange={(v) => updatePolicy('requireLowercase', v)}
              />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="space-y-0.5">
                <Label className="text-sm">需要数字</Label>
                <p className="text-xs text-slate-500">0-9</p>
              </div>
              <Switch
                checked={policy.requireNumber}
                onCheckedChange={(v) => updatePolicy('requireNumber', v)}
              />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="space-y-0.5">
                <Label className="text-sm">需要特殊字符</Label>
                <p className="text-xs text-slate-500">!@#$%^&*等</p>
              </div>
              <Switch
                checked={policy.requireSpecialChar}
                onCheckedChange={(v) => updatePolicy('requireSpecialChar', v)}
              />
            </div>
          </div>

          {/* 特殊字符集 */}
          {policy.requireSpecialChar && (
            <div className="space-y-2">
              <Label className="text-sm">允许的特殊字符</Label>
              <Input
                value={policy.specialChars || ''}
                onChange={(e) => updatePolicy('specialChars', e.target.value)}
                placeholder="!@#$%^&*()_+-=[]{}|;:,.<>?"
                className="text-sm rounded-lg font-mono"
              />
            </div>
          )}

          {/* 密码示例 */}
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <Info className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium">密码要求示例</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              密码至少需要 {policy.minLength} 位
              {policy.requireUppercase && '，包含大写字母'}
              {policy.requireLowercase && '，包含小写字母'}
              {policy.requireNumber && '，包含数字'}
              {policy.requireSpecialChar && '，包含特殊字符'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 密码过期设置 */}
      <Card className="border-slate-200/80 dark:border-slate-800">
        <CardHeader className="pb-3 pt-4 px-5">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-600" />
            密码过期设置
          </CardTitle>
          <CardDescription className="text-xs">
            配置密码有效期和过期提醒
          </CardDescription>
        </CardHeader>
        <CardContent className="px-5 pb-5 space-y-5">
          {/* 密码有效期 */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm">密码有效期（天）</Label>
              <p className="text-xs text-slate-500">留空或设为0表示永不过期</p>
            </div>
            <Input
              type="number"
              min={0}
              max={365}
              value={policy.maxPasswordAge || ''}
              onChange={(e) => updatePolicy('maxPasswordAge', parseInt(e.target.value) || null)}
              placeholder="永不过期"
              className="w-32 h-9 text-sm rounded-lg"
            />
          </div>

          {/* 过期警告 */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm">过期前警告天数</Label>
              <p className="text-xs text-slate-500">提前多少天提醒用户修改密码</p>
            </div>
            <Input
              type="number"
              min={1}
              max={30}
              value={policy.passwordExpiryWarningDays}
              onChange={(e) => updatePolicy('passwordExpiryWarningDays', parseInt(e.target.value) || 7)}
              className="w-32 h-9 text-sm rounded-lg"
            />
          </div>

          {/* 历史密码检查 */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm">历史密码检查</Label>
              <p className="text-xs text-slate-500">不能重复使用最近N次使用过的密码</p>
            </div>
            <Input
              type="number"
              min={0}
              max={20}
              value={policy.passwordHistoryCount}
              onChange={(e) => updatePolicy('passwordHistoryCount', parseInt(e.target.value) || 0)}
              className="w-32 h-9 text-sm rounded-lg"
            />
          </div>
        </CardContent>
      </Card>

      {/* 初始密码设置 */}
      <Card className="border-slate-200/80 dark:border-slate-800">
        <CardHeader className="pb-3 pt-4 px-5">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Lock className="h-4 w-4 text-green-600" />
            初始密码设置
          </CardTitle>
          <CardDescription className="text-xs">
            配置新用户的默认密码和行为
          </CardDescription>
        </CardHeader>
        <CardContent className="px-5 pb-5 space-y-5">
          {/* 默认密码 */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm">默认初始密码</Label>
              <p className="text-xs text-slate-500">新用户或重置后的默认密码</p>
            </div>
            <Input
              type="text"
              value={policy.defaultPassword}
              onChange={(e) => updatePolicy('defaultPassword', e.target.value)}
              className="w-32 h-9 text-sm rounded-lg"
            />
          </div>

          {/* 强制首次修改 */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20">
            <div className="space-y-0.5">
              <Label className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                强制首次登录修改密码
              </Label>
              <p className="text-xs text-slate-500">使用初始密码登录后必须修改密码</p>
            </div>
            <Switch
              checked={policy.forceChangeOnFirstLogin}
              onCheckedChange={(v) => updatePolicy('forceChangeOnFirstLogin', v)}
            />
          </div>
        </CardContent>
      </Card>

      {/* 登录安全设置 */}
      <Card className="border-slate-200/80 dark:border-slate-800">
        <CardHeader className="pb-3 pt-4 px-5">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Shield className="h-4 w-4 text-red-600" />
            登录安全设置
          </CardTitle>
          <CardDescription className="text-xs">
            配置登录失败锁定策略
          </CardDescription>
        </CardHeader>
        <CardContent className="px-5 pb-5 space-y-5">
          {/* 最大尝试次数 */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm">最大登录失败次数</Label>
              <p className="text-xs text-slate-500">连续失败多少次后锁定账户</p>
            </div>
            <Input
              type="number"
              min={3}
              max={10}
              value={policy.maxLoginAttempts}
              onChange={(e) => updatePolicy('maxLoginAttempts', parseInt(e.target.value) || 5)}
              className="w-32 h-9 text-sm rounded-lg"
            />
          </div>

          {/* 锁定时长 */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm">锁定时长（分钟）</Label>
              <p className="text-xs text-slate-500">账户被锁定后的解锁时间</p>
            </div>
            <Input
              type="number"
              min={5}
              max={120}
              value={policy.lockoutDuration}
              onChange={(e) => updatePolicy('lockoutDuration', parseInt(e.target.value) || 30)}
              className="w-32 h-9 text-sm rounded-lg"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

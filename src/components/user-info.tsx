'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LogOut, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface UserInfo {
  id: number;
  username: string;
  name: string;
  role: string;
}

// 角色显示名称
const ROLE_LABELS: Record<string, string> = {
  admin: '管理员',
  security: '门卫',
  employee: '员工',
  visitor: '访客',
};

export default function UserInfo() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchUserInfo();
  }, []);

  const fetchUserInfo = async () => {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const data = await response.json();
        setUser(data);
      } else {
        // 未登录，跳转到登录页
        router.push('/login');
      }
    } catch (error) {
      console.error('Failed to fetch user info:', error);
      router.push('/login');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
      });

      if (response.ok) {
        toast.success('已退出登录');
        router.push('/login');
      } else {
        toast.error('退出失败');
      }
    } catch (error) {
      toast.error('网络错误');
    }
  };

  if (isLoading) {
    return <div className="text-sm">加载中...</div>;
  }

  if (!user) {
    return null;
  }

  const getRoleBadgeColor = (role: string) => {
    const colors = {
      admin: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-400',
      security: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-400',
      employee: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-400',
      visitor: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-400',
    };
    return colors[role as keyof typeof colors] || colors.visitor;
  };

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <User className="h-4 w-4" />
        <span className="text-sm font-medium">{user.name}</span>
        <Badge className={getRoleBadgeColor(user.role)}>
          {ROLE_LABELS[user.role] || user.role}
        </Badge>
      </div>
      <Button variant="ghost" size="sm" onClick={handleLogout}>
        <LogOut className="h-4 w-4 mr-1" />
        退出
      </Button>
    </div>
  );
}

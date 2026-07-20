'use client';

import * as React from 'react';
import {
  Calendar,
  Users,
  CheckCircle,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

interface UserInfo {
  id: number;
  username: string;
  name: string;
  role: string;
}

interface Stats {
  todayVisitors: number;
  todayCheckOuts: number;
  todayAppointments: number;
  todayNotCheckedOut: number;
}

const ROLE_LABELS: Record<string, string> = {
  admin: '管理员',
  security: '门卫',
  employee: '员工',
  visitor: '访客',
};

export default function HomePage() {
  const [user, setUser] = React.useState<UserInfo | null>(null);
  const [stats, setStats] = React.useState<Stats>({
    todayVisitors: 0,
    todayCheckOuts: 0,
    todayAppointments: 0,
    todayNotCheckedOut: 0,
  });
  const [pendingCount, setPendingCount] = React.useState(0);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    Promise.allSettled([
      fetch('/api/auth/me').then((r) => r.json()),
      fetch('/api/stats').then((r) => r.json()),
    ]).then(([userResult, statsResult]) => {
      if (userResult.status === 'fulfilled' && userResult.value?.id) {
        setUser(userResult.value);
        // 员工角色：查询待审核数量
        if (userResult.value.role === 'employee') {
          fetch('/api/appointments/pending')
            .then((r) => r.json())
            .then((data) => {
              if (Array.isArray(data)) {
                setPendingCount(data.length);
              }
            })
            .catch(() => {});
        }
      }
      if (statsResult.status === 'fulfilled' && statsResult.value) {
        const data = statsResult.value;
        setStats({
          todayVisitors: data.todayVisitors || 0,
          todayCheckOuts: data.todayCheckOuts || 0,
          todayAppointments: data.todayAppointments || 0,
          todayNotCheckedOut: data.todayNotCheckedOut || 0,
        });
      }
      setLoading(false);
    });

    // 监听 my-appointments 页面的待审核数量变化事件
    const handlePendingCountChange = (e: CustomEvent) => {
      if (e.detail?.count !== undefined) {
        setPendingCount(e.detail.count);
      }
    };
    window.addEventListener('pending-count-changed', handlePendingCountChange as EventListener);
    return () => window.removeEventListener('pending-count-changed', handlePendingCountChange as EventListener);
  }, []);

  const getStatCards = () => {
    if (!user) return [];
    
    // 员工/访客角色：显示"我的预约"卡片 + 待审核卡片
    if (user.role === 'employee') {
      return [
        {
          title: '我的预约',
          value: stats.todayAppointments,
          icon: Calendar,
          gradient: 'from-blue-500 to-blue-600',
          cardClass: 'stat-card-blue',
          textColor: 'text-blue-600',
          desc: '预约申请总数',
          link: '/my-appointments',
        },
        {
          title: '待审核',
          value: pendingCount,
          icon: Clock,
          gradient: pendingCount > 0 ? 'from-orange-500 to-orange-600' : 'from-gray-400 to-gray-500',
          cardClass: pendingCount > 0 ? 'stat-card-orange' : '',
          textColor: pendingCount > 0 ? 'text-orange-600' : 'text-gray-600',
          desc: pendingCount > 0 ? '有待审批的访客预约' : '无待处理预约',
          link: '/my-appointments',
          badge: pendingCount > 0,
        },
      ];
    }

    // 管理员/门卫角色：原统计卡片
    const adminSecurityCards = [
      {
        title: '今日预约',
        value: stats.todayAppointments,
        icon: Calendar,
        gradient: 'from-indigo-500 to-indigo-600',
        cardClass: 'stat-card-indigo',
        textColor: 'text-indigo-600',
        desc: '今日预计来访',
      },
      {
        title: '今日访客',
        value: stats.todayVisitors,
        icon: Users,
        gradient: 'from-blue-500 to-blue-600',
        cardClass: 'stat-card-blue',
        textColor: 'text-blue-600',
        desc: '今日已签到人数',
      },
      {
        title: '今日签退',
        value: stats.todayCheckOuts,
        icon: CheckCircle,
        gradient: 'from-cyan-500 to-cyan-600',
        cardClass: 'stat-card-cyan',
        textColor: 'text-cyan-600',
        desc: '今日已签退人数',
      },
      {
        title: '今日未签退',
        value: stats.todayNotCheckedOut,
        icon: AlertTriangle,
        gradient: 'from-red-500 to-red-600',
        cardClass: 'stat-card-red',
        textColor: 'text-red-600',
        desc: '⚠️ 已签到未签退',
      },
    ];

    return adminSecurityCards;
  };

  if (!user || loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-7 w-48 rounded-lg skeleton" />
            <div className="h-4 w-36 rounded-lg skeleton" />
          </div>
          <div className="h-7 w-16 rounded-full skeleton" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl skeleton" />
          ))}
        </div>
      </div>
    );
  }

  const statCards = getStatCards();

  const today = new Date().toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* 欢迎区域 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-slate-900 dark:text-slate-50 leading-tight">
            你好，{user.name} 👋
          </h1>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">{today}</p>
        </div>
        <Badge
          variant="outline"
          className={cn(
            'px-3 py-1 text-xs font-semibold border-0',
            user.role === 'admin' && 'text-purple-700 bg-purple-100 dark:text-purple-300 dark:bg-purple-950/50',
            user.role === 'security' && 'text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-950/50',
            user.role === 'employee' && 'text-blue-700 bg-blue-100 dark:text-blue-300 dark:bg-blue-950/50',
            user.role === 'visitor' && 'text-orange-700 bg-orange-100 dark:text-orange-300 dark:bg-orange-950/50'
          )}
        >
          {ROLE_LABELS[user.role]}
        </Badge>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat: any, index) => {
          const cardContent = (
            <Card
              key={index}
              className={cn(
                'border transition-all duration-200 hover:shadow-md hover:-translate-y-0.5',
                stat.cardClass
              )}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                      {stat.title}
                      {stat.badge && (
                        <span className="ml-1.5 inline-flex items-center justify-center h-5 min-w-5 px-1 rounded-full bg-red-500 text-white text-xs font-bold">
                          {pendingCount}
                        </span>
                      )}
                    </p>
                    <p className={cn('text-3xl font-bold mt-1.5 tabular-nums', stat.textColor)}>
                      {stat.value}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{stat.desc}</p>
                  </div>
                  <div className={cn('p-2.5 rounded-xl bg-gradient-to-br shadow-sm', stat.gradient)}>
                    <stat.icon className="h-5 w-5 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );

          // 如果有链接，用 Link 包裹
          if (stat.link) {
            return (
              <Link href={stat.link} key={index}>
                {cardContent}
              </Link>
            );
          }
          return cardContent;
        })}
      </div>
    </div>
  );
}

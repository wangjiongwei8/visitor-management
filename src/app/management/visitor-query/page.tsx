'use client';

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import VisitorManagement from '@/components/admin/visitor-management';

export default function VisitorQueryPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: number; username: string; name: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => {
        if (!res.ok) {
          router.push('/login');
          return null;
        }
        return res.json();
      })
      .then(data => {
        if (data && (data.role === 'admin' || data.role === 'security')) {
          setUser(data);
        } else if (data) {
          router.push('/');
        }
      })
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Search className="h-5 w-5 text-emerald-600" />
        <h1 className="text-xl font-bold">访客查询</h1>
      </div>
      <VisitorManagement />
    </div>
  );
}

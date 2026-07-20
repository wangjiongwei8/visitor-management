'use client';

import { useState, useEffect } from 'react';
import { Building2, Users } from 'lucide-react';
import ScanAppointmentForm from '@/components/visitor/scan-appointment-form';

export default function PublicAppointmentPage() {
  const [reviewEnabled, setReviewEnabled] = useState<boolean | null>(null);

  // 页面加载时获取审核开关状态
  useEffect(() => {
    fetch('/api/settings/public')
      .then((res) => res.json())
      .then((data) => setReviewEnabled(data.reviewEnabled))
      .catch(() => setReviewEnabled(true)); // 加载失败默认开启审核
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950">
      {/* Header */}
      <header className="border-b border-slate-200/50 bg-white/80 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/80">
        <div className="container mx-auto flex items-center justify-center gap-3 px-4 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-md shadow-emerald-500/30">
            {reviewEnabled === null ? (
              <Building2 className="h-4 w-4 text-white" />
            ) : (
              <Users className="h-4 w-4 text-white" />
            )}
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">访客预约登记</h1>
            {reviewEnabled !== null && (
              <p className="text-xs text-slate-500">
                {reviewEnabled ? '提交后需等待受访人审批' : '提交后自动通过，无需审批'}
              </p>
            )}
          </div>
        </div>
      </header>

      {/* 预约表单 */}
      {reviewEnabled !== null ? (
        <ScanAppointmentForm reviewEnabled={reviewEnabled} />
      ) : (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
        </div>
      )}
    </div>
  );
}

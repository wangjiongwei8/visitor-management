'use client';

import { ArrowLeft, Calendar } from 'lucide-react';
import Link from 'next/link';
import AppointmentManagement from '@/components/admin/appointment-management';

export default function AppointmentPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="border-b bg-white dark:bg-slate-900">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-4">
            <Link href="/">
              <button className="inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-slate-100 dark:hover:bg-slate-800">
                <ArrowLeft className="mr-2 h-4 w-4" />
                返回首页
              </button>
            </Link>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              <h1 className="text-2xl font-bold">访客预约</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        <AppointmentManagement />
      </div>
    </div>
  );
}

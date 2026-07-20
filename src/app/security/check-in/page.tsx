'use client';

import { ArrowLeft, LogIn } from 'lucide-react';
import Link from 'next/link';
import VisitorCheckIn from '@/components/security/visitor-check-in';

export default function CheckInPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="border-b bg-white dark:bg-slate-900">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-4">
            <Link href="/">
              <button className="inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-slate-100 dark:hover:bg-slate-800">
                <ArrowLeft className="mr-2 h-4 w-4" />
                返回
              </button>
            </Link>
            <div className="flex items-center gap-2">
              <LogIn className="h-5 w-5 text-green-600" />
              <h1 className="text-2xl font-bold">访客签到</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          <div className="rounded-lg border bg-white dark:bg-slate-900 p-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold">访客签到</h2>
              <p className="text-sm text-muted-foreground">
                处理访客签到操作，发放通行凭证
              </p>
            </div>
            <VisitorCheckIn defaultMode="checkin" />
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ManagementPage() {
  const router = useRouter();

  useEffect(() => {
    // 重定向到首页
    router.replace('/');
  }, [router]);

  return null;
}

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function TestDataPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const insertTestUsers = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/test-data/users', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setResult(JSON.stringify(data.results, null, 2));
      } else {
        setResult('Error: ' + data.error);
      }
    } catch (error) {
      setResult('Error: ' + String(error));
    }
    setLoading(false);
  };

  return (
    <div className="container mx-auto p-8">
      <Card>
        <CardHeader>
          <CardTitle>测试数据生成</CardTitle>
          <CardDescription>点击按钮生成测试用户数据</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={insertTestUsers} disabled={loading}>
            {loading ? '生成中...' : '生成测试用户'}
          </Button>
          {result && (
            <pre className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg text-sm overflow-auto">
              {result}
            </pre>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

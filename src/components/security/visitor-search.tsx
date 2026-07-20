'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface VisitorRecord {
  id: number;
  visitorName: string;
  visitorIdCard: string;
  visitorPhone: string;
  visitObject: string;
  visitPurpose: string;
  checkInTime: string;
  checkOutTime: string | null;
  visitStatus: 'visiting' | 'completed';
  riskLevel: 'green' | 'yellow' | 'red';
}

interface SearchResponse {
  type: 'record' | 'blacklist' | 'notfound';
  data: VisitorRecord | null;
  message: string;
}

export default function VisitorSearch() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SearchResponse | null>(null);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast.error('请输入查询内容');
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch(`/api/visitor/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();

      if (response.ok) {
        setResult(data);
      } else {
        toast.error(data.error || '查询失败');
        setResult({ type: 'notfound', data: null, message: data.error || '查询失败' });
      }
    } catch (error) {
      toast.error('网络错误，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const getRiskBadge = (level: 'green' | 'yellow' | 'red') => {
    const config = {
      green: {
        label: '正常',
        color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-400 border-green-300',
        icon: CheckCircle,
      },
      yellow: {
        label: '需注意',
        color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-400 border-yellow-300',
        icon: Clock,
      },
      red: {
        label: '高风险',
        color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-400 border-red-300',
        icon: AlertCircle,
      },
    };

    const { label, color, icon: Icon } = config[level];

    return (
      <div className={cn('flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium', color)}>
        <Icon className="h-4 w-4" />
        <span>{label}</span>
      </div>
    );
  };

  const cn = (...classes: (string | undefined | null | false)[]) => {
    return classes.filter(Boolean).join(' ');
  };

  return (
    <div className="space-y-6">
      {/* 搜索框 */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="请输入访客姓名、身份证号或手机号"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            className="pl-9"
          />
        </div>
        <Button onClick={handleSearch} disabled={isLoading}>
          {isLoading ? '查询中...' : '查询'}
        </Button>
      </div>

      {/* 搜索结果 */}
      {result && result.data && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {/* 风险等级 */}
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">访客信息</h3>
                {getRiskBadge(result.data.riskLevel)}
              </div>

              {/* 基本信息 */}
              <div className="grid gap-3 rounded-lg border bg-muted/50 p-4 sm:grid-cols-2">
                <div>
                  <span className="text-sm text-muted-foreground">姓名：</span>
                  <span className="font-medium">{result.data.visitorName}</span>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">身份证：</span>
                  <span className="font-medium">{result.data.visitorIdCard}</span>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">电话：</span>
                  <span className="font-medium">{result.data.visitorPhone}</span>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">拜访对象：</span>
                  <span className="font-medium">{result.data.visitObject}</span>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">来访事由：</span>
                  <span className="font-medium">{result.data.visitPurpose}</span>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">状态：</span>
                  <Badge variant={result.data.visitStatus === 'visiting' ? 'default' : 'secondary'}>
                    {result.data.visitStatus === 'visiting' ? '访问中' : '已完成'}
                  </Badge>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">签到时间：</span>
                  <span className="font-medium">
                    {(() => {
                      if (!result.data.checkInTime) return '-';
                      const d = new Date(result.data.checkInTime);
                      return d.toLocaleString('zh-CN');
                    })()}
                  </span>
                </div>
                {result.data.checkOutTime && (
                  <div>
                    <span className="text-sm text-muted-foreground">签退时间：</span>
                    <span className="font-medium">
                      {(() => {
                        const d = new Date(result.data.checkOutTime);
                        return d.toLocaleString('zh-CN');
                      })()}
                    </span>
                  </div>
                )}
              </div>

              {/* 风险提示 */}
              {result.data.riskLevel !== 'green' && (
                <div className={cn(
                  'rounded-lg border p-4',
                  result.data.riskLevel === 'red' && 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-900',
                  result.data.riskLevel === 'yellow' && 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-900'
                )}>
                  <p className="text-sm font-medium">
                    {result.data.riskLevel === 'red' && '⚠️ 该访客被标记为高风险，请谨慎处理'}
                    {result.data.riskLevel === 'yellow' && '⚡ 该访客需要特别注意'}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {result && !result.data && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-muted-foreground">
              {result.message}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

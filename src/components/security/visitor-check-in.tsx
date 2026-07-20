'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Search, CheckCircle, LogOut, AlertCircle, Car, Users, Shield, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { VISITOR_TYPE, VISITOR_TYPE_CONFIG } from '@/lib/schema';

const maskName = (name: string): string => {
  if (!name || name.length <= 1) return name;
  return name[0] + '*'.repeat(name.length - 1);
};

const maskPhone = (phone: string): string => {
  if (!phone || phone.length !== 11) return phone;
  return phone.substring(0, 3) + '****' + phone.substring(7);
};

interface VehicleInfo {
  licensePlate: string;
  vehicleModel: string;
  vehicleType: string;
}

interface VisitorInfo {
  id: number;
  name: string;
  phone: string;
  idCard?: string;
  visitObject: string;
  visitPurpose: string;
  visitDate: string;
  appointmentTime?: string;
  visitorType?: string;
  visitorTypeName?: string;
  totalVisitors?: number;
  vehicleInfo?: VehicleInfo[];
  checkInTime?: string;
  company?: string;
  isLongTermVehicle?: boolean;
  licensePlate?: string;
  hostName?: string;
  hostDepartment?: string;
  visitorCode?: string;
  // 长约相关字段
  isOnSite?: boolean; // 是否在厂
  checkinCount?: number; // 签到次数
}

interface VisitorCheckInProps {
  defaultMode?: 'checkin' | 'checkout';
}

export default function VisitorCheckIn({ defaultMode = 'checkin' }: VisitorCheckInProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [visitor, setVisitor] = useState<VisitorInfo | null>(null);
  const [searchResults, setSearchResults] = useState<VisitorInfo[]>([]);
  const [mode, setMode] = useState<'checkin' | 'checkout'>(defaultMode);
  const [checkOutNotes, setCheckOutNotes] = useState('');
  const [showPassDialog, setShowPassDialog] = useState(false);
  const [visitRecordData, setVisitRecordData] = useState<any>(null);

  const getPassBadge = (color: string) => {
    const config: Record<string, { label: string; className: string }> = {
      green: { label: '🟢 绿色', className: 'bg-green-100 text-green-800 border-green-300' },
      yellow: { label: '🟡 黄色', className: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
      red: { label: '🔴 红色', className: 'bg-red-100 text-red-800 border-red-300' },
    };
    return config[color] || config.green;
  };

  // 带超时的 fetch 封装（30s 超时，防止网络异常时无限等待）
  const fetchWithTimeout = async (url: string, options?: RequestInit, timeoutMs = 30000) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const handleSearch = async () => {
    setIsLoading(true);
    setVisitor(null);
    setSearchResults([]);

    try {
      const url = searchQuery.trim()
        ? `/api/visitors/search?q=${encodeURIComponent(searchQuery)}&mode=${mode}`
        : `/api/visitors/search?mode=${mode}`;

      const response = await fetchWithTimeout(url);
      if (!response.ok) {
        toast.error('查询失败，请重试');
        return;
      }
      const data = await response.json();

      if (data.length > 0) {
        if (data.length === 1) {
          setVisitor(data[0]);
        } else {
          setSearchResults(data);
          toast.success(`找到 ${data.length} 个访客，请选择`);
        }
      } else {
        toast.error('未找到访客信息');
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        toast.error('查询超时，请重试');
      } else {
        toast.error('网络错误，请重试');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handleCheckIn = async () => {
    if (!visitor) return;

    try {
      const response = await fetchWithTimeout('/api/visit-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitorIdCard: visitor.idCard,
          visitorPhone: visitor.phone,
          appointmentId: visitor.id,
          isLongTermVehicle: visitor.isLongTermVehicle,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setVisitRecordData(data);
        setShowPassDialog(true);
        setSearchQuery('');
        setVisitor(null);
        setSearchResults([]);
      } else {
        const error = await response.json();
        toast.error(error.error || '签到失败');
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        toast.error('签到请求超时，请重试');
      } else {
        toast.error('网络错误，请重试');
      }
    }
  };

  const handleCheckOut = async () => {
    if (!visitor) return;

    try {
      const response = await fetchWithTimeout('/api/visit-records/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitorIdCard: visitor.idCard,
          visitorPhone: visitor.phone,
          notes: checkOutNotes,
          visitRecordId: visitor.id,
        }),
      });

      if (response.ok) {
        toast.success('签退成功！');
        setSearchQuery('');
        setVisitor(null);
        setSearchResults([]);
        setCheckOutNotes('');
      } else {
        const error = await response.json();
        toast.error(error.error || '签退失败');
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        toast.error('签退请求超时，请重试');
      } else {
        toast.error('网络错误，请重试');
      }
    }
  };

  const formatDateTime = (dateStr?: string, timeStr?: string) => {
    if (!dateStr) return '-';
    // 直接截取 YYYY-MM-DD 格式，避免时区转换导致日期错乱
    const datePart = dateStr.length >= 10 ? dateStr.substring(0, 10) : dateStr;
    // 格式化为中文：YYYY年MM月DD日
    const parts = datePart.split('-');
    const formatted = parts.length === 3 ? `${parts[0]}年${parts[1]}月${parts[2]}日` : datePart;
    return timeStr ? `${formatted} ${timeStr}` : formatted;
  };

  const formatTime = (timestamp?: string) => {
    if (!timestamp) return '-';
    // 浏览器端 new Date() 自动转为本地时区，无需手动 +8h
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN');
  };

  return (
    <div className="space-y-6">
      {!defaultMode && (
        <div className="flex gap-2">
          <Button variant={mode === 'checkin' ? 'default' : 'outline'} onClick={() => setMode('checkin')} className="flex-1">
            <CheckCircle className="mr-2 h-4 w-4" />访客签到
          </Button>
          <Button variant={mode === 'checkout' ? 'default' : 'outline'} onClick={() => setMode('checkout')} className="flex-1">
            <LogOut className="mr-2 h-4 w-4" />访客签退
          </Button>
        </div>
      )}

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="请输入访客编号（或后四位）、姓名、车牌号或手机号" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyPress={handleKeyPress} className="pl-9 text-lg h-12" />
        </div>
        <Button onClick={handleSearch} disabled={isLoading}>{isLoading ? '查询中...' : '查询'}</Button>
      </div>

      {searchResults.length > 0 && !visitor && (
        <Card>
          <CardHeader><CardTitle>搜索结果</CardTitle><CardDescription>请选择访客</CardDescription></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {searchResults.map((result) => (
                <Button key={result.id} variant="outline" className="w-full justify-start text-left h-auto py-4" onClick={() => setVisitor(result)}>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {result.visitorCode && (
                          <span className="font-mono text-base font-bold bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-1 rounded">{result.visitorCode}</span>
                        )}
                        <span className="font-bold text-lg text-slate-900 dark:text-slate-100">{result.isLongTermVehicle ? result.name : maskName(result.name)}</span>
                        {result.isLongTermVehicle && (
                          <Badge variant="outline" className="text-base border-orange-500 text-orange-600 font-bold">长约车</Badge>
                        )}
                        {result.isLongTermVehicle && result.checkinCount !== undefined && result.checkinCount > 0 && (
                          <Badge variant="outline" className="text-base border-green-500 text-green-600 font-bold">
                            已签到{result.checkinCount}次
                          </Badge>
                        )}
                        <Badge variant="secondary" className="text-base font-bold">{result.company || result.visitObject}</Badge>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-base text-slate-700 dark:text-slate-300 mt-2">
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        <span className="font-semibold">预约：{formatDateTime(result.visitDate, result.appointmentTime)}</span>
                      </div>
                      {mode === 'checkout' && result.checkInTime && (
                        <div className="flex items-center gap-1">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="text-green-700 dark:text-green-400 font-semibold">签到：{formatTime(result.checkInTime)}</span>
                        </div>
                      )}
                    </div>
                    <div className="text-base text-slate-600 dark:text-slate-300 mt-2">
                      {result.licensePlate && <span className="mr-3 font-semibold">车牌: {result.licensePlate}</span>}
                      {result.phone && <span className="mr-3 font-semibold">{maskPhone(result.phone)}</span>}
                      <span className="font-semibold">{result.visitPurpose}</span>
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {visitor && (
        <Card>
          <CardHeader>
            <CardTitle>访客信息</CardTitle>
            <CardDescription>{mode === 'checkin' ? '确认信息后点击签到' : '确认信息后点击签退'}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 rounded-lg border bg-muted/50 p-5 sm:grid-cols-2">
              {visitor.visitorCode && (
                <div><span className="text-base font-semibold text-slate-600">访客编号：</span><span className="font-bold font-mono text-lg text-blue-700">{visitor.visitorCode}</span></div>
              )}
              <div><span className="text-base font-semibold text-slate-600">姓名：</span><span className="font-bold text-lg text-slate-900">{visitor.isLongTermVehicle ? visitor.name : maskName(visitor.name)}</span></div>
              <div><span className="text-base font-semibold text-slate-600">电话：</span><span className="font-bold text-lg text-slate-900">{maskPhone(visitor.phone)}</span></div>
              <div><span className="text-base font-semibold text-slate-600">拜访人员：</span><span className="font-bold text-lg text-slate-900">{visitor.hostName || visitor.visitObject}</span></div>
              <div><span className="text-base font-semibold text-slate-600">拜访部门：</span><span className="font-bold text-lg text-slate-900">{visitor.hostDepartment || '-'}</span></div>
              <div><span className="text-base font-semibold text-slate-600">来访事由：</span><span className="font-bold text-lg text-slate-900">{visitor.visitPurpose}</span></div>
              <div><span className="text-base font-semibold text-slate-600">预约日期：</span><span className="font-bold text-lg text-slate-900">{formatDateTime(visitor.visitDate, visitor.appointmentTime)}</span></div>
              <div><span className="text-base font-semibold text-slate-600">来访人数：</span><span className="font-bold text-lg text-slate-900">{visitor.totalVisitors || 1} 人</span></div>
              {/* 长约签到状态 */}
              {visitor.isLongTermVehicle && visitor.checkinCount !== undefined && visitor.checkinCount > 0 && (
                <div className="sm:col-span-2">
                  <span className="text-base font-semibold text-slate-600">长约状态：</span>
                  <span className="font-bold text-lg text-green-700">已累计签到 {visitor.checkinCount} 次</span>
                  {visitor.isOnSite && (
                    <Badge variant="outline" className="ml-2 text-base border-blue-500 text-blue-700 font-bold bg-blue-50">当前在厂</Badge>
                  )}
                </div>
              )}
              {/* 车牌号显示 */}
              {visitor.vehicleInfo && visitor.vehicleInfo.length > 0 && (
                <div className="sm:col-span-2">
                  <span className="text-base font-semibold text-slate-600">车牌号：</span>
                  <span className="font-bold font-mono text-lg text-slate-900">
                    {visitor.vehicleInfo.map((v, i) => (
                      <span key={i}>
                        {v.licensePlate}
                        {i < visitor.vehicleInfo!.length - 1 ? '、' : ''}
                      </span>
                    ))}
                  </span>
                </div>
              )}
              {/* 随访人员显示 */}
              {visitor.totalVisitors && visitor.totalVisitors > 1 && (
                <div className="sm:col-span-2">
                  <span className="text-base font-semibold text-slate-600">随访人员：</span>
                  <span className="font-bold text-lg text-purple-700">{visitor.totalVisitors - 1} 人</span>
                </div>
              )}
              {mode === 'checkout' && visitor.checkInTime && (
                <div><span className="text-base font-semibold text-slate-600">签到时间：</span><span className="font-bold text-lg text-green-700">{formatTime(visitor.checkInTime)}</span></div>
              )}
              {visitor.company && <div className="sm:col-span-2"><span className="text-base font-semibold text-slate-600">公司/单位：</span><span className="font-bold text-lg text-slate-900">{visitor.company}</span></div>}
            </div>

            {mode === 'checkout' && (
              <div className="space-y-2">
                <Label htmlFor="checkOutNotes">签退备注（选填）</Label>
                <Textarea id="checkOutNotes" value={checkOutNotes} onChange={(e) => setCheckOutNotes(e.target.value)} placeholder="请输入签退备注" rows={2} />
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setVisitor(null)}>取消</Button>
              {mode === 'checkin' ? (
                <Button onClick={handleCheckIn} className="bg-green-600 hover:bg-green-700"><CheckCircle className="mr-2 h-4 w-4" />确认签到</Button>
              ) : (
                <Button onClick={handleCheckOut} className="bg-orange-600 hover:bg-orange-700"><LogOut className="mr-2 h-4 w-4" />确认签退</Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {!visitor && !isLoading && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              <span>点击"查询"按钮搜索访客信息</span>
            </div>
          </CardContent>
        </Card>
      )}

      {showPassDialog && visitRecordData && (
        <Dialog open={showPassDialog} onOpenChange={setShowPassDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-green-600" />
                签到成功
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* 通行标识 - 最突出显示 */}
              <div className={`rounded-xl border-2 p-6 text-center ${getPassBadge(visitRecordData.passColor).className.replace('text-', 'bg-').replace('-800', '-100').replace('-100', '-50')} ${getPassBadge(visitRecordData.passColor).className}`}>
                <div className="text-4xl mb-2">{visitRecordData.passColor === 'green' ? '🟢' : visitRecordData.passColor === 'yellow' ? '🟡' : '🔴'}</div>
                <p className="text-2xl font-bold">{getPassBadge(visitRecordData.passColor).label.replace('🟢 ', '').replace('🟡 ', '').replace('🔴 ', '')} 通行牌</p>
                <p className="text-sm mt-1 opacity-75">通行牌号：{visitRecordData.passNumber}</p>
              </div>

              {/* 关键信息卡片 */}
              <div className="grid grid-cols-3 gap-3">
                {/* 到访人数 */}
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-center">
                  <Users className="h-5 w-5 text-blue-600 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-blue-700">{visitRecordData.totalVisitors || 1}</p>
                  <p className="text-xs text-blue-600">到访人数</p>
                </div>
                {/* 车辆信息 */}
                <div className="rounded-lg bg-orange-50 border border-orange-200 p-3 text-center">
                  <Car className="h-5 w-5 text-orange-600 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-orange-700">{visitRecordData.vehicleInfo?.length || 0}</p>
                  <p className="text-xs text-orange-600">车辆数量</p>
                </div>
                {/* 随访人员 */}
                <div className="rounded-lg bg-purple-50 border border-purple-200 p-3 text-center">
                  <Users className="h-5 w-5 text-purple-600 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-purple-700">{(visitRecordData.totalVisitors || 1) - 1}</p>
                  <p className="text-xs text-purple-600">随访人员</p>
                </div>
              </div>

              {/* 访客基本信息 */}
              <div className="rounded-lg border p-3 space-y-2">
                {visitRecordData.visitorCode && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">访客编号</span>
                    <span className="font-mono font-bold text-blue-600">{visitRecordData.visitorCode}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">访客姓名</span>
                  <span className="font-medium">{visitRecordData.visitorName}</span>
                </div>
                {/* 车牌号列表 */}
                {visitRecordData.vehicleInfo && visitRecordData.vehicleInfo.length > 0 && (
                  <div className="flex justify-between items-start">
                    <span className="text-sm text-muted-foreground">车牌号</span>
                    <div className="text-right">
                      {visitRecordData.vehicleInfo.map((v: any, i: number) => (
                        <div key={i} className="font-mono text-sm">{v.licensePlate}</div>
                      ))}
                    </div>
                  </div>
                )}
                {/* 随访人员 */}
                {visitRecordData.totalVisitors > 1 && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">随访人员</span>
                    <span className="font-medium text-purple-600">{visitRecordData.totalVisitors - 1} 人</span>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowPassDialog(false)}>关闭</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

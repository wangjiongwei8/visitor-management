'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Calendar, Plus, Users } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { TimePicker } from '@/components/ui/time-picker';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { VISITOR_TYPE_CONFIG } from '@/lib/schema';

interface Appointment {
  id: number;
  visitorCode?: string;
  visitorName: string;
  visitorIdCard: string;
  visitorPhone: string;
  visitorCount: number;
  company: string;
  visitorType: string;
  visitorCategory: string;
  visitObject: string;
  visitPurpose: string;
  appointmentDate: string;
  appointmentTime: string;
  licensePlate?: string;
  followers?: Array<{ id: string; name: string; phone: string; licensePlate: string }>;
  needMeal: boolean;
  notes: string;
  status: string;
  isCheckedIn: boolean;
}

// 访客类型配置
const VISITOR_TYPES = [
  { type: 'customer', label: '客户', category: 'business' },
  { type: 'supplier', label: '供应商', category: 'affairs' },
  { type: 'applicant', label: '应聘者', category: 'affairs' },
  { type: 'delivery', label: '送货/装货人员', category: 'affairs' },
  { type: 'government', label: '政府人员', category: 'special' },
  { type: 'visit', label: '参观访客', category: 'special' },
];

export default function EditAppointmentPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const isReadonly = searchParams.get('readonly') === '1';

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    visitorCode: '',
    visitorName: '',
    visitorIdCard: '',
    visitorPhone: '',
    visitorCount: 1,
    company: '',
    visitorType: '',
    visitObject: '',
    visitPurpose: '',
    appointmentDate: new Date(),
    entryTime: '',
    exitTime: '',
    licensePlate: '',
    needMeal: false,
    notes: '',
  });

  const [followers, setFollowers] = useState([
    { id: '', name: '', phone: '', licensePlate: '' }
  ]);

  useEffect(() => {
    if (id) {
      fetchAppointment();
    }
  }, [id]);

  const fetchAppointment = async () => {
    try {
      const response = await fetch(`/api/appointments/${id}`);
      if (response.ok) {
        const data = await response.json();
        console.log('[预约编辑] 加载数据:', data);
        
        // 解析 appointmentTime 格式（可能是 "HH:mm-HH:mm" 格式）
        let appointmentTime = data.appointmentTime || '';
        let entryTime = '';
        let exitTime = '';
        
        if (appointmentTime.includes('-')) {
          const [start, end] = appointmentTime.split('-');
          entryTime = start;
          exitTime = end;
        } else {
          appointmentTime = appointmentTime;
        }
        
        // 解析日期字符串（避免时区问题）
        const parseDate = (dateStr: string): Date => {
          if (!dateStr) return new Date();
          // API 返回 ISO 时间戳如 "2026-04-26T16:00:00.000Z"
          // 浏览器自动转为本地时区（上海），显示为4月27日
          return new Date(dateStr);
        };

        const loadedData = {
          visitorCode: data.visitorCode || '',
          visitorName: data.visitorName || '',
          visitorIdCard: data.visitorIdCard || '',
          visitorPhone: data.visitorPhone || '',
          visitorCount: data.visitorCount || 1,
          company: data.company || '',
          visitorType: data.visitorType || '',
          visitObject: data.visitObject || '',
          visitPurpose: data.visitPurpose || '',
          appointmentDate: parseDate(data.appointmentDate),
          entryTime: entryTime,
          exitTime: exitTime,
          licensePlate: data.licensePlate || '',
          needMeal: data.needMeal || false,
          notes: data.notes || '',
        };

        // 加载随访人员
        if (data.followers && Array.isArray(data.followers) && data.followers.length > 0) {
          setFollowers(data.followers.map((f: any) => ({
            id: f.id || String(Date.now()) + Math.random(),
            name: f.name || '',
            phone: f.phone || '',
            licensePlate: f.licensePlate || '',
          })));
        }
        
        console.log('[预约编辑] visitorType:', loadedData.visitorType);
        setFormData(loadedData);
      } else {
        toast.error('获取预约信息失败');
        router.push('/my-appointments');
      }
    } catch (error) {
      console.error('[预约编辑] 获取失败:', error);
      toast.error('获取预约信息失败');
      router.push('/my-appointments');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.visitorType) {
      toast.error('请选择访客类型');
      return;
    }
    
    // 送货/装货类型必须填写车牌号
    if (formData.visitorType === 'delivery' && !formData.licensePlate.trim()) {
      toast.error('送货/装货人员必须填写车牌号');
      return;
    }

    setIsSaving(true);

    try {
      // 计算总人数（主访客 + 随访人员）
      const followerCount = followers.filter(f => f.name).length;
      const visitorCount = followerCount + 1;

      const bodyData: any = {
        ...formData,
        visitorCount,
        visitors: followers.filter(f => f.name),
        visitorCategory: VISITOR_TYPE_CONFIG[formData.visitorType]?.category || '',
        // 使用本地时间格式避免时区问题
        appointmentDate: `${formData.appointmentDate.getFullYear()}-${String(formData.appointmentDate.getMonth() + 1).padStart(2, '0')}-${String(formData.appointmentDate.getDate()).padStart(2, '0')}`,
      };
      // 入场/离场时间都选了才发送，避免半残格式覆盖原数据
      if (formData.entryTime && formData.exitTime) {
        bodyData.appointmentTime = `${formData.entryTime}-${formData.exitTime}`;
      }

      const response = await fetch(`/api/appointments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData),
      });

      if (response.ok) {
        toast.success('预约已更新');
        // 留在编辑页，显示成功提示，不跳转
        setFormData(prev => ({ ...prev })); // 保持当前数据
      } else {
        const data = await response.json();
        toast.error(data.error || '更新失败');
      }
    } catch (error) {
      toast.error('更新失败');
    } finally {
      setIsSaving(false);
    }
  };

  const selectVisitorType = (type: string) => {
    setFormData({ ...formData, visitorType: type });
  };

  // 随行人员管理
  const addFollower = () => {
    setFollowers([...followers, { id: Date.now().toString(), name: '', phone: '', licensePlate: '' }]);
  };

  const removeFollower = (index: number) => {
    if (followers.length > 1) {
      setFollowers(followers.filter((_, i) => i !== index));
    }
  };

  const updateFollower = (index: number, field: 'name' | 'phone' | 'licensePlate', value: string) => {
    const newFollowers = [...followers];
    newFollowers[index][field] = value;
    setFollowers(newFollowers);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">加载中...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="border-b bg-white dark:bg-slate-900">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-4">
            <Link href="/my-appointments">
              <button className="inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-slate-100 dark:hover:bg-slate-800">
                <ArrowLeft className="mr-2 h-4 w-4" />
                返回
              </button>
            </Link>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              <h1 className="text-2xl font-bold">{isReadonly ? '查看预约' : '修改预约'}</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-6">
          {/* 访客类型 */}
          <Card>
            <CardHeader>
              <CardTitle>访客类型</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {VISITOR_TYPES.map((item) => (
                  <div
                    key={item.type}
                    className={cn(
                      "relative flex items-center justify-center rounded-lg border-2 p-3 transition-all text-center",
                      isReadonly ? "cursor-default opacity-60" : "cursor-pointer",
                      formData.visitorType === item.type
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-950/50 ring-2 ring-blue-500"
                        : "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
                    )}
                    onClick={() => !isReadonly && selectVisitorType(item.type)}
                  >
                    <span className="font-medium text-sm">{item.label}</span>
                  </div>
                ))}
              </div>
              {/* 隐藏的input用于表单验证 */}
              <input 
                type="hidden" 
                value={formData.visitorType} 
                required 
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>访客信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {formData.visitorCode && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                  <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">访客编号：</span>
                  <span className="font-mono font-bold text-blue-700 dark:text-blue-300">{formData.visitorCode}</span>
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="visitorName">访客姓名 *</Label>
                  <Input
                    id="visitorName"
                    value={formData.visitorName}
                    onChange={(e) => setFormData({ ...formData, visitorName: e.target.value })}
                    required
                    disabled={isReadonly}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="visitorPhone">手机号 *</Label>
                  <Input
                    id="visitorPhone"
                    value={formData.visitorPhone}
                    onChange={(e) => setFormData({ ...formData, visitorPhone: e.target.value })}
                    required
                    disabled={isReadonly}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="visitorIdCard">身份证号</Label>
                  <Input
                    id="visitorIdCard"
                    value={formData.visitorIdCard}
                    onChange={(e) => setFormData({ ...formData, visitorIdCard: e.target.value })}
                    disabled={isReadonly}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company">公司/单位</Label>
                  <Input
                    id="company"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    disabled={isReadonly}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="visitorCount">访客人数</Label>
                  <Input
                    id="visitorCount"
                    type="number"
                    min="1"
                    value={formData.visitorCount}
                    onChange={(e) => setFormData({ ...formData, visitorCount: parseInt(e.target.value) || 1 })}
                    disabled={isReadonly}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="licensePlate">
                    车牌号
                    {formData.visitorType === 'delivery' && (
                      <span className="text-red-500 ml-1">*</span>
                    )}
                  </Label>
                  <Input
                    id="licensePlate"
                    value={formData.licensePlate}
                    onChange={(e) => setFormData({ ...formData, licensePlate: e.target.value })}
                    placeholder={formData.visitorType === 'delivery' ? '送货/装货人员必须填写车牌号' : '请输入车牌号（如有多辆车，请在随行人员中添加）'}
                    className={formData.visitorType === 'delivery' && !formData.licensePlate ? 'border-red-300' : ''}
                    disabled={isReadonly}
                  />
                  {formData.visitorType === 'delivery' && !formData.licensePlate && (
                    <p className="text-xs text-red-500">送货/装货人员必须填写车牌号</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 随行人员信息 */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">随行人员</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">如有随行人员，请填写信息</p>
                </div>
                {!isReadonly && (
                  <Button type="button" variant="outline" size="sm" onClick={addFollower}>
                    <Plus className="mr-1 h-4 w-4" />
                    添加随行人员
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
            <div className="space-y-4">
              {followers.map((follower, index) => (
                <div key={follower.id || index} className="rounded-lg border p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-medium">随行人员 {index + 1}</span>
                    {!isReadonly && followers.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFollower(index)}
                      >
                        删除
                      </Button>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <Input
                        placeholder="姓名"
                        value={follower.name}
                        onChange={(e) => updateFollower(index, 'name', e.target.value)}
                        disabled={isReadonly}
                      />
                    </div>
                    <div>
                      <Input
                        placeholder="手机号"
                        value={follower.phone}
                        onChange={(e) => updateFollower(index, 'phone', e.target.value)}
                        disabled={isReadonly}
                      />
                    </div>
                    <div>
                      <Input
                        placeholder="车牌号（选填）"
                        value={follower.licensePlate}
                        onChange={(e) => updateFollower(index, 'licensePlate', e.target.value)}
                        disabled={isReadonly}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              总人数：{1 + followers.filter(f => f.name).length} 人（主访客 + {followers.filter(f => f.name).length} 名随行人员）
            </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>访问信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="visitObject">受访人 *</Label>
                  <Input
                    id="visitObject"
                    value={formData.visitObject}
                    onChange={(e) => setFormData({ ...formData, visitObject: e.target.value })}
                    required
                    disabled={isReadonly}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="visitPurpose">来访事由 *</Label>
                  <Input
                    id="visitPurpose"
                    value={formData.visitPurpose}
                    onChange={(e) => setFormData({ ...formData, visitPurpose: e.target.value })}
                    required
                    disabled={isReadonly}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>预约时间</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>预约日期 *</Label>
                  {isReadonly ? (
                    <div className="flex h-10 items-center rounded-md border px-3 text-sm bg-muted/50">
                      <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
                      {format(formData.appointmentDate, 'yyyy年MM月dd日')}
                    </div>
                  ) : (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
                        <Calendar className="mr-2 h-4 w-4" />
                        {format(formData.appointmentDate, 'yyyy年MM月dd日')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <CalendarComponent
                        mode="single"
                        selected={formData.appointmentDate}
                        onSelect={(date) => date && setFormData({ ...formData, appointmentDate: date })}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>入场时间 *</Label>
                  {isReadonly ? (
                    <div className="flex h-10 items-center rounded-md border px-3 text-sm bg-muted/50">{formData.entryTime || '--'}</div>
                  ) : (
                    <TimePicker
                      value={formData.entryTime}
                      onChange={(v) => setFormData({ ...formData, entryTime: v })}
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <Label>离场时间 *</Label>
                  {isReadonly ? (
                    <div className="flex h-10 items-center rounded-md border px-3 text-sm bg-muted/50">{formData.exitTime || '--'}</div>
                  ) : (
                    <TimePicker
                      value={formData.exitTime}
                      onChange={(v) => setFormData({ ...formData, exitTime: v })}
                    />
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="needMeal"
                  checked={formData.needMeal}
                  onCheckedChange={(checked) => setFormData({ ...formData, needMeal: checked as boolean })}
                  disabled={isReadonly}
                />
                <Label htmlFor="needMeal">需要提供就餐</Label>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>备注</CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="备注信息"
                disabled={isReadonly}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Link href="/my-appointments">
              <Button type="button" variant="outline">{isReadonly ? '返回' : '取消'}</Button>
            </Link>
            {!isReadonly && (
              <Button type="submit" disabled={isSaving}>
                {isSaving ? '保存中...' : '保存修改'}
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

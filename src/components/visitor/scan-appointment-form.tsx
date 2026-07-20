'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { TimePicker } from '@/components/ui/time-picker';
import { CalendarIcon, Plus, Trash2, Users, Briefcase, FileText, Star, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { VISITOR_TYPE_CONFIG } from '@/lib/schema';
import HostContactSearch from './host-contact-search';

// 访客类型分组配置
const VISITOR_CATEGORIES = [
  {
    key: 'business',
    label: '业务类',
    icon: Briefcase,
    color: 'blue',
    description: '商务合作相关人员',
    types: [
      { type: 'customer', label: '客户' },
    ],
  },
  {
    key: 'affairs',
    label: '事务类',
    icon: FileText,
    color: 'green',
    description: '日常事务相关人员',
    types: [
      { type: 'supplier', label: '供应商' },
      { type: 'applicant', label: '应聘者' },
      { type: 'delivery', label: '送货/装货人员' },
    ],
  },
  {
    key: 'special',
    label: '特殊类',
    icon: Star,
    color: 'orange',
    description: '特殊访客',
    types: [
      { type: 'government', label: '政府人员' },
      { type: 'visit', label: '参观访客' },
    ],
  },
];

const VISITOR_TYPE_LABELS: Record<string, string> = {
  customer: '客户',
  supplier: '供应商',
  applicant: '应聘者',
  delivery: '送货/装货人员',
  government: '政府人员',
  visit: '参观访客',
};

interface ScanAppointmentFormProps {
  onSuccess?: () => void;
  reviewEnabled?: boolean;
}

export default function ScanAppointmentForm({ onSuccess, reviewEnabled = true }: ScanAppointmentFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedAppointment, setSubmittedAppointment] = useState<any>(null);
  const [hostContactValid, setHostContactValid] = useState(false);
  const [formData, setFormData] = useState({
    visitorName: '',
    visitorIdCard: '',
    visitorPhone: '',
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

  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 验证访客类型
    if (!formData.visitorType) {
      toast.error('请选择访客类型');
      return;
    }

    // 送货/装货类型必须填写车牌号
    if (formData.visitorType === 'delivery' && !formData.licensePlate.trim()) {
      toast.error('送货/装货人员必须填写车牌号');
      return;
    }
    
    setIsLoading(true);

    try {
      const visitorType = formData.visitorType;
      const visitorCategory = VISITOR_TYPE_CONFIG[visitorType]?.category || '';

      // 计算随行人数（随访人员数量）
      const followerCount = followers.filter(f => f.name).length;
      const visitorCount = followerCount + 1; // 主访客 + 随访人员

      const response = await fetch('/api/scan-appointment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          visitorCount,
          followers: followers.filter(f => f.name),
          // 使用本地时间格式避免时区问题
          appointmentDate: `${formData.appointmentDate.getFullYear()}-${String(formData.appointmentDate.getMonth() + 1).padStart(2, '0')}-${String(formData.appointmentDate.getDate()).padStart(2, '0')}`,
          appointmentTime: `${formData.entryTime}-${formData.exitTime}`,
          visitorCategory,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSubmitted(true);
        setSubmittedAppointment(data);
        toast.success(data.message || '预约提交成功！');
      } else {
        const error = await response.json();
        toast.error(error.error || '预约提交失败');
      }
    } catch (error) {
      toast.error('网络错误，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  // 添加随访人员
  const addFollower = () => {
    setFollowers([...followers, { id: Date.now().toString(), name: '', phone: '', licensePlate: '' }]);
  };

  // 删除随访人员
  const removeFollower = (index: number) => {
    if (followers.length > 1) {
      setFollowers(followers.filter((_, i) => i !== index));
    }
  };

  // 更新随访人员信息
  const updateFollower = (index: number, field: 'name' | 'phone' | 'licensePlate', value: string) => {
    const newFollowers = [...followers];
    newFollowers[index][field] = value;
    setFollowers(newFollowers);
  };

  // 选择访客类型
  const selectVisitorType = (type: string) => {
    setFormData({ ...formData, visitorType: type });
  };

  // 重新预约
  const handleReset = () => {
    setSubmitted(false);
    setFormData({
      visitorName: '',
      visitorIdCard: '',
      visitorPhone: '',
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
    setFollowers([{ id: '', name: '', phone: '', licensePlate: '' }]);
    onSuccess?.();
  };

  // 提交成功页面
  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">预约提交成功</h2>
          <p className="text-gray-500 mb-6">
            {submittedAppointment?.reviewEnabled
              ? '您的访客预约已成功提交！请等待受访人审批通过后，于预约日期到门岗签到。'
              : '您的访客预约已成功提交！请在约定时间到达门岗签到。'}
          </p>
          <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
            <div className="text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">访客姓名</span>
                <span className="font-medium">{formData.visitorName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">预约日期</span>
                <span className="font-medium">{format(formData.appointmentDate, 'yyyy年MM月dd日')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">来访事由</span>
                <span className="font-medium">{formData.visitPurpose}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">访客类型</span>
                <span className="font-medium">{VISITOR_TYPE_LABELS[formData.visitorType]}</span>
              </div>
            </div>
          </div>
          <Button onClick={handleReset} className="w-full">
            继续预约
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleCreateAppointment} className="space-y-4 p-4 max-w-lg mx-auto">
      {/* 页面标题 */}
      <div className="text-center py-4">
        <h1 className="text-xl font-bold text-gray-900">访客预约登记</h1>
        <p className="text-sm text-gray-500 mt-1">请填写访客信息进行预约</p>
      </div>

      {/* 访客类型选择 */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="mb-4">
          <Label className="text-base font-semibold">访客类型</Label>
          <p className="text-xs text-gray-500 mt-1">请选择访客类型</p>
        </div>
        
        <div className="space-y-4">
          {VISITOR_CATEGORIES.map((category) => {
            const IconComponent = category.icon;
            const colorStyles = {
              blue: {
                icon: 'text-blue-600',
                selected: 'border-blue-500 bg-blue-50',
              },
              green: {
                icon: 'text-green-600',
                selected: 'border-green-500 bg-green-50',
              },
              orange: {
                icon: 'text-orange-600',
                selected: 'border-orange-500 bg-orange-50',
              },
            };
            const styles = colorStyles[category.color as keyof typeof colorStyles];
            
            return (
              <div key={category.key} className="space-y-2">
                {/* 分类标题 */}
                <div className="flex items-center gap-2 text-sm">
                  <IconComponent className={cn('h-4 w-4', styles.icon)} />
                  <span className="font-medium">{category.label}</span>
                </div>
                
                {/* 类型选项 */}
                <div className="grid grid-cols-2 gap-2">
                  {category.types.map((item) => (
                    <div
                      key={item.type}
                      className={cn(
                        "rounded-lg border-2 p-3 transition-all cursor-pointer text-center",
                        formData.visitorType === item.type
                          ? styles.selected
                          : "border-gray-200 bg-white hover:border-gray-300"
                      )}
                      onClick={() => selectVisitorType(item.type)}
                    >
                      <span className="text-sm font-medium">{item.label}</span>
                      {formData.visitorType === item.type && (
                        <CheckCircle2 className="w-4 h-4 inline ml-1 text-green-600" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 访客信息 */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="mb-4">
          <Label className="text-base font-semibold">访客信息</Label>
        </div>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="visitorName" className="text-sm">姓名 <span className="text-red-500">*</span></Label>
            <Input
              id="visitorName"
              value={formData.visitorName}
              onChange={(e) => setFormData({ ...formData, visitorName: e.target.value })}
              required
              placeholder="请输入访客姓名"
              className="h-10"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="visitorPhone" className="text-sm">手机号 <span className="text-red-500">*</span></Label>
            <Input
              id="visitorPhone"
              type="tel"
              value={formData.visitorPhone}
              onChange={(e) => setFormData({ ...formData, visitorPhone: e.target.value })}
              required
              placeholder="请输入手机号"
              className="h-10"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="visitorIdCard" className="text-sm">身份证号</Label>
            <Input
              id="visitorIdCard"
              value={formData.visitorIdCard}
              onChange={(e) => setFormData({ ...formData, visitorIdCard: e.target.value })}
              placeholder="请输入身份证号（选填）"
              className="h-10"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="company" className="text-sm">公司/单位</Label>
            <Input
              id="company"
              value={formData.company}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              placeholder="请输入公司或单位名称"
              className="h-10"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="licensePlate" className="text-sm">
              车牌号
              {formData.visitorType === 'delivery' && (
                <span className="text-red-500 ml-1">*</span>
              )}
            </Label>
            <Input
              id="licensePlate"
              value={formData.licensePlate}
              onChange={(e) => setFormData({ ...formData, licensePlate: e.target.value })}
              placeholder={formData.visitorType === 'delivery' ? '送货/装货人员必须填写车牌号' : '请输入车牌号（选填）'}
              className={`h-10 ${formData.visitorType === 'delivery' && !formData.licensePlate ? 'border-red-300' : ''}`}
            />
            {formData.visitorType === 'delivery' && !formData.licensePlate && (
              <p className="text-xs text-red-500">送货/装货人员必须填写车牌号</p>
            )}
          </div>
        </div>
      </div>

      {/* 来访信息 */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="mb-4">
          <Label className="text-base font-semibold">来访信息</Label>
        </div>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="visitObject" className="text-sm">受访人 <span className="text-red-500">*</span></Label>
            <HostContactSearch
              value={formData.visitObject}
              onChange={(v) => setFormData({ ...formData, visitObject: v })}
              onValidChange={setHostContactValid}
              placeholder="请输入受访人姓名（必选清单中人员）"
              required
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="visitPurpose" className="text-sm">来访事由 <span className="text-red-500">*</span></Label>
            <Input
              id="visitPurpose"
              value={formData.visitPurpose}
              onChange={(e) => setFormData({ ...formData, visitPurpose: e.target.value })}
              required
              placeholder="请输入来访事由"
              className="h-10"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-sm">预约日期 <span className="text-red-500">*</span></Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal h-10",
                    !formData.appointmentDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.appointmentDate ? (
                    format(formData.appointmentDate, 'yyyy年MM月dd日')
                  ) : (
                    <span>请选择日期</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={formData.appointmentDate}
                  onSelect={(date) => date && setFormData({ ...formData, appointmentDate: date })}
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="entryTime" className="text-sm">入场时间 <span className="text-red-500">*</span></Label>
              <TimePicker
                id="entryTime"
                value={formData.entryTime}
                onChange={(v) => setFormData({ ...formData, entryTime: v })}
                className="h-10"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="exitTime" className="text-sm">离场时间 <span className="text-red-500">*</span></Label>
              <TimePicker
                id="exitTime"
                value={formData.exitTime}
                onChange={(v) => setFormData({ ...formData, exitTime: v })}
                className="h-10"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <Checkbox
              id="needMeal"
              checked={formData.needMeal}
              onCheckedChange={(checked) => setFormData({ ...formData, needMeal: checked as boolean })}
            />
            <label htmlFor="needMeal" className="text-sm font-medium">
              是否需要就餐
            </label>
          </div>
        </div>
      </div>

      {/* 随行人员 */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <Label className="text-base font-semibold">随行人员</Label>
            <p className="text-xs text-gray-500 mt-1">如有随行人员请添加</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addFollower}>
            <Plus className="h-4 w-4 mr-1" />
            添加
          </Button>
        </div>
        
        <div className="space-y-3">
          {followers.map((follower, index) => (
            <div key={follower.id || index} className="p-3 bg-gray-50 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500">随行人员 {index + 1}</span>
                {followers.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-red-500"
                    onClick={() => removeFollower(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="姓名"
                  value={follower.name}
                  onChange={(e) => updateFollower(index, 'name', e.target.value)}
                  className="h-9 text-sm"
                />
                <Input
                  placeholder="手机号"
                  value={follower.phone}
                  onChange={(e) => updateFollower(index, 'phone', e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <Input
                placeholder="车牌号（选填）"
                value={follower.licensePlate}
                onChange={(e) => updateFollower(index, 'licensePlate', e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          ))}
        </div>
      </div>

      {/* 提交按钮 */}
      <Button
        type="submit"
        className="w-full h-12 text-base"
        disabled={isLoading || (!hostContactValid && formData.visitObject.trim().length > 0)}
      >
        {isLoading ? '提交中...' : '提交预约'}
      </Button>

      {/* 底部提示 */}
      <p className="text-xs text-center text-gray-400 pb-4">
        {reviewEnabled
          ? '提交后需受访人审批通过，请耐心等待'
          : '提交后将自动通过，可直接前往门岗签到'}
      </p>
    </form>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TimePicker } from '@/components/ui/time-picker';
import { CalendarIcon, Plus, Trash2, Users, Briefcase, FileText, Star } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { VISITOR_TYPE, VISITOR_TYPE_CONFIG } from '@/lib/schema';

interface CurrentUser {
  id: number;
  username: string;
  name: string;
  role: string;
}

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

interface AppointmentManagementProps {
  isPublic?: boolean;
}

export default function AppointmentManagement({ isPublic = false }: AppointmentManagementProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [hostContacts, setHostContacts] = useState<any[]>([]);
  const [hostContactSearch, setHostContactSearch] = useState('');
  const [showHostContactList, setShowHostContactList] = useState(false);
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
    notes: '',
  });

  // 获取当前用户信息
  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.id) {
          setCurrentUser(data);
          // 自动填入当前用户名到受访人（非公开预约）
          if (!isPublic && data.name) {
            setFormData(prev => ({ ...prev, visitObject: data.name }));
          }
        }
      })
      .catch(console.error);
  }, [isPublic]);

  // 获取受访人列表
  useEffect(() => {
    fetch('/api/host-contacts')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setHostContacts(data);
        }
      })
      .catch(console.error);
  }, []);

  // 过滤受访人列表
  const filteredHostContacts = hostContacts.filter(c =>
    c.name.includes(hostContactSearch) || c.department.includes(hostContactSearch)
  );

  // 选择受访人
  const selectHostContact = (contact: any) => {
    setFormData(prev => ({ ...prev, visitObject: contact.name }));
    setHostContactSearch('');
    setShowHostContactList(false);
  };

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

      // 公开预约使用 /api/scan-appointment，内部使用 /api/appointments
      const apiUrl = isPublic ? '/api/scan-appointment' : '/api/appointments';

      // 公开预约时，设置默认访客类型（由被访人在审核时确认）
      // 使用本地时间格式（YYYY-MM-DD）避免时区转换问题
      // toISOString()会转UTC导致日期偏移
      const formatDateForServer = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const submitData = isPublic
        ? {
            ...formData,
            visitorType: 'customer', // 默认访客类型，由被访人审核时确认
            visitorCategory: 'business',
            visitorCount,
            followers: followers.filter(f => f.name),
            appointmentDate: formatDateForServer(formData.appointmentDate),
            appointmentTime: `${formData.entryTime}-${formData.exitTime}`,
            applicantId: 'visitor',
            applicantName: formData.visitorName,
          }
        : {
            ...formData,
            visitorCount,
            followers: followers.filter(f => f.name),
            appointmentDate: formatDateForServer(formData.appointmentDate),
            appointmentTime: `${formData.entryTime}-${formData.exitTime}`,
            visitorCategory,
            applicantId: currentUser?.username || 'unknown',
            applicantName: currentUser?.name || '未知用户',
          };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData),
      });

      if (response.ok) {
        if (isPublic) {
          // 公开预约显示成功提示并跳转
          const data = await response.json();
          toast.success(data.message || '预约提交成功！');
        } else {
          toast.success('预约创建成功！');
        }
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
          notes: '',
        });
        setFollowers([{ id: '', name: '', phone: '', licensePlate: '' }]);
      } else {
        const error = await response.json();
        if (error.duplicate) {
          toast.error(error.error || '检测到重复预约');
        } else {
          toast.error(error.error || '预约创建失败');
        }
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

  return (
    <form onSubmit={handleCreateAppointment} className="space-y-6 max-w-4xl mx-auto">
      {/* 访客类型选择 - 仅非公开预约显示 */}
      {!isPublic && (
        <div className="rounded-lg border bg-white dark:bg-slate-900 p-6">
          <div className="mb-6">
            <Label className="text-base font-semibold">访客类型</Label>
            <p className="text-sm text-muted-foreground mt-1">请选择访客类型（单选），系统会自动分配相应的通行权限</p>
          </div>
          
          <div className="space-y-6">
            {VISITOR_CATEGORIES.map((category) => {
              const IconComponent = category.icon;
              const colorStyles = {
                blue: {
                  header: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800',
                  icon: 'text-blue-600 dark:text-blue-400',
                  badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
                  selected: 'border-blue-500 bg-blue-50 dark:bg-blue-950/50 ring-2 ring-blue-500',
                },
                green: {
                  header: 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800',
                  icon: 'text-green-600 dark:text-green-400',
                  badge: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
                  selected: 'border-green-500 bg-green-50 dark:bg-green-950/50 ring-2 ring-green-500',
                },
                orange: {
                  header: 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800',
                  icon: 'text-orange-600 dark:text-orange-400',
                  badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300',
                  selected: 'border-orange-500 bg-orange-50 dark:bg-orange-950/50 ring-2 ring-orange-500',
                },
              };
              const styles = colorStyles[category.color as keyof typeof colorStyles];
              
              return (
                <div key={category.key} className="space-y-3">
                  {/* 分类标题 */}
                  <div className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-lg border',
                    styles.header
                  )}>
                    <IconComponent className={cn('h-5 w-5', styles.icon)} />
                    <div className="flex-1">
                      <span className="font-semibold">{category.label}</span>
                      <span className="text-sm text-muted-foreground ml-2">({category.description})</span>
                    </div>
                  </div>
                  
                  {/* 该分类下的类型选项 - 使用简单的可点击卡片 */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 pl-2">
                    {category.types.map((item) => (
                      <div
                        key={item.type}
                        className={cn(
                          "relative flex items-center justify-between rounded-lg border-2 p-4 transition-all cursor-pointer",
                          formData.visitorType === item.type
                            ? styles.selected
                            : "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
                        )}
                        onClick={() => selectVisitorType(item.type)}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all",
                            formData.visitorType === item.type
                              ? "border-current"
                              : "border-slate-300 dark:border-slate-600"
                          )}>
                            {formData.visitorType === item.type && (
                              <div className={cn("w-2 h-2 rounded-full", 
                                category.color === 'blue' && 'bg-blue-500',
                                category.color === 'green' && 'bg-green-500',
                                category.color === 'orange' && 'bg-orange-500'
                              )} />
                            )}
                          </div>
                          <span className="font-medium">{item.label}</span>
                        </div>
                        {formData.visitorType === item.type && (
                          <div className={cn('text-xs px-2 py-0.5 rounded', styles.badge)}>
                            已选
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* 隐藏的input用于表单验证 */}
          <input 
            type="hidden" 
            value={formData.visitorType} 
            required 
            onChange={() => {}}
          />
        </div>
      )}

      {/* 公开预约提示 */}
      {isPublic && (
        <div className="rounded-lg border bg-blue-50 dark:bg-blue-950/30 p-4 mb-6">
          <p className="text-sm text-blue-800 dark:text-blue-300">
            <strong>提示：</strong>访客类型和是否就餐将由被访人在审核时确认。请填写您的基本信息和随访人员（如有）。
          </p>
        </div>
      )}

      {/* 访客信息 */}
      <div className="rounded-lg border bg-white dark:bg-slate-900 p-6">
        <div className="mb-4">
          <Label className="text-base font-semibold">访客信息</Label>
          <p className="text-sm text-muted-foreground mt-1">请填写主访客的基本信息</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="visitorName">姓名 *</Label>
            <Input
              id="visitorName"
              value={formData.visitorName}
              onChange={(e) => setFormData({ ...formData, visitorName: e.target.value })}
              required
              placeholder="请输入访客姓名"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="visitorPhone">手机号 *</Label>
            <Input
              id="visitorPhone"
              value={formData.visitorPhone}
              onChange={(e) => setFormData({ ...formData, visitorPhone: e.target.value })}
              required
              placeholder="请输入手机号"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="visitorIdCard">身份证号</Label>
            <Input
              id="visitorIdCard"
              value={formData.visitorIdCard}
              onChange={(e) => setFormData({ ...formData, visitorIdCard: e.target.value })}
              placeholder="请输入身份证号（选填）"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="company">公司/单位</Label>
            <Input
              id="company"
              value={formData.company}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              placeholder="请输入公司或单位名称"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="visitObject">受访人 *</Label>
            <div className="relative">
              <Input
                id="visitObject"
                value={formData.visitObject}
                onChange={(e) => {
                  setFormData({ ...formData, visitObject: e.target.value });
                  setHostContactSearch(e.target.value);
                  setShowHostContactList(true);
                }}
                onFocus={() => setShowHostContactList(true)}
                required
                placeholder="输入或选择受访人"
              />
              {showHostContactList && filteredHostContacts.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredHostContacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer text-sm"
                      onClick={() => selectHostContact(contact)}
                    >
                      <div className="font-medium">{contact.name}</div>
                      <div className="text-xs text-muted-foreground">{contact.department} - {contact.position || '员工'}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">可直接输入或从受访人清单中选择</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="visitPurpose">来访事由 *</Label>
            <Input
              id="visitPurpose"
              value={formData.visitPurpose}
              onChange={(e) => setFormData({ ...formData, visitPurpose: e.target.value })}
              required
              placeholder="请输入来访事由"
            />
          </div>

          <div className="space-y-2">
            <Label>预约日期 *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
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
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={formData.appointmentDate}
                  onSelect={(date) => date && setFormData({ ...formData, appointmentDate: date })}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="entryTime">入场时间 *</Label>
            <TimePicker
              id="entryTime"
              value={formData.entryTime}
              onChange={(v) => setFormData({ ...formData, entryTime: v })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="exitTime">离场时间 *</Label>
            <TimePicker
              id="exitTime"
              value={formData.exitTime}
              onChange={(v) => setFormData({ ...formData, exitTime: v })}
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
            />
            {formData.visitorType === 'delivery' && !formData.licensePlate && (
              <p className="text-xs text-red-500">送货/装货人员必须填写车牌号</p>
            )}
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="notes">备注</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="请输入备注信息（选填）"
              rows={3}
            />
          </div>
        </div>
      </div>

      {/* 随访人员信息 */}
      <div className="rounded-lg border bg-white dark:bg-slate-900 p-6">
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base font-semibold">随行人员</Label>
              <p className="text-sm text-muted-foreground mt-1">如有随行人员，请填写信息</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addFollower}>
              <Plus className="mr-1 h-4 w-4" />
              添加随行人员
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          {followers.map((follower, index) => (
            <div key={follower.id || index} className="rounded-lg border p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium">随行人员 {index + 1}</span>
                {followers.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFollower(index)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <Input
                    placeholder="姓名"
                    value={follower.name}
                    onChange={(e) => updateFollower(index, 'name', e.target.value)}
                  />
                </div>
                <div>
                  <Input
                    placeholder="电话"
                    value={follower.phone}
                    onChange={(e) => updateFollower(index, 'phone', e.target.value)}
                  />
                </div>
                <div>
                  <Input
                    placeholder="车牌号（选填）"
                    value={follower.licensePlate}
                    onChange={(e) => updateFollower(index, 'licensePlate', e.target.value)}
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
      </div>

      {/* 提交按钮 */}
      <div className="flex justify-end gap-3">
        <Link href="/">
          <Button type="button" variant="outline">
            取消
          </Button>
        </Link>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? '提交中...' : '提交预约'}
        </Button>
      </div>
    </form>
  );
}

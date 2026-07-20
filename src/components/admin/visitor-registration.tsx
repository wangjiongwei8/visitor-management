'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import { CalendarIcon, CheckCircle2, Plus, Trash2, Car, Users } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { VISITOR_TYPE, VISITOR_CATEGORY, VISITOR_TYPE_CONFIG, PASS_COLOR } from '@/lib/schema';

interface VehicleInfo {
  licensePlate: string;
  vehicleModel: string;
  vehicleType: string;
}

interface EntourageInfo {
  name: string;
  phone: string;
  vehicleIds: number[]; // 关联的车辆索引
  licensePlate: string; // 车牌号（可直接输入）
}

export default function VisitorRegistration() {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    company: '',
    visitPurpose: '',
    visitObject: '',
    visitObjectPhone: '',
    visitDate: new Date(),
    notes: '',
    visitorType: '', // 访客类型
    totalVisitors: 1, // 总来访人数（包含主访客）
    vehicleInfo: [] as VehicleInfo[],
    entourageInfo: [] as EntourageInfo[],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // 获取访客类型对应的类别
  const getVisitorCategory = (type: string) => {
    const config = VISITOR_TYPE_CONFIG[type];
    return config?.category || '';
  };

  // 获取通行牌颜色
  const getPassColor = (type: string) => {
    const config = VISITOR_TYPE_CONFIG[type];
    return config?.passColor || '';
  };

  // 当前随行人员数量
  const entourageCount = formData.entourageInfo.length;

  // 处理总来访人数变化（自动更新随行人员数量）
  const handleTotalVisitorsChange = (value: number) => {
    if (value < 1) return; // 至少1人（主访客）
    const newEntourageCount = value - 1;

    if (newEntourageCount > formData.entourageInfo.length) {
      // 需要增加随行人员
      const additionalCount = newEntourageCount - formData.entourageInfo.length;
      const newEntourage = [
        ...formData.entourageInfo,
        ...Array(additionalCount).fill(null).map(() => ({
          name: '',
          phone: '',
          vehicleIds: [] as number[],
          licensePlate: ''
        }))
      ];
      handleInputChange('entourageInfo', newEntourage);
    } else if (newEntourageCount < formData.entourageInfo.length) {
      // 需要减少随行人员
      const trimmedEntourage = formData.entourageInfo.slice(0, newEntourageCount);
      handleInputChange('entourageInfo', trimmedEntourage);
    }

    handleInputChange('totalVisitors', value);
  };

  // 添加随行人员（独立功能）
  const handleAddEntourage = () => {
    handleInputChange('entourageInfo', [
      ...formData.entourageInfo,
      { name: '', phone: '', vehicleIds: [], licensePlate: '' }
    ]);
    // 自动更新总人数
    handleInputChange('totalVisitors', formData.entourageInfo.length + 2);
  };

  // 删除随行人员（独立功能）
  const handleRemoveEntourage = (index: number) => {
    const updated = [...formData.entourageInfo];
    updated.splice(index, 1);
    handleInputChange('entourageInfo', updated);
    // 自动更新总人数
    handleInputChange('totalVisitors', updated.length + 1);
  };

  // 处理随行人员车辆关联
  const handleEntourageVehicleToggle = (entourageIndex: number, vehicleIndex: number) => {
    const updated = [...formData.entourageInfo];
    const currentVehicleIds = updated[entourageIndex].vehicleIds;

    if (currentVehicleIds.includes(vehicleIndex)) {
      // 取消关联
      updated[entourageIndex].vehicleIds = currentVehicleIds.filter(id => id !== vehicleIndex);
    } else {
      // 添加关联
      updated[entourageIndex].vehicleIds = [...currentVehicleIds, vehicleIndex];
    }

    handleInputChange('entourageInfo', updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const visitorCategory = getVisitorCategory(formData.visitorType);

      const response = await fetch('/api/visitors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          phone: formData.phone,
          company: formData.company,
          visitPurpose: formData.visitPurpose,
          visitObject: formData.visitObject,
          visitObjectPhone: formData.visitObjectPhone,
          visitDate: formData.visitDate.toISOString(),
          notes: formData.notes,
          visitorType: formData.visitorType,
          visitorCategory,
          totalVisitors: formData.totalVisitors,
          vehicleInfo: formData.vehicleInfo,
          entourageInfo: formData.entourageInfo,
        }),
      });

      if (response.ok) {
        toast.success('访客信息登记成功！');
        setShowSuccess(true);
        setTimeout(() => {
          setShowSuccess(false);
          setFormData({
            name: '',
            phone: '',
            company: '',
            visitPurpose: '',
            visitObject: '',
            visitObjectPhone: '',
            visitDate: new Date(),
            notes: '',
            visitorType: '',
            totalVisitors: 1,
            vehicleInfo: [],
            entourageInfo: [],
          });
        }, 2000);
      } else {
        const error = await response.json();
        toast.error(error.error || '登记失败，请重试');
      }
    } catch (error) {
      toast.error('网络错误，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-6">
      {showSuccess && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-400">
          <CheckCircle2 className="h-5 w-5" />
          <span>访客信息登记成功！</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 访客类型选择 */}
        <div className="space-y-2">
          <Label htmlFor="visitorType">访客类型 *</Label>
          <Select
            value={formData.visitorType}
            onValueChange={(value) => handleInputChange('visitorType', value)}
          >
            <SelectTrigger id="visitorType">
              <SelectValue placeholder="请选择访客类型" />
            </SelectTrigger>
            <SelectContent>
              {/* 业务类 */}
              <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">业务类访客</div>
              <SelectItem value={VISITOR_TYPE.CUSTOMER}>客户</SelectItem>

              {/* 事务类 */}
              <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">事务类访客</div>
              <SelectItem value={VISITOR_TYPE.SUPPLIER}>供应商</SelectItem>
              <SelectItem value={VISITOR_TYPE.APPLICANT}>应聘者</SelectItem>
              <SelectItem value={VISITOR_TYPE.DELIVERY}>送货/装货人员</SelectItem>

              {/* 特殊类 */}
              <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">特殊类访客</div>
              <SelectItem value={VISITOR_TYPE.GOVERNMENT}>政府</SelectItem>
              <SelectItem value={VISITOR_TYPE.VISIT}>参观访客</SelectItem>
            </SelectContent>
          </Select>

          {/* 显示通行牌颜色预览 */}
          {formData.visitorType && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-sm text-muted-foreground">通行牌颜色：</span>
              <div className={cn(
                'inline-flex items-center rounded-full px-3 py-1 text-sm font-medium',
                getPassColor(formData.visitorType) === PASS_COLOR.GREEN && 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-400',
                getPassColor(formData.visitorType) === PASS_COLOR.YELLOW && 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-400',
                getPassColor(formData.visitorType) === PASS_COLOR.RED && 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-400',
              )}>
                {getPassColor(formData.visitorType) === PASS_COLOR.GREEN && '🟢 绿色通行牌'}
                {getPassColor(formData.visitorType) === PASS_COLOR.YELLOW && '🟡 黄色通行牌'}
                {getPassColor(formData.visitorType) === PASS_COLOR.RED && '🔴 红色通行牌'}
              </div>
            </div>
          )}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* 姓名 */}
          <div className="space-y-2">
            <Label htmlFor="name">姓名 *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              required
              placeholder="请输入访客姓名"
            />
          </div>

          {/* 联系电话 */}
          <div className="space-y-2">
            <Label htmlFor="phone">联系电话 *</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              required
              placeholder="请输入联系电话"
              maxLength={11}
            />
          </div>

          {/* 公司 */}
          <div className="space-y-2">
            <Label htmlFor="company">公司/单位</Label>
            <Input
              id="company"
              value={formData.company}
              onChange={(e) => handleInputChange('company', e.target.value)}
              placeholder="请输入公司或单位名称"
            />
          </div>

          {/* 拜访对象 */}
          <div className="space-y-2">
            <Label htmlFor="visitObject">拜访对象 *</Label>
            <Input
              id="visitObject"
              value={formData.visitObject}
              onChange={(e) => handleInputChange('visitObject', e.target.value)}
              required
              placeholder="请输入被访人姓名"
            />
          </div>

          {/* 拜访对象电话 */}
          <div className="space-y-2">
            <Label htmlFor="visitObjectPhone">拜访对象电话</Label>
            <Input
              id="visitObjectPhone"
              type="tel"
              value={formData.visitObjectPhone}
              onChange={(e) => handleInputChange('visitObjectPhone', e.target.value)}
              placeholder="请输入被访人联系电话"
              maxLength={11}
            />
          </div>

          {/* 来访事由 */}
          <div className="space-y-2">
            <Label htmlFor="visitPurpose">来访事由 *</Label>
            <Select value={formData.visitPurpose} onValueChange={(value) => handleInputChange('visitPurpose', value)}>
              <SelectTrigger id="visitPurpose">
                <SelectValue placeholder="请选择来访事由" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="业务洽谈">业务洽谈</SelectItem>
                <SelectItem value="供应商服务交付">供应商服务交付</SelectItem>
                <SelectItem value="货物配送">货物配送</SelectItem>
                <SelectItem value="业务参观">业务参观</SelectItem>
                <SelectItem value="面试">面试</SelectItem>
                <SelectItem value="其他">其他</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 来访日期 */}
          <div className="space-y-2">
            <Label>来访日期 *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !formData.visitDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.visitDate ? format(formData.visitDate, 'yyyy年MM月dd日') : '请选择日期'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={formData.visitDate}
                  onSelect={(date) => date && handleInputChange('visitDate', date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* 来访人数 */}
          <div className="space-y-2">
            <Label>来访人数</Label>
            <div className="rounded-md border px-3 py-2 bg-muted/50">
              <span className="font-medium">{formData.totalVisitors} 人</span>
              <span className="text-sm text-muted-foreground ml-2">
                （主访客 1 人 + 随行人员 {entourageCount} 人）
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              来访人数根据随行人员数量自动计算
            </p>
          </div>
        </div>

        {/* 车辆信息 - 集成到主表单 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <Car className="h-4 w-4" />
              车辆信息（选填）
            </Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                handleInputChange('vehicleInfo', [
                  ...formData.vehicleInfo,
                  { licensePlate: '', vehicleModel: '', vehicleType: 'car' }
                ]);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              添加车辆
            </Button>
          </div>

          {formData.vehicleInfo.length > 0 && (
            <div className="space-y-3">
              {formData.vehicleInfo.map((vehicle, index) => (
                <div key={index} className="rounded-lg border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">车辆 #{index + 1}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => {
                        const updated = formData.vehicleInfo.filter((_, i) => i !== index);
                        handleInputChange('vehicleInfo', updated);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="grid gap-2 md:grid-cols-3">
                    <div>
                      <Input
                        placeholder="车牌号"
                        value={vehicle.licensePlate}
                        onChange={(e) => {
                          const updated = [...formData.vehicleInfo];
                          updated[index].licensePlate = e.target.value;
                          handleInputChange('vehicleInfo', updated);
                        }}
                      />
                    </div>
                    <div>
                      <Input
                        placeholder="车型（如：奥迪A6）"
                        value={vehicle.vehicleModel}
                        onChange={(e) => {
                          const updated = [...formData.vehicleInfo];
                          updated[index].vehicleModel = e.target.value;
                          handleInputChange('vehicleInfo', updated);
                        }}
                      />
                    </div>
                    <div>
                      <Select
                        value={vehicle.vehicleType}
                        onValueChange={(value) => {
                          const updated = [...formData.vehicleInfo];
                          updated[index].vehicleType = value;
                          handleInputChange('vehicleInfo', updated);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="选择车辆类型" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="car">轿车</SelectItem>
                          <SelectItem value="suv">SUV</SelectItem>
                          <SelectItem value="van">商务车</SelectItem>
                          <SelectItem value="truck">货车</SelectItem>
                          <SelectItem value="other">其他</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 随行人员信息 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              随行人员信息（{entourageCount}人）
            </Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddEntourage}
            >
              <Plus className="mr-2 h-4 w-4" />
              添加随行人员
            </Button>
          </div>

          {formData.entourageInfo.length > 0 && (
            <div className="space-y-3">
              {formData.entourageInfo.map((person, index) => (
                <div key={index} className="rounded-lg border p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">随行人员 #{index + 1}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveEntourage(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid gap-2">
                    <Input
                      placeholder="姓名"
                      value={person.name}
                      onChange={(e) => {
                        const updated = [...formData.entourageInfo];
                        updated[index].name = e.target.value;
                        handleInputChange('entourageInfo', updated);
                      }}
                    />
                    <Input
                      placeholder="联系电话"
                      value={person.phone}
                      onChange={(e) => {
                        const updated = [...formData.entourageInfo];
                        updated[index].phone = e.target.value;
                        handleInputChange('entourageInfo', updated);
                      }}
                      maxLength={11}
                    />
                    <Input
                      placeholder="车牌号"
                      value={person.licensePlate}
                      onChange={(e) => {
                        const updated = [...formData.entourageInfo];
                        updated[index].licensePlate = e.target.value;
                        handleInputChange('entourageInfo', updated);
                      }}
                    />
                  </div>

                  {/* 车辆关联 */}
                  {formData.vehicleInfo.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">关联车辆</Label>
                      <div className="flex flex-wrap gap-2">
                        {formData.vehicleInfo.map((vehicle, vIndex) => (
                          <button
                            key={vIndex}
                            type="button"
                            onClick={() => handleEntourageVehicleToggle(index, vIndex)}
                            className={cn(
                              'px-3 py-1.5 text-xs rounded-full border transition-colors',
                              person.vehicleIds.includes(vIndex)
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-background hover:bg-accent border-border'
                            )}
                          >
                            {vehicle.licensePlate || `车辆 ${vIndex + 1}`}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 备注 */}
        <div className="space-y-2">
          <Label htmlFor="notes">备注</Label>
          <Textarea
            id="notes"
            value={formData.notes}
            onChange={(e) => handleInputChange('notes', e.target.value)}
            placeholder="请输入备注信息（选填）"
            rows={3}
          />
        </div>

        {/* 提交按钮 */}
        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? '提交中...' : '提交登记'}
          </Button>
        </div>
      </form>
    </div>
  );
}

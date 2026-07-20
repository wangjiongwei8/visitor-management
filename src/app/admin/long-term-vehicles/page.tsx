'use client';

import * as React from 'react';
import { toast } from 'sonner';
import {
  Car,
  Plus,
  Search,
  RefreshCw,
  Trash2,
  Edit,
  Calendar,
  User,
  Phone,
  Building2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileText,
  Bell,
  Mail,
  UserCheck,
  Shield,
  Eye,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { usePagination } from '@/hooks/use-pagination';
import { DataPagination } from '@/components/ui/data-pagination';

// 入场类型
// 访客类型
const VISITOR_TYPE_OPTIONS = [
  { value: 'customer', label: '客户' },
  { value: 'supplier', label: '供应商' },
  { value: 'applicant', label: '应聘者' },
  { value: 'delivery', label: '送货人员' },
  { value: 'government', label: '政府人员' },
  { value: 'visit', label: '参观访客' },
];

const VISITOR_TYPE_LABELS: Record<string, string> = {
  customer: '客户',
  supplier: '供应商',
  applicant: '应聘者',
  delivery: '送货人员',
  government: '政府人员',
  visit: '参观访客',
};

const ENTRY_TYPE_LABELS: Record<string, string> = {
  vehicle: '车辆',
  person: '人员',
  both: '车辆+人员',
};

const ENTRY_TYPE_COLORS: Record<string, string> = {
  vehicle: 'bg-blue-100 text-blue-800',
  person: 'bg-indigo-100 text-indigo-800',
  both: 'bg-violet-100 text-violet-800',
};

interface LongTermRecord {
  id: number;
  longTermCode: string | null;
  entryType: string;
  licensePlate: string | null;
  vehicleModel: string | null;
  driverName: string | null;
  driverPhone: string | null;
  company: string | null;
  validFrom: string;
  validTo: string;
  status: string;
  allowedAreas: string | null;
  notes: string | null;
  createdBy: string | null;
  createdByName?: string;
  visitorType: string | null;
  personName: string | null;
  personIdCard: string | null;
  personPhone: string | null;
  createdAt: string;
  isOnSite?: boolean;
  lastVisitRecordId?: number | null;
  checkinCount?: number;
  currentStatus?: string;
}

interface UserInfo {
  role: string;
}

export default function LongTermPage() {
  const [records, setRecords] = React.useState<LongTermRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [addDialogOpen, setAddDialogOpen] = React.useState(false);
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [editingRecord, setEditingRecord] = React.useState<LongTermRecord | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [sendingReminders, setSendingReminders] = React.useState(false);
  const [reminderResult, setReminderResult] = React.useState<{
    open: boolean;
    message: string;
    vehicles: any[];
  }>({ open: false, message: '', vehicles: [] });
  // 当前用户角色
  const [userRole, setUserRole] = React.useState<string>('employee');
  // 审批对话框
  const [approveDialogOpen, setApproveDialogOpen] = React.useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = React.useState(false);
  const [approvingRecord, setApprovingRecord] = React.useState<LongTermRecord | null>(null);
  const [rejectionReason, setRejectionReason] = React.useState('');
  // 查看明细对话框
  const [detailDialogOpen, setDetailDialogOpen] = React.useState(false);
  const [detailRecord, setDetailRecord] = React.useState<LongTermRecord | null>(null);

  // 表单数据
  const [formData, setFormData] = React.useState({
    entryType: 'vehicle' as string,
    licensePlate: '',
    vehicleModel: '',
    driverName: '',
    driverPhone: '',
    company: '',
    validFrom: '',
    validTo: '',
    allowedAreas: '',
    notes: '',
    // 访客类型
    visitorType: 'supplier',
    // 人员字段
    personName: '',
    personIdCard: '',
    personPhone: '',
  });

  // 前端按 statusFilter 筛选
  const filteredRecords = React.useMemo(() => {
    if (statusFilter === 'all') return records;
    if (statusFilter === 'active') return records.filter(r => r.status === 'active' && !isExpired(r));
    if (statusFilter === 'pending') return records.filter(r => r.status === 'pending');
    if (statusFilter === 'expiring') return records.filter(r => r.status === 'active' && isExpiringSoon(r));
    if (statusFilter === 'expired') return records.filter(r => isExpired(r) || r.status === 'cancelled' || r.status === 'rejected');
    return records;
  }, [records, statusFilter]);

  // 分页
  const {
    currentPage,
    totalPages,
    pageSize,
    paginatedData: paginatedRecords,
    goToPage,
    setPageSize,
    startIndex,
    endIndex,
  } = usePagination({ data: filteredRecords });

  React.useEffect(() => {
    fetchUserInfo();
    fetchRecords();
  }, []);

  const fetchUserInfo = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUserRole(data.role || 'employee');
      }
    } catch (e) {
      console.error('Failed to fetch user info:', e);
    }
  };

  const isAdmin = userRole === 'admin';

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('query', searchQuery);
      // 管理员拉全量数据，不按 statusFilter 过滤 API
      // statusFilter 只做前端筛选，确保统计卡片数字准确

      const response = await fetch(`/api/long-term-vehicles?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setRecords(data || []);
      } else {
        toast.error('获取长约列表失败');
      }
    } catch (error) {
      console.error('Failed to fetch records:', error);
      toast.error('获取长约列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    const et = formData.entryType;
    if (!formData.validFrom || !formData.validTo) {
      toast.error('请填写有效期');
      return;
    }
    if ((et === 'vehicle' || et === 'both') && !formData.licensePlate) {
      toast.error('请填写车牌号');
      return;
    }
    if ((et === 'person' || et === 'both') && !formData.personName) {
      toast.error('请填写人员姓名');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/long-term-vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast.success(isAdmin ? '添加成功' : '提交成功，等待管理员审批');
        setAddDialogOpen(false);
        resetForm();
        fetchRecords();
      } else {
        const error = await response.json();
        toast.error(error.error || '添加失败');
      }
    } catch (error) {
      console.error('Add failed:', error);
      toast.error('添加失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!editingRecord) return;

    const et = formData.entryType;
    if (!formData.validFrom || !formData.validTo) {
      toast.error('请填写有效期');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/long-term-vehicles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, id: editingRecord.id, action: 'edit' }),
      });

      if (response.ok) {
        toast.success('更新成功');
        setEditDialogOpen(false);
        setEditingRecord(null);
        resetForm();
        fetchRecords();
      } else {
        const error = await response.json();
        toast.error(error.error || '更新失败');
      }
    } catch (error) {
      console.error('Edit failed:', error);
      toast.error('更新失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number, title: string) => {
    if (!confirm(`确定要移除「${title}」吗？`)) return;

    try {
      const response = await fetch(`/api/long-term-vehicles?id=${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('移除成功');
        fetchRecords();
      } else {
        toast.error('移除失败');
      }
    } catch (error) {
      console.error('Delete failed:', error);
      toast.error('移除失败');
    }
  };

  const handleToggleStatus = async (record: LongTermRecord) => {
    const newStatus = record.status === 'active' ? 'cancelled' : 'active';
    const actionText = newStatus === 'active' ? '启用' : '停用';

    try {
      const response = await fetch('/api/long-term-vehicles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: record.id, status: newStatus, action: 'edit' }),
      });

      if (response.ok) {
        toast.success(`${actionText}成功`);
        fetchRecords();
      } else {
        toast.error(`${actionText}失败`);
      }
    } catch (error) {
      console.error('Toggle status failed:', error);
      toast.error(`${actionText}失败`);
    }
  };

  // 审批通过
  const handleApprove = async () => {
    if (!approvingRecord) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/long-term-vehicles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: approvingRecord.id, action: 'approve' }),
      });
      if (res.ok) {
        toast.success('审批通过');
        setApproveDialogOpen(false);
        setApprovingRecord(null);
        fetchRecords();
      } else {
        toast.error('审批失败');
      }
    } catch {
      toast.error('审批失败');
    } finally {
      setSubmitting(false);
    }
  };

  // 审批驳回
  const handleReject = async () => {
    if (!approvingRecord) return;
    if (!rejectionReason.trim()) {
      toast.error('请填写驳回原因');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/long-term-vehicles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: approvingRecord.id, action: 'reject', rejectionReason }),
      });
      if (res.ok) {
        toast.success('已驳回');
        setRejectDialogOpen(false);
        setApprovingRecord(null);
        setRejectionReason('');
        fetchRecords();
      } else {
        toast.error('驳回失败');
      }
    } catch {
      toast.error('驳回失败');
    } finally {
      setSubmitting(false);
    }
  };

  // UTC 存储的 timestamp 转为上海时区 YYYY-MM-DD（用于 date input）
  const fmtDateShanghai = (d: string | Date | null | undefined): string => {
    if (!d) return '';
    const date = typeof d === 'string' ? new Date(d) : d;
    const shanghaiOffset = 8 * 60;
    const shanghaiTime = new Date(date.getTime() + shanghaiOffset * 60 * 1000);
    return `${shanghaiTime.getUTCFullYear()}-${String(shanghaiTime.getUTCMonth() + 1).padStart(2, '0')}-${String(shanghaiTime.getUTCDate()).padStart(2, '0')}`;
  };

  const openEditDialog = (record: LongTermRecord) => {
    setEditingRecord(record);
    setFormData({
      entryType: record.entryType || 'vehicle',
      licensePlate: record.licensePlate || '',
      vehicleModel: record.vehicleModel || '',
      driverName: record.driverName || '',
      driverPhone: record.driverPhone || '',
      company: record.company || '',
      validFrom: fmtDateShanghai(record.validFrom),
      validTo: fmtDateShanghai(record.validTo),
      allowedAreas: record.allowedAreas || '',
      notes: record.notes || '',
      personName: record.personName || '',
      personIdCard: record.personIdCard || '',
      personPhone: record.personPhone || '',
      visitorType: record.visitorType || 'supplier',
    });
    setEditDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      entryType: 'vehicle',
      licensePlate: '',
      vehicleModel: '',
      driverName: '',
      driverPhone: '',
      company: '',
      validFrom: '',
      validTo: '',
      allowedAreas: '',
      notes: '',
      visitorType: 'supplier',
      personName: '',
      personIdCard: '',
      personPhone: '',
    });
  };

  // 发送过期提醒（仅管理员）
  const handleSendReminders = async () => {
    setSendingReminders(true);
    try {
      const response = await fetch('/api/long-term-vehicles/send-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 7 }),
      });

      const data = await response.json();

      if (response.ok) {
        setReminderResult({
          open: true,
          message: data.message,
          vehicles: data.vehicles || [],
        });
        toast.success(data.message);
      } else {
        toast.error(data.error || '发送提醒失败');
      }
    } catch (error) {
      console.error('Send reminders failed:', error);
      toast.error('发送提醒失败');
    } finally {
      setSendingReminders(false);
    }
  };

  // 检查是否已过期
  const isExpired = (record: LongTermRecord) => {
    return new Date(record.validTo) < new Date();
  };

  // 检查是否即将过期（7天内）
  const isExpiringSoon = (record: LongTermRecord) => {
    const validTo = new Date(record.validTo);
    const now = new Date();
    const diffDays = Math.ceil((validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays > 0 && diffDays <= 7;
  };

  const getStatusBadge = (record: LongTermRecord) => {
    if (record.status === 'cancelled') {
      return <Badge className="bg-gray-100 text-gray-800">已停用</Badge>;
    }
    if (record.status === 'rejected') {
      return <Badge className="bg-red-100 text-red-800">已驳回</Badge>;
    }
    if (record.status === 'pending') {
      return <Badge className="bg-yellow-100 text-yellow-800">待审批</Badge>;
    }
    if (isExpired(record)) {
      return <Badge className="bg-red-100 text-red-800">已过期</Badge>;
    }
    if (isExpiringSoon(record)) {
      return <Badge className="bg-orange-100 text-orange-800">即将过期</Badge>;
    }
    return <Badge className="bg-green-100 text-green-800">有效</Badge>;
  };

  // 获取记录标题（用于删除确认）
  const getRecordTitle = (record: LongTermRecord) => {
    const et = record.entryType || 'vehicle';
    if (et === 'person') return `人员: ${record.personName || '-'}`;
    if (et === 'both') return `${record.personName || '-'} / ${record.licensePlate || '-'}`;
    return `车辆: ${record.licensePlate || '-'}`;
  };

  // 统计
  const stats = {
    total: records.length,
    active: records.filter(r => r.status === 'active' && !isExpired(r)).length,
    pending: records.filter(r => r.status === 'pending').length,
    expiring: records.filter(r => r.status === 'active' && isExpiringSoon(r)).length,
    expired: records.filter(v => isExpired(v) || v.status === 'cancelled' || v.status === 'rejected').length,
  };

  // 根据入场类型显示主标识
  const getPrimaryIcon = (record: LongTermRecord) => {
    const et = record.entryType || 'vehicle';
    if (et === 'person') return User;
    if (et === 'both') return Shield;
    return Car;
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">长约管理</h1>
          <p className="text-slate-500 mt-1">管理长期通行车辆和人员白名单</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchRecords} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
            刷新
          </Button>
          {isAdmin && (
            <>
              <Button
                variant="outline"
                onClick={handleSendReminders}
                disabled={sendingReminders}
              >
                <Bell className={cn('h-4 w-4 mr-2', sendingReminders && 'animate-pulse')} />
                过期提醒
              </Button>
            </>
          )}
          <Dialog open={addDialogOpen} onOpenChange={(open) => {
            setAddDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                新增长约
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>新增长约申请</DialogTitle>
                <DialogDescription>
                  申请长期通行权限，{isAdmin ? '管理员直接生效' : '提交后需管理员审批'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {/* 入场类型选择 */}
                <div className="space-y-2">
                  <Label>入场类型 *</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 'vehicle', label: '仅车辆', icon: Car, color: 'border-blue-300 bg-blue-50' },
                      { value: 'person', label: '仅人员', icon: User, color: 'border-indigo-300 bg-indigo-50' },
                      { value: 'both', label: '车辆+人员', icon: Shield, color: 'border-violet-300 bg-violet-50' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, entryType: opt.value })}
                        className={cn(
                          'flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all cursor-pointer',
                          formData.entryType === opt.value
                            ? `${opt.color} border-current`
                            : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'
                        )}
                      >
                        <opt.icon className={cn('h-5 w-5', formData.entryType === opt.value ? 'text-blue-600' : 'text-slate-400')} />
                        <span className={cn('text-xs font-medium', formData.entryType === opt.value ? 'text-blue-700' : 'text-slate-500')}>
                          {opt.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 访客类型 */}
                <div className="space-y-2">
                  <Label htmlFor="visitorType">访客类型</Label>
                  <select
                    id="visitorType"
                    value={formData.visitorType}
                    onChange={(e) => setFormData({ ...formData, visitorType: e.target.value })}
                    className="w-full h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  >
                    {VISITOR_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {/* 车辆信息 */}
                {(formData.entryType === 'vehicle' || formData.entryType === 'both') && (
                  <div className="space-y-3 p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-800/30">
                    <p className="text-sm font-medium text-blue-700 dark:text-blue-300 flex items-center gap-1">
                      <Car className="h-4 w-4" /> 车辆信息
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="licensePlate">车牌号 *</Label>
                        <Input
                          id="licensePlate"
                          value={formData.licensePlate}
                          onChange={(e) => setFormData({ ...formData, licensePlate: e.target.value })}
                          placeholder="如：京A12345"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="vehicleModel">车型</Label>
                        <Input
                          id="vehicleModel"
                          value={formData.vehicleModel}
                          onChange={(e) => setFormData({ ...formData, vehicleModel: e.target.value })}
                          placeholder="如：小型轿车"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="driverName">驾驶员姓名</Label>
                        <Input
                          id="driverName"
                          value={formData.driverName}
                          onChange={(e) => setFormData({ ...formData, driverName: e.target.value })}
                          placeholder="驾驶员姓名"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="driverPhone">驾驶员电话</Label>
                        <Input
                          id="driverPhone"
                          value={formData.driverPhone}
                          onChange={(e) => setFormData({ ...formData, driverPhone: e.target.value })}
                          placeholder="联系电话"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* 人员信息 */}
                {(formData.entryType === 'person' || formData.entryType === 'both') && (
                  <div className="space-y-3 p-3 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/50 dark:border-indigo-800/30">
                    <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                      <User className="h-4 w-4" /> 人员信息
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="personName">姓名 *</Label>
                        <Input
                          id="personName"
                          value={formData.personName}
                          onChange={(e) => setFormData({ ...formData, personName: e.target.value })}
                          placeholder="人员姓名"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="personPhone">联系电话</Label>
                        <Input
                          id="personPhone"
                          value={formData.personPhone}
                          onChange={(e) => setFormData({ ...formData, personPhone: e.target.value })}
                          placeholder="手机号"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="personIdCard">身份证号</Label>
                      <Input
                        id="personIdCard"
                        value={formData.personIdCard}
                        onChange={(e) => setFormData({ ...formData, personIdCard: e.target.value })}
                        placeholder="选填"
                      />
                    </div>
                  </div>
                )}

                {/* 公共字段 */}
                <div className="space-y-2">
                  <Label htmlFor="company">所属公司</Label>
                  <Input
                    id="company"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    placeholder="所属公司或单位"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="validFrom">有效期开始 *</Label>
                    <Input
                      id="validFrom"
                      type="date"
                      value={formData.validFrom}
                      onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="validTo">有效期结束 *</Label>
                    <Input
                      id="validTo"
                      type="date"
                      value={formData.validTo}
                      onChange={(e) => setFormData({ ...formData, validTo: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="allowedAreas">允许进入区域</Label>
                  <Input
                    id="allowedAreas"
                    value={formData.allowedAreas}
                    onChange={(e) => setFormData({ ...formData, allowedAreas: e.target.value })}
                    placeholder="如：仓库区、办公区"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">申请理由</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="请输入申请理由"
                    rows={2}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                  取消
                </Button>
                <Button onClick={handleAdd} disabled={submitting}>
                  {submitting ? '提交中...' : (isAdmin ? '确认添加' : '提交审批')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">总数量</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-900/30">
                <FileText className="h-5 w-5 text-slate-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">有效</p>
                <p className="text-2xl font-bold text-green-600">{stats.active}</p>
              </div>
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        {isAdmin && (
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">待审批</p>
                  <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
                </div>
                <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">即将过期</p>
                <p className="text-2xl font-bold text-orange-600">{stats.expiring}</p>
              </div>
              <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">已过期/停用</p>
                <p className="text-2xl font-bold text-red-600">{stats.expired}</p>
              </div>
              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 搜索 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="搜索车牌号、人员姓名、公司..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                onKeyDown={(e) => e.key === 'Enter' && fetchRecords()}
              />
            </div>
            <Button onClick={fetchRecords}>搜索</Button>
          </div>
        </CardContent>
      </Card>

      {/* 记录列表 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-green-500" />
            长约白名单
          </CardTitle>
          <CardDescription>共 {records.length} 条记录</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>编号</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>车牌号/人员</TableHead>
                  <TableHead>访客类型</TableHead>
                  <TableHead>公司</TableHead>
                  <TableHead>申请人</TableHead>
                  <TableHead>申请理由</TableHead>
                  <TableHead>有效期</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-slate-500">
                      加载中...
                    </TableCell>
                  </TableRow>
                ) : records.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-slate-500">
                      暂无长约记录
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedRecords.map((record) => {
                    const PrimaryIcon = getPrimaryIcon(record);
                    return (
                      <TableRow key={record.id} className={
                        record.status === 'cancelled' || record.status === 'rejected' || isExpired(record)
                          ? 'opacity-60' : ''
                      }>
                        <TableCell>
                          <span className="text-xs font-mono text-slate-500">{record.longTermCode || '-'}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge className={ENTRY_TYPE_COLORS[record.entryType] || ENTRY_TYPE_COLORS['vehicle']}>
                              {ENTRY_TYPE_LABELS[record.entryType] || '车辆'}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {/* 车辆行 */}
                            {record.entryType !== 'person' && record.licensePlate && (
                              <div className="flex items-center gap-1.5">
                                <Car className="h-3.5 w-3.5 text-slate-400" />
                                <span className="font-medium">{record.licensePlate}</span>
                              </div>
                            )}
                            {/* 人员行 */}
                            {(record.entryType === 'person' || record.entryType === 'both') && record.personName && (
                              <div className="flex items-center gap-1.5">
                                <User className="h-3.5 w-3.5 text-indigo-400" />
                                <span className="font-medium text-indigo-700 dark:text-indigo-300">{record.personName}</span>
                              </div>
                            )}
                            {!record.licensePlate && !record.personName && <span className="text-slate-400">-</span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {VISITOR_TYPE_LABELS[record.visitorType || ''] || record.visitorType || '-'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {record.company && (
                            <div className="flex items-center gap-1 max-w-[120px]">
                              <Building2 className="h-3 w-3 text-slate-400 flex-shrink-0" />
                              <span className="truncate">{record.company}</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-slate-500">{record.createdByName || record.createdBy || '-'}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 max-w-[200px]" title={record.notes || ''}>
                            {record.notes || '-'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm whitespace-nowrap">
                            <Calendar className="h-3 w-3 text-slate-400" />
                            <span>{fmtDateShanghai(record.validFrom)}</span>
                            <span className="text-slate-400">~</span>
                            <span className={cn(isExpiringSoon(record) && 'text-orange-600', isExpired(record) && 'text-red-600')}>
                              {fmtDateShanghai(record.validTo)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(record)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* 管理员：待审批记录 → 查看明细 + 审批通过 + 审批驳回 */}
                            {isAdmin && record.status === 'pending' && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                  onClick={() => { setDetailRecord(record); setDetailDialogOpen(true); }}
                                  title="查看明细"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                  onClick={() => { setApprovingRecord(record); setApproveDialogOpen(true); }}
                                  title="审批通过"
                                >
                                  <UserCheck className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => { setApprovingRecord(record); setRejectDialogOpen(true); }}
                                  title="审批驳回"
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            {/* 管理员：非待审批记录 → 查看 + 停用/启用 + 删除 */}
                            {isAdmin && record.status !== 'pending' && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                  onClick={() => { setDetailRecord(record); setDetailDialogOpen(true); }}
                                  title="查看明细"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleToggleStatus(record)}
                                  title={record.status === 'active' ? '停用' : '启用'}
                                >
                                  {record.status === 'active' ? (
                                    <XCircle className="h-4 w-4 text-orange-600" />
                                  ) : (
                                    <CheckCircle className="h-4 w-4 text-green-600" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => handleDelete(record.id, getRecordTitle(record))}
                                  title="删除"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            {/* 员工：待审批 → 编辑 + 删除 */}
                            {!isAdmin && record.status === 'pending' && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openEditDialog(record)}
                                  title="编辑"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => handleDelete(record.id, getRecordTitle(record))}
                                  title="删除"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            {/* 员工：审核后 → 仅查看明细 */}
                            {!isAdmin && record.status !== 'pending' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                onClick={() => { setDetailRecord(record); setDetailDialogOpen(true); }}
                                title="查看明细"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* 分页控件 */}
          <DataPagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            total={records.length}
            startIndex={startIndex}
            endIndex={endIndex}
            onPageChange={goToPage}
            onPageSizeChange={setPageSize}
          />
        </CardContent>
      </Card>

      {/* 提示信息 */}
      <Card className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
            <div className="text-sm text-green-800 dark:text-green-300">
              <p className="font-medium">长约说明</p>
              <ul className="mt-1 list-disc list-inside space-y-1">
                <li>白名单中的车辆或人员可快速通行，无需每次登记</li>
                <li>{isAdmin ? '员工提交的长约需要您审批后才能生效' : '提交的长约需要管理员审批通过后生效'}</li>
                <li>有效期到期后，将自动失效</li>
                <li>支持三种类型：仅车辆、仅人员、车辆+人员</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 编辑对话框（仅管理员） */}
      {isAdmin && (
        <Dialog open={editDialogOpen} onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) { setEditingRecord(null); resetForm(); }
        }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>编辑长约</DialogTitle>
              <DialogDescription>修改白名单信息</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* 访客类型 */}
              <div className="space-y-2">
                <Label>访客类型</Label>
                <select
                  value={formData.visitorType}
                  onChange={(e) => setFormData({ ...formData, visitorType: e.target.value })}
                  className="w-full h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                >
                  {VISITOR_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* 入场类型 */}
              <div className="space-y-2">
                <Label>入场类型</Label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'vehicle', label: '仅车辆', icon: Car, color: 'border-blue-300 bg-blue-50' },
                    { value: 'person', label: '仅人员', icon: User, color: 'border-indigo-300 bg-indigo-50' },
                    { value: 'both', label: '车辆+人员', icon: Shield, color: 'border-violet-300 bg-violet-50' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, entryType: opt.value })}
                      className={cn(
                        'flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all cursor-pointer',
                        formData.entryType === opt.value
                          ? `${opt.color} border-current`
                          : 'border-slate-200 hover:border-slate-300'
                      )}
                    >
                      <opt.icon className={cn('h-5 w-5', formData.entryType === opt.value ? 'text-blue-600' : 'text-slate-400')} />
                      <span className={cn('text-xs font-medium', formData.entryType === opt.value ? 'text-blue-700' : 'text-slate-500')}>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 车辆信息 */}
              {(formData.entryType === 'vehicle' || formData.entryType === 'both') && (
                <div className="space-y-3 p-3 rounded-lg bg-blue-50/50 border border-blue-200/50">
                  <p className="text-sm font-medium text-blue-700 flex items-center gap-1"><Car className="h-4 w-4" /> 车辆信息</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-licensePlate">车牌号 *</Label>
                      <Input id="edit-licensePlate" value={formData.licensePlate} onChange={(e) => setFormData({...formData, licensePlate: e.target.value})} placeholder="如：京A12345"/>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-vehicleModel">车型</Label>
                      <Input id="edit-vehicleModel" value={formData.vehicleModel} onChange={(e) => setFormData({...formData, vehicleModel: e.target.value})}/>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>驾驶员姓名</Label><Input value={formData.driverName} onChange={(e) => setFormData({...formData, driverName: e.target.value})}/></div>
                    <div className="space-y-2"><Label>驾驶员电话</Label><Input value={formData.driverPhone} onChange={(e) => setFormData({...formData, driverPhone: e.target.value})}/></div>
                  </div>
                </div>
              )}

              {/* 人员信息 */}
              {(formData.entryType === 'person' || formData.entryType === 'both') && (
                <div className="space-y-3 p-3 rounded-lg bg-indigo-50/50 border border-indigo-200/50">
                  <p className="text-sm font-medium text-indigo-700 flex items-center gap-1"><User className="h-4 w-4" /> 人员信息</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>姓名 *</Label><Input value={formData.personName} onChange={(e) => setFormData({...formData, personName: e.target.value})}/></div>
                    <div className="space-y-2"><Label>电话</Label><Input value={formData.personPhone} onChange={(e) => setFormData({...formData, personPhone: e.target.value})}/></div>
                  </div>
                  <div className="space-y-2"><Label>身份证号</Label><Input value={formData.personIdCard} onChange={(e) => setFormData({...formData, personIdCard: e.target.value})}/></div>
                </div>
              )}

              <div className="space-y-2"><Label>所属公司</Label><Input value={formData.company} onChange={(e) => setFormData({...formData, company: e.target.value})}/></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>有效开始 *</Label><Input type="date" value={formData.validFrom} onChange={(e) => setFormData({...formData, validFrom: e.target.value})}/></div>
                <div className="space-y-2"><Label>有效结束 *</Label><Input type="date" value={formData.validTo} onChange={(e) => setFormData({...formData, validTo: e.target.value})}/></div>
              </div>
              <div className="space-y-2"><Label>允许进入区域</Label><Input value={formData.allowedAreas} onChange={(e) => setFormData({...formData, allowedAreas: e.target.value})}/></div>
              <div className="space-y-2"><Label>申请理由</Label><Textarea value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} placeholder="请输入申请理由" rows={2}/></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>取消</Button>
              <Button onClick={handleEdit} disabled={submitting}>{submitting ? '保存中...' : '保存修改'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* 审批通过确认框 */}
      <Dialog open={approveDialogOpen} onOpenChange={(open) => { setApproveDialogOpen(open); if (!open) setApprovingRecord(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-700">
              <UserCheck className="h-5 w-5" /> 审批通过
            </DialogTitle>
            <DialogDescription>
              确定批准以下长约申请吗？
              {approvingRecord && (
                <div className="mt-2 p-2 bg-muted rounded-lg text-sm">
                  <p><strong>类型：</strong>{ENTRY_TYPE_LABELS[approvingRecord.entryType] || '车辆'}</p>
                  {approvingRecord.licensePlate && <p><strong>车牌：</strong>{approvingRecord.licensePlate}</p>}
                  {approvingRecord.personName && <p><strong>人员：</strong>{approvingRecord.personName}</p>}
                  <p><strong>申请人：</strong>{approvingRecord.createdByName || approvingRecord.createdBy || '-'}</p>
                  <button
                    className="text-blue-600 hover:text-blue-800 underline text-xs mt-1"
                    onClick={() => {
                      setDetailRecord(approvingRecord);
                      setDetailDialogOpen(true);
                    }}
                  >
                    查看完整明细 →
                  </button>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setApproveDialogOpen(false); setApprovingRecord(null); }}>取消</Button>
            <Button className="bg-green-600 hover:bg-green-700" onClick={handleApprove} disabled={submitting}>
              {submitting ? '处理中...' : '确认通过'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 审批驳回框 */}
      <Dialog open={rejectDialogOpen} onOpenChange={(open) => { setRejectDialogOpen(open); if (!open) { setApprovingRecord(null); setRejectionReason(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <XCircle className="h-5 w-5" /> 审批驳回
            </DialogTitle>
            <DialogDescription>
              请填写驳回原因（将通知申请人）
              {approvingRecord && (
                <div className="mt-2 p-2 bg-muted rounded-lg text-sm">
                  {approvingRecord.licensePlate && <p><strong>车牌：</strong>{approvingRecord.licensePlate}</p>}
                  {approvingRecord.personName && <p><strong>人员：</strong>{approvingRecord.personName}</p>}
                  <button
                    className="text-blue-600 hover:text-blue-800 underline text-xs mt-1"
                    onClick={() => {
                      setDetailRecord(approvingRecord);
                      setDetailDialogOpen(true);
                    }}
                  >
                    查看完整明细 →
                  </button>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="请输入驳回原因..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectDialogOpen(false); setRejectionReason(''); }}>取消</Button>
            <Button className="bg-red-600 hover:bg-red-700" onClick={handleReject} disabled={submitting}>
              {submitting ? '处理中...' : '确认驳回'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 查看明细对话框 */}
      <Dialog open={detailDialogOpen} onOpenChange={(open) => { setDetailDialogOpen(open); if (!open) setDetailRecord(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-blue-600" /> 长约明细
            </DialogTitle>
            <DialogDescription>
              查看长约申请的完整信息
            </DialogDescription>
          </DialogHeader>
          {detailRecord && (
            <div className="space-y-4 py-2">
              {/* 基本信息 */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <FileText className="h-4 w-4" /> 基本信息
                </h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg text-sm">
                  <div><span className="text-slate-500">长约编号：</span><span className="font-mono">{detailRecord.longTermCode || '-'}</span></div>
                  <div><span className="text-slate-500">入场类型：</span><Badge className={ENTRY_TYPE_COLORS[detailRecord.entryType] || ENTRY_TYPE_COLORS['vehicle']}>{ENTRY_TYPE_LABELS[detailRecord.entryType] || '车辆'}</Badge></div>
                  <div><span className="text-slate-500">访客类型：</span><Badge variant="secondary">{VISITOR_TYPE_LABELS[detailRecord.visitorType || ''] || detailRecord.visitorType || '-'}</Badge></div>
                  <div><span className="text-slate-500">申请人：</span>{detailRecord.createdByName || detailRecord.createdBy || '-'}</div>
                  <div><span className="text-slate-500">状态：</span>{getStatusBadge(detailRecord)}</div>
                </div>
              </div>

              {/* 车辆信息 */}
              {(detailRecord.entryType !== 'person') && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                    <Car className="h-4 w-4" /> 车辆信息
                  </h4>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 p-3 bg-blue-50/50 dark:bg-blue-950/20 rounded-lg text-sm border border-blue-200/50 dark:border-blue-800/30">
                    <div><span className="text-slate-500">车牌号：</span><span className="font-medium">{detailRecord.licensePlate || '-'}</span></div>
                    <div><span className="text-slate-500">车型：</span>{detailRecord.vehicleModel || '-'}</div>
                    <div><span className="text-slate-500">驾驶员：</span>{detailRecord.driverName || '-'}</div>
                    <div><span className="text-slate-500">驾驶员电话：</span>{detailRecord.driverPhone || '-'}</div>
                  </div>
                </div>
              )}

              {/* 人员信息 */}
              {(detailRecord.entryType === 'person' || detailRecord.entryType === 'both') && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                    <User className="h-4 w-4" /> 人员信息
                  </h4>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 p-3 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-lg text-sm border border-indigo-200/50 dark:border-indigo-800/30">
                    <div><span className="text-slate-500">姓名：</span><span className="font-medium">{detailRecord.personName || '-'}</span></div>
                    <div><span className="text-slate-500">电话：</span>{detailRecord.personPhone || '-'}</div>
                    <div className="col-span-2"><span className="text-slate-500">身份证号：</span>{detailRecord.personIdCard || '-'}</div>
                  </div>
                </div>
              )}

              {/* 通行信息 */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Building2 className="h-4 w-4" /> 通行信息
                </h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg text-sm">
                  <div><span className="text-slate-500">所属公司：</span>{detailRecord.company || '-'}</div>
                  <div><span className="text-slate-500">允许区域：</span>{detailRecord.allowedAreas || '-'}</div>
                  <div className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5 text-slate-400" /><span className="text-slate-500">有效期：</span>{fmtDateShanghai(detailRecord.validFrom)} ~ {fmtDateShanghai(detailRecord.validTo)}</div>
                  <div className="flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-slate-400" /><span className="text-slate-500">创建时间：</span>{fmtDateShanghai(detailRecord.createdAt)}</div>
                </div>
              </div>

              {/* 申请理由 */}
              {detailRecord.notes && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">申请理由</h4>
                  <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                    {detailRecord.notes}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            {detailRecord?.status === 'pending' && (
              <>
                <Button
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => {
                    setApprovingRecord(detailRecord);
                    setDetailDialogOpen(false);
                    setApproveDialogOpen(true);
                  }}
                >
                  <UserCheck className="h-4 w-4 mr-1" /> 审批通过
                </Button>
                <Button
                  className="bg-red-600 hover:bg-red-700"
                  onClick={() => {
                    setApprovingRecord(detailRecord);
                    setDetailDialogOpen(false);
                    setRejectDialogOpen(true);
                  }}
                >
                  <XCircle className="h-4 w-4 mr-1" /> 驳回
                </Button>
              </>
            )}
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 提醒结果对话框（仅管理员） */}
      {isAdmin && (
        <Dialog open={reminderResult.open} onOpenChange={(open) => setReminderResult({ ...reminderResult, open })}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                过期提醒结果
              </DialogTitle>
              <DialogDescription>{reminderResult.message}</DialogDescription>
            </DialogHeader>
            {reminderResult.vehicles.length > 0 && (
              <div className="space-y-2 max-h-60 overflow-auto">
                <p className="text-sm text-muted-foreground">以下记录将在7天内过期：</p>
                {reminderResult.vehicles.map((v: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-muted rounded-lg text-sm">
                    <div>
                      <span className="font-medium">{v.licensePlate}</span>
                      <span className="text-muted-foreground ml-2">({v.driverName})</span>
                    </div>
                    <Badge variant={v.remainingDays <= 3 ? 'destructive' : 'secondary'}>
                      剩余 {v.remainingDays} 天
                    </Badge>
                  </div>
                ))}
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => setReminderResult({ ...reminderResult, open: false })}>确定</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, Car, Plus, User, Check, X, Eye, EyeOff, Clock } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import UserInfo from '@/components/user-info';
import { toast } from 'sonner';


interface LongTermRecord {
  id: number;
  longTermCode: string | null;
  entryType: 'vehicle' | 'person' | 'both';
  licensePlate: string | null;
  vehicleModel: string | null;
  driverName: string | null;
  driverPhone: string | null;
  company: string | null;
  validFrom: string;
  validTo: string;
  status: 'pending' | 'active' | 'rejected' | 'cancelled';
  allowedAreas: string | null;
  notes: string | null;
  createdBy: string | null;
  visitorType: string | null;
  personName: string | null;
  personIdCard: string | null;
  personPhone: string | null;
  createdAt: string;
  // 新增字段
  isOnSite?: boolean;
  lastVisitRecordId?: number | null;
  checkinCount?: number; // 签到次数
  currentStatus?: 'idle' | 'onsite' | 'ended'; // 当前状态：空闲/在厂/已结束
}

export default function LongTermVehiclesPage() {
  // UTC 存储的 timestamp 转为上海时区 YYYY-MM-DD
  const fmtDateShanghai = (d: string | Date | null | undefined): string => {
    if (!d) return '';
    const date = typeof d === 'string' ? new Date(d) : d;
    const shanghaiOffset = 8 * 60;
    const shanghaiTime = new Date(date.getTime() + shanghaiOffset * 60 * 1000);
    return `${shanghaiTime.getUTCFullYear()}-${String(shanghaiTime.getUTCMonth() + 1).padStart(2, '0')}-${String(shanghaiTime.getUTCDate()).padStart(2, '0')}`;
  };

  const [records, setRecords] = useState<LongTermRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<{ role: string } | null>(null);
  const [showEnded, setShowEnded] = useState(false); // 是否显示已结束记录

  // 添加/编辑对话框状态
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'addVehicle' | 'addPerson' | 'edit'>('addVehicle');
  const [editingRecord, setEditingRecord] = useState<LongTermRecord | null>(null);

  // 审批对话框
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<LongTermRecord | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // 表单数据
  const [formData, setFormData] = useState({
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
    personName: '',
    personIdCard: '',
    personPhone: '',
    visitorType: 'supplier',
  });

  useEffect(() => {
    fetchCurrentUser();
    fetchRecords();
  }, [showEnded]);

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data);
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
    }
  };

  const fetchRecords = async () => {
    try {
      const url = showEnded
        ? '/api/long-term-vehicles?showEnded=true'
        : '/api/long-term-vehicles';
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setRecords(data);
      }
    } catch (error) {
      console.error('Failed to fetch records:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddVehicle = () => {
    setDialogMode('addVehicle');
    setEditingRecord(null);
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
      personName: '',
      personIdCard: '',
      personPhone: '',
      visitorType: 'supplier',
    });
    setDialogOpen(true);
  };

  const handleAddPerson = () => {
    setDialogMode('addPerson');
    setEditingRecord(null);
    setFormData({
      entryType: 'person',
      licensePlate: '',
      vehicleModel: '',
      driverName: '',
      driverPhone: '',
      company: '',
      validFrom: '',
      validTo: '',
      allowedAreas: '',
      notes: '',
      personName: '',
      personIdCard: '',
      personPhone: '',
      visitorType: 'supplier',
    });
    setDialogOpen(true);
  };

  const handleEdit = (record: LongTermRecord) => {
    setDialogMode('edit');
    setEditingRecord(record);
    setFormData({
      entryType: record.entryType,
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
    setDialogOpen(true);
  };

  const handleApprove = async (record: LongTermRecord) => {
    try {
      const response = await fetch('/api/long-term-vehicles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: record.id, action: 'approve' }),
      });

      if (response.ok) {
        toast.success('审批通过成功');
        setApproveDialogOpen(false);
        fetchRecords();
      } else {
        const data = await response.json();
        toast.error(data.error || '审批失败');
      }
    } catch (error) {
      toast.error('审批失败');
    }
  };

  const handleReject = async () => {
    if (!selectedRecord) return;

    try {
      const response = await fetch('/api/long-term-vehicles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedRecord.id,
          action: 'reject',
          rejectionReason: rejectReason,
        }),
      });

      if (response.ok) {
        toast.success('驳回成功');
        setRejectDialogOpen(false);
        setRejectReason('');
        fetchRecords();
      } else {
        const data = await response.json();
        toast.error(data.error || '驳回失败');
      }
    } catch (error) {
      toast.error('驳回失败');
    }
  };

  const handleSubmit = async () => {
    try {
      let response;

      if (dialogMode === 'edit' && editingRecord) {
        response = await fetch('/api/long-term-vehicles', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingRecord.id,
            action: 'edit',
            ...formData,
          }),
        });
      } else {
        response = await fetch('/api/long-term-vehicles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
      }

      if (response.ok) {
        toast.success(dialogMode === 'edit' ? '修改成功' : '添加成功');
        setDialogOpen(false);
        fetchRecords();
      } else {
        const data = await response.json();
        toast.error(data.error || '操作失败');
      }
    } catch (error) {
      toast.error('操作失败');
    }
  };

  const getStatusBadge = (record: LongTermRecord) => {
    const statusConfig: Record<string, { label: string; color: string }> = {
      pending: { label: '待审批', color: 'bg-yellow-500' },
      active: { label: '生效中', color: 'bg-green-500' },
      rejected: { label: '已驳回', color: 'bg-red-500' },
      cancelled: { label: '已取消', color: 'bg-gray-500' },
    };

    const status = statusConfig[record.status] || statusConfig.pending;

    // 如果是生效中且当前不在厂
    if (record.status === 'active' && record.currentStatus === 'ended') {
      return <Badge className="bg-gray-400">已结束</Badge>;
    }
    if (record.status === 'active' && record.currentStatus === 'onsite') {
      return <Badge className="bg-blue-500">在厂</Badge>;
    }

    return <Badge className={status.color}>{status.label}</Badge>;
  };

  const getEntryTypeBadge = (type: string) => {
    const config: Record<string, { label: string; color: string }> = {
      vehicle: { label: '车辆', color: 'bg-blue-100 text-blue-800' },
      person: { label: '人员', color: 'bg-green-100 text-green-800' },
      both: { label: '车辆+人员', color: 'bg-purple-100 text-purple-800' },
    };
    const entryType = config[type] || config.vehicle;
    return (
      <Badge className={entryType.color}>
        {type === 'vehicle' && <Car className="w-3 h-3 mr-1" />}
        {type === 'person' && <User className="w-3 h-3 mr-1" />}
        {type === 'both' && <><Car className="w-3 h-3 mr-1" /><User className="w-3 h-3" /></>}
        {entryType.label}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/security" className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-semibold">长约管理</h1>
          <div className="flex-1" />
          <UserInfo />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>长约记录列表</CardTitle>
            <div className="flex items-center gap-3">
              {/* 显示/隐藏已结束切换 */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowEnded(!showEnded)}
              >
                {showEnded ? <EyeOff className="w-4 h-4 mr-1" /> : <Eye className="w-4 h-4 mr-1" />}
                {showEnded ? '隐藏已结束' : '显示已结束'}
              </Button>
              {/* 添加按钮 */}
              {currentUser?.role === 'admin' && (
                <>
                  <Button variant="outline" size="sm" onClick={handleAddPerson}>
                    <Plus className="w-4 h-4 mr-1" />
                    添加人员
                  </Button>
                  <Button variant="default" size="sm" onClick={handleAddVehicle}>
                    <Plus className="w-4 h-4 mr-1" />
                    添加车辆
                  </Button>
                </>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-gray-500">加载中...</div>
            ) : records.length === 0 ? (
              <div className="text-center py-8 text-gray-500">暂无记录</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>编号</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>姓名/车牌</TableHead>
                    <TableHead>公司</TableHead>
                    <TableHead>有效期</TableHead>
                    <TableHead>签到次数</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record) => (
                    <TableRow key={record.id} className={record.isOnSite ? 'bg-blue-50' : ''}>
                      <TableCell><span className="text-xs font-mono text-slate-500">{record.longTermCode || '-'}</span></TableCell>
                      <TableCell>{getEntryTypeBadge(record.entryType)}</TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {record.entryType === 'person' || record.entryType === 'both'
                            ? record.personName
                            : record.driverName || record.licensePlate}
                        </div>
                        <div className="text-sm text-gray-500">
                          {record.entryType !== 'person' && record.licensePlate && (
                            <span className="mr-2">{record.licensePlate}</span>
                          )}
                          {record.personPhone && <span>{record.personPhone}</span>}
                        </div>
                      </TableCell>
                      <TableCell>{record.company || '-'}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {fmtDateShanghai(record.validFrom) || '-'}
                        </div>
                        <div className="text-sm text-gray-500">
                          至 {fmtDateShanghai(record.validTo) || '-'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4 text-gray-400" />
                          <span className="font-medium">{record.checkinCount || 0}</span>
                          <span className="text-gray-500 text-sm">次</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(record)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {record.status === 'pending' && currentUser?.role === 'admin' && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-green-600 hover:text-green-700"
                                onClick={() => {
                                  setSelectedRecord(record);
                                  setApproveDialogOpen(true);
                                }}
                              >
                                <Check className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-700"
                                onClick={() => {
                                  setSelectedRecord(record);
                                  setRejectDialogOpen(true);
                                }}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                          {record.status === 'active' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(record)}
                            >
                              编辑
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 添加/编辑对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === 'addVehicle' && '添加长约车辆'}
              {dialogMode === 'addPerson' && '添加长期人员'}
              {dialogMode === 'edit' && '编辑长约记录'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            {dialogMode !== 'edit' && (
              <div className="col-span-2">
                <Label>长约类型</Label>
                <Select
                  value={formData.entryType}
                  onValueChange={(value) => setFormData({ ...formData, entryType: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vehicle">车辆</SelectItem>
                    <SelectItem value="person">人员</SelectItem>
                    <SelectItem value="both">车辆+人员</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {(formData.entryType === 'vehicle' || formData.entryType === 'both') && (
              <>
                <div className="col-span-2">
                  <Label>车牌号 *</Label>
                  <Input
                    value={formData.licensePlate}
                    onChange={(e) => setFormData({ ...formData, licensePlate: e.target.value.toUpperCase() })}
                    placeholder="如：沪A12345"
                  />
                </div>
                <div>
                  <Label>车型</Label>
                  <Input
                    value={formData.vehicleModel}
                    onChange={(e) => setFormData({ ...formData, vehicleModel: e.target.value })}
                    placeholder="如：黑色轿车"
                  />
                </div>
                <div>
                  <Label>司机姓名</Label>
                  <Input
                    value={formData.driverName}
                    onChange={(e) => setFormData({ ...formData, driverName: e.target.value })}
                  />
                </div>
                <div>
                  <Label>司机电话</Label>
                  <Input
                    value={formData.driverPhone}
                    onChange={(e) => setFormData({ ...formData, driverPhone: e.target.value })}
                  />
                </div>
              </>
            )}

            {(formData.entryType === 'person' || formData.entryType === 'both') && (
              <>
                <div className="col-span-2">
                  <Label>姓名 *</Label>
                  <Input
                    value={formData.personName}
                    onChange={(e) => setFormData({ ...formData, personName: e.target.value })}
                  />
                </div>
                <div>
                  <Label>身份证号</Label>
                  <Input
                    value={formData.personIdCard}
                    onChange={(e) => setFormData({ ...formData, personIdCard: e.target.value })}
                  />
                </div>
                <div>
                  <Label>联系电话</Label>
                  <Input
                    value={formData.personPhone}
                    onChange={(e) => setFormData({ ...formData, personPhone: e.target.value })}
                  />
                </div>
              </>
            )}

            <div className="col-span-2">
              <Label>所属单位/公司 *</Label>
              <Input
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              />
            </div>

            <div>
              <Label>访客类型</Label>
              <Select
                value={formData.visitorType}
                onValueChange={(value) => setFormData({ ...formData, visitorType: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="supplier">供应商</SelectItem>
                  <SelectItem value="customer">客户</SelectItem>
                  <SelectItem value="government">政府</SelectItem>
                  <SelectItem value="interview">应聘者</SelectItem>
                  <SelectItem value="other">其他</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>有效区域</Label>
              <Input
                value={formData.allowedAreas}
                onChange={(e) => setFormData({ ...formData, allowedAreas: e.target.value })}
                placeholder="如：厂区、仓库"
              />
            </div>

            <div>
              <Label>生效日期 *</Label>
              <Input
                type="date"
                value={formData.validFrom}
                onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
              />
            </div>

            <div>
              <Label>失效日期 *</Label>
              <Input
                type="date"
                value={formData.validTo}
                onChange={(e) => setFormData({ ...formData, validTo: e.target.value })}
              />
            </div>

            <div className="col-span-2">
              <Label>申请理由</Label>
              <Input
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="请输入申请理由"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleSubmit}>
              {dialogMode === 'edit' ? '保存' : '添加'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 审批通过对话框 */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认审批通过</DialogTitle>
          </DialogHeader>
          <p className="py-4">
            确定要通过该长约申请吗？
            {selectedRecord && (
              <span className="block mt-2 text-gray-600">
                {selectedRecord.entryType === 'person'
                  ? selectedRecord.personName
                  : selectedRecord.licensePlate || selectedRecord.driverName}
              </span>
            )}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>取消</Button>
            <Button
              onClick={() => selectedRecord && handleApprove(selectedRecord)}
            >
              确认通过
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 驳回对话框 */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>驳回长约申请</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label>驳回原因</Label>
            <Input
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="请输入驳回原因"
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>取消</Button>
            <Button variant="destructive" onClick={handleReject}>确认驳回</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
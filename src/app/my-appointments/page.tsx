'use client';

import { useEffect, useState, useCallback } from 'react';
import { ArrowLeft, Calendar, Clock, CheckCircle, Edit, Trash2, Car, Users, Eye, Check, X } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import UserInfo from '@/components/user-info';
import { toast } from 'sonner';

// 日期格式化函数 - 直接解析字符串，避免时区转换
const fmtDate = (dateStr?: string) => {
  if (!dateStr) return '-';
  const d = dateStr.substring(0, 10);
  const [y, m, day] = d.split('-');
  return `${y}年${m}月${day}日`;
};

interface Appointment {
  id: number;
  visitorName: string;
  visitorPhone: string;
  visitObject: string;
  visitorType?: string;
  visitorCode?: string;
  visitPurpose: string;
  appointmentDate: string;
  appointmentTime: string;
  status: string;
  createdAt: string;
  hasCheckedIn?: boolean;
  hasCheckedOut?: boolean;
  // 车辆信息
  licensePlate?: string;
  vehicleInfo?: { licensePlate: string; vehicleModel: string; vehicleType: string }[];
  // 随访人员
  followers?: { id: string; name: string; phone: string; licensePlate: string }[];
}

export default function MyAppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [pendingList, setPendingList] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [userRole, setUserRole] = useState<string>('');
  const [reviewEnabled, setReviewEnabled] = useState(true);
  const [activeTab, setActiveTab] = useState('my-appointments');

  useEffect(() => {
    fetchAppointments();
    fetchPendingAppointments();
    fetchUserAndSettings();
  }, []);

  const fetchUserAndSettings = async () => {
    try {
      const [userRes, settingsRes] = await Promise.all([
        fetch('/api/auth/me'),
        fetch('/api/settings/public'),
      ]);
      if (userRes.ok) {
        const userData = await userRes.json();
        setUserRole(userData.role || '');
      }
      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        setReviewEnabled(settingsData.reviewEnabled);
      }
    } catch {
      // 静默失败
    }
  };

  const fetchAppointments = async () => {
    try {
      const response = await fetch('/api/my-appointments');
      if (response.ok) {
        const data = await response.json();
        setAppointments(data);
      }
    } catch (error) {
      console.error('Failed to fetch appointments:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPendingAppointments = async () => {
    setPendingLoading(true);
    try {
      const response = await fetch('/api/appointments/pending');
      if (response.ok) {
        const data = await response.json();
        setPendingList(data || []);
      }
    } catch (error) {
      console.error('Failed to fetch pending appointments:', error);
    } finally {
      setPendingLoading(false);
    }
  };

  const handleApprove = async (appointmentId: number) => {
    try {
      const response = await fetch('/api/appointments/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId }),
      });
      if (response.ok) {
        toast.success('已通过审核');
        fetchPendingAppointments();
        fetchAppointments();
      } else {
        const data = await response.json();
        toast.error(data.error || '操作失败');
      }
    } catch {
      toast.error('操作失败');
    }
  };

  const handleReject = async (appointmentId: number) => {
    try {
      const response = await fetch('/api/appointments/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId }),
      });
      if (response.ok) {
        toast.success('已拒绝预约');
        fetchPendingAppointments();
        fetchAppointments();
      } else {
        const data = await response.json();
        toast.error(data.error || '操作失败');
      }
    } catch {
      toast.error('操作失败');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这条预约记录吗？')) return;

    try {
      const response = await fetch(`/api/appointments/${id}`, { method: 'DELETE' });
      if (response.ok) {
        toast.success('预约已删除');
        fetchAppointments();
      } else {
        const data = await response.json();
        toast.error(data.error || '删除失败');
      }
    } catch {
      toast.error('删除失败');
    }
  };

  const getStatusBadge = (status: string, hasCheckedIn?: boolean, hasCheckedOut?: boolean) => {
    if (hasCheckedOut) {
      return <Badge className="bg-blue-100 text-blue-800">已签退</Badge>;
    }
    if (hasCheckedIn) {
      return <Badge className="bg-green-100 text-green-800">已签到</Badge>;
    }
    // 根据预约状态显示
    switch (status) {
      case 'pending':
        return <Badge className="bg-orange-100 text-orange-800">待审批</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800">已驳回</Badge>;
      case 'scheduled':
        return <Badge className="bg-green-100 text-green-800">录入通过</Badge>;
      default:
        return <Badge className="bg-green-100 text-green-800">录入通过</Badge>;
    }
  };

  // 当待审核数量变化时通知父页面（通过自定义事件）
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('pending-count-changed', {
      detail: { count: pendingList.length }
    }));
  }, [pendingList.length]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="border-b bg-white dark:bg-slate-900">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-4">
            <Link href="/">
              <button className="inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-slate-100 dark:hover:bg-slate-800">
                <ArrowLeft className="mr-2 h-4 w-4" />
                返回
              </button>
            </Link>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              <h1 className="text-2xl font-bold">我的预约</h1>
            </div>
          </div>
          <UserInfo />
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="my-appointments">我的预约</TabsTrigger>
            {reviewEnabled && (
              <TabsTrigger value="pending" className="relative">
                待审核
                {pendingList.length > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center h-5 min-w-5 px-1 rounded-full bg-red-500 text-white text-xs font-bold">
                    {pendingList.length}
                  </span>
                )}
              </TabsTrigger>
            )}
          </TabsList>

          {/* 我的预约 Tab */}
          <TabsContent value="my-appointments">
            {isLoading ? (
              <div className="text-center py-8">加载中...</div>
            ) : appointments.length === 0 ? (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center text-muted-foreground">
                    <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>暂无预约记录</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {appointments.map((appointment) => (
                  <Card key={appointment.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-1">
                          <CardTitle className="text-lg">
                            {appointment.visitorName} - {appointment.visitPurpose}
                          </CardTitle>
                          {appointment.visitorCode && (
                            <span className="text-sm text-muted-foreground">
                              访客编号：{appointment.visitorCode}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(appointment.status, appointment.hasCheckedIn, appointment.hasCheckedOut)}
                          {/* 签到前：修改+删除；签到后：仅查看 */}
                          {appointment.hasCheckedIn ? (
                            <Link href={`/appointment/edit/${appointment.id}?readonly=1`}>
                              <Button variant="outline" size="sm">
                                <Eye className="h-4 w-4 mr-1" />
                                查看
                              </Button>
                            </Link>
                          ) : (
                            <>
                              <Link href={`/appointment/edit/${appointment.id}`}>
                                <Button variant="outline" size="sm">
                                  <Edit className="h-4 w-4 mr-1" />
                                  修改
                                </Button>
                              </Link>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDelete(appointment.id)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                删除
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>{fmtDate(appointment.appointmentDate)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span>{appointment.appointmentTime}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircle className="h-4 w-4 text-muted-foreground" />
                          <span>受访人：{appointment.visitObject}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground">手机：{appointment.visitorPhone}</span>
                        </div>
                        {/* 车辆信息 */}
                        {appointment.vehicleInfo && appointment.vehicleInfo.length > 0 && (
                          <div className="flex items-center gap-2 text-sm">
                            <Car className="h-4 w-4 text-muted-foreground" />
                            <span>车牌：{appointment.vehicleInfo.map(v => v.licensePlate).join('、')}</span>
                          </div>
                        )}
                        {/* 随访人员 */}
                        {appointment.followers && appointment.followers.length > 0 && (
                          <div className="flex items-center gap-2 text-sm">
                            <Users className="h-4 w-4 text-purple-500" />
                            <span className="text-purple-600">随访：{appointment.followers.map(f => f.name).join('、')}</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* 待审核 Tab */}
          {reviewEnabled && (
            <TabsContent value="pending">
              {pendingLoading ? (
                <div className="text-center py-8">加载中...</div>
              ) : pendingList.length === 0 ? (
                <Card>
                  <CardContent className="py-12">
                    <div className="text-center text-muted-foreground">
                      <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>暂无待审核预约</p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {pendingList.map((appointment) => (
                    <Card key={appointment.id}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col gap-1">
                            <CardTitle className="text-lg">
                              {appointment.visitorName} - {appointment.visitPurpose}
                            </CardTitle>
                            {appointment.visitorCode && (
                              <span className="text-sm text-muted-foreground">
                                访客编号：{appointment.visitorCode}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className="bg-orange-100 text-orange-800">待审核</Badge>
                            <Button
                              variant="default"
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => handleApprove(appointment.id)}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              通过
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-600 hover:text-red-700 border-red-300 hover:bg-red-50"
                              onClick={() => handleReject(appointment.id)}
                            >
                              <X className="h-4 w-4 mr-1" />
                              拒绝
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span>{fmtDate(appointment.appointmentDate)}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span>{appointment.appointmentTime}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-muted-foreground">手机：{appointment.visitorPhone}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-muted-foreground">访客类型：{appointment.visitorType || '-'}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}

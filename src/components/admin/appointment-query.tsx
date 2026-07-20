'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Calendar, User, Clock, CheckCircle, XCircle, Hourglass, Car, Users } from 'lucide-react';

// 日期格式化函数 - 直接解析字符串，避免时区转换
const fmtDate = (dateStr?: string) => {
  if (!dateStr) return '-';
  const d = dateStr.substring(0, 10);
  const [y, m, day] = d.split('-');
  return `${y}年${m}月${day}日`;
};
import { toast } from 'sonner';

interface Appointment {
  id: number;
  visitorName: string;
  visitorPhone: string;
  visitorType: string;
  visitorCode?: string;
  company?: string;
  visitObject: string;
  visitPurpose: string;
  appointmentDate: string;
  appointmentTime: string;
  status: string;
  applicantId: string;
  applicantName: string;
  createdAt: string;
  hasCheckedIn?: boolean;
  hasCheckedOut?: boolean;
  // 车辆信息
  licensePlate?: string;
  vehicleInfo?: { licensePlate: string; vehicleModel: string; vehicleType: string }[];
  // 随访人员
  followers?: { id: string; name: string; phone: string; licensePlate: string }[];
}

interface CurrentUser {
  id: number;
  username: string;
  name: string;
  role: string;
}

export default function AppointmentQuery() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  // 获取当前用户信息
  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.id) {
          setCurrentUser(data);
        }
      })
      .catch(console.error);
  }, []);

  const fetchAppointments = async () => {
    if (!currentUser) return;
    
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        applicantId: currentUser.username,
      });

      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      if (searchQuery) {
        params.append('query', searchQuery);
      }

      const response = await fetch(`/api/appointments/query?${params.toString()}`);
      const data = await response.json();

      if (response.ok) {
        setAppointments(data);
      } else {
        toast.error('获取预约列表失败');
      }
    } catch (error) {
      toast.error('网络错误，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchAppointments();
    }
  }, [statusFilter, searchQuery, currentUser]);

  const getStatusBadge = (hasCheckedIn?: boolean, hasCheckedOut?: boolean) => {
    if (hasCheckedOut) {
      return <Badge className="bg-blue-100 text-blue-800"><CheckCircle className="mr-1 h-3 w-3" />已签退</Badge>;
    }
    if (hasCheckedIn) {
      return <Badge className="bg-green-100 text-green-800"><CheckCircle className="mr-1 h-3 w-3" />已签到</Badge>;
    }
    return <Badge className="bg-green-100 text-green-800"><Calendar className="mr-1 h-3 w-3" />录入通过</Badge>;
  };

  return (
    <div className="space-y-4">
      {/* 搜索和筛选 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="搜索访客编号、姓名、公司、受访人"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="状态筛选" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="checked_in">已签到</SelectItem>
                <SelectItem value="checked_out">已签退</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={fetchAppointments} disabled={isLoading}>
              {isLoading ? '查询中...' : '刷新'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 预约列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            我的预约记录 ({appointments.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">加载中...</div>
            </div>
          ) : appointments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Calendar className="mb-4 h-12 w-12 opacity-50" />
              <p>暂无预约记录</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>访客信息</TableHead>
                  <TableHead>受访人</TableHead>
                  <TableHead>来访事由</TableHead>
                  <TableHead>预约时间</TableHead>
                  <TableHead>车辆信息</TableHead>
                  <TableHead>随访人员</TableHead>
                  <TableHead>状态</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {appointments.map((appointment) => (
                  <TableRow key={appointment.id}>
                    <TableCell>
                      <div>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          <span className="font-medium">{appointment.visitorName}</span>
                        </div>
                        <div className="text-sm text-muted-foreground">{appointment.company || '个人'}</div>
                        {appointment.visitorCode && (
                          <div className="text-xs font-mono text-blue-600 mt-1">编号：{appointment.visitorCode}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{appointment.visitObject}</TableCell>
                    <TableCell>{appointment.visitPurpose}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3 w-3" />
                          <span className="text-sm">
                            {fmtDate(appointment.appointmentDate)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-3 w-3" />
                          <span className="text-sm">{appointment.appointmentTime}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {appointment.vehicleInfo && appointment.vehicleInfo.length > 0 ? (
                        <div className="flex items-center gap-1">
                          <Car className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm font-mono">{appointment.vehicleInfo.map(v => v.licensePlate).join('、')}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">无</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {appointment.followers && appointment.followers.length > 0 ? (
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3 text-purple-500" />
                          <span className="text-sm text-purple-600">{appointment.followers.map(f => f.name).join('、')}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">无</span>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(appointment.hasCheckedIn, appointment.hasCheckedOut)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

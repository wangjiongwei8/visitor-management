'use client';

import { useState, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, User, CheckCircle, XCircle, Hourglass, Building2, Users, RefreshCw, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Appointment {
  id: number;
  visitorCode: string;
  visitorName: string;
  visitorPhone: string;
  visitorPhoneRaw?: string;
  visitorCount: number;
  visitorType: string;
  visitorCategory: string;
  company: string;
  visitObject: string;
  visitPurpose: string;
  appointmentDate: string;
  appointmentTime: string;
  needMeal: boolean;
  status: string;
  applicantId: string;
  applicantName: string;
  hasCheckedIn: boolean;
  checkInTime: string | null;
  hasCheckedOut: boolean;
  checkOutTime: string | null;
  visitStatus: string | null;
}

interface ApiResponse {
  success: boolean;
  data: Appointment[];
  total: number;
  error?: string;
}

export default function SecurityAppointmentList() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [queryDate, setQueryDate] = useState<string>('');

  const fetchAppointments = async () => {
    setIsLoading(true);
    try {
      // 构建查询参数
      const params = new URLSearchParams();
      if (queryDate) {
        params.set('date', queryDate);
      }
      const url = '/api/security/appointments' + (params.toString() ? '?' + params.toString() : '');
      const response = await fetch(url);
      const data: ApiResponse = await response.json();

      if (data.success) {
        setAppointments(data.data);
      } else {
        toast.error(data.error || '获取预约列表失败');
      }
    } catch (error) {
      toast.error('网络错误，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, [queryDate]);

  const filteredAppointments = useMemo(() => {
    return appointments.filter((apt) => {
      if (statusFilter !== 'all') {
        if (statusFilter === 'pending' && apt.hasCheckedIn) return false;
        if (statusFilter === 'checked_in' && (!apt.hasCheckedIn || apt.hasCheckedOut)) return false;
        if (statusFilter === 'checked_out' && !apt.hasCheckedOut) return false;
      }

      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          apt.visitorName.toLowerCase().includes(query) ||
          apt.visitorPhone.includes(query) ||
          apt.visitorPhoneRaw?.includes(query) ||
          apt.company?.toLowerCase().includes(query) ||
          apt.visitObject.toLowerCase().includes(query) ||
          apt.visitorCode?.toLowerCase().includes(query)
        );
      }

      return true;
    });
  }, [appointments, statusFilter, searchQuery]);

  const getStatusBadge = (apt: Appointment) => {
    if (apt.hasCheckedOut) {
      return (
        <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">
          <CheckCircle className="mr-1 h-3 w-3" />
          已签退
        </Badge>
      );
    }
    if (apt.hasCheckedIn) {
      return (
        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
          <CheckCircle className="mr-1 h-3 w-3" />
          已签到
        </Badge>
      );
    }
    return (
      <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">
        <Hourglass className="mr-1 h-3 w-3" />
        待签到
      </Badge>
    );
  };

  const getPassBadge = (apt: Appointment) => {
    const colorMapping: Record<string, string> = {
      customer: 'green',
      supplier: 'red',
      long_term_supplier: 'yellow',
      government: 'yellow',
      applicant: 'red',
      delivery: 'red',
      temp_supplier: 'yellow',
      visit: 'yellow',
    };

    const passColor = colorMapping[apt.visitorType] || 'green';

    const colorConfig = {
      green: { label: '绿色', color: 'bg-green-100 text-green-800' },
      yellow: { label: '黄色', color: 'bg-yellow-100 text-yellow-800' },
      red: { label: '红色', color: 'bg-red-100 text-red-800' },
    };

    const config = colorConfig[passColor as keyof typeof colorConfig];

    return (
      <Badge className={config.color}>
        {config.label}
      </Badge>
    );
  };

  const getVisitorTypeName = (visitorType: string) => {
    const typeNames: Record<string, string> = {
      customer: '客户',
      supplier: '供应商',
      government: '政府人员',
      applicant: '应聘者',
      delivery: '送货/装货人员',
      visit: '参观访客',
    };
    return typeNames[visitorType] || visitorType;
  };

  return (
    <div className="space-y-4">
      {/* 搜索和筛选 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="搜索姓名、电话、公司、受访人、编号"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Input
                type="date"
                value={queryDate}
                onChange={(e) => setQueryDate(e.target.value)}
                className="w-[160px]"
              />
              <Button onClick={fetchAppointments} disabled={isLoading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                刷新
              </Button>
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="状态筛选" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="pending">待签到</SelectItem>
                  <SelectItem value="checked_in">已签到</SelectItem>
                  <SelectItem value="checked_out">已签退</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 预约列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            预约列表 ({filteredAppointments.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredAppointments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <User className="mb-4 h-12 w-12 opacity-50" />
              <p>暂无预约记录</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                    <TableHead>预约信息</TableHead>
                    <TableHead>公司/单位</TableHead>
                    <TableHead>受访人</TableHead>
                    <TableHead>来访事由</TableHead>
                    <TableHead>预约时间</TableHead>
                    <TableHead>通行牌</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>签到时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAppointments.map((apt) => (
                    <TableRow
                      key={apt.id}
                      className={apt.hasCheckedIn && !apt.hasCheckedOut ? 'bg-green-50/50 dark:bg-green-950/20' : ''}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{apt.visitorName}</div>
                            <div className="text-sm text-muted-foreground">{apt.visitorPhone}</div>
                            {apt.visitorCode && (
                              <div className="text-xs font-mono text-blue-600 mt-0.5">
                                {apt.visitorCode}
                              </div>
                            )}
                            {apt.visitorCount > 1 && (
                              <Badge variant="outline" className="text-xs mt-1">
                                <Users className="mr-1 h-3 w-3" />
                                {apt.visitorCount}人
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {apt.company ? (
                          <div className="flex items-center gap-2">
                            <Building2 className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm">{apt.company}</span>
                          </div>
                        ) : '-'}
                      </TableCell>
                      <TableCell>{apt.visitObject}</TableCell>
                      <TableCell>
                        <div className="text-sm">{apt.visitPurpose}</div>
                        {apt.needMeal && (
                          <Badge variant="outline" className="text-xs mt-1">需要就餐</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">{apt.appointmentTime}</span>
                        </div>
                      </TableCell>
                      <TableCell>{getPassBadge(apt)}</TableCell>
                      <TableCell>{getStatusBadge(apt)}</TableCell>
                      <TableCell>
                        {apt.checkInTime ? (
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(apt.checkInTime), 'HH:mm')}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

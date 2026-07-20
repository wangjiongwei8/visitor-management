'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Area,
  AreaChart,
  Legend,
} from 'recharts';
import { Users, Clock, Calendar, RefreshCw, Plus, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

// 时间范围选项
const TIME_RANGES = [
  { value: 'all', label: '全部' },
  { value: 'today', label: '今天' },
  { value: 'tomorrow', label: '明天' },
  { value: 'this_week', label: '本周' },
  { value: 'next_week', label: '下周' },
  { value: 'this_month', label: '本月' },
  { value: 'next_month', label: '下月' },
];

// 图表颜色
const CHART_COLORS = [
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#f97316', // orange
  '#22c55e', // green
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#eab308', // yellow
  '#6366f1', // indigo
];

interface AppointmentData {
  id: number;
  visitorName: string;
  visitorPhone: string;
  company: string | null;
  visitorType: string;
  visitorCategory: string;
  visitPurpose: string;
  visitObject: string;
  appointmentDate: string;
  appointmentTime: string;
  status: string;
  hasCheckedIn: boolean;
  hasCheckedOut: boolean;
}

interface BoardData {
  totalVisitors: number;
  pendingVisitors: number;
  purposeStats: Record<string, number>;
  categoryStats: Record<string, number>;
  statusStats: Record<string, number>;
  todayData: {
    appointments: number;
    checkIns: number;
    inFactory: number;
  };
  trendData: { month: string; count: number }[];
  filters: {
    purposes: string[];
    receivers: string[];
  };
  appointments: AppointmentData[];
}

export default function VisitorBoardPage() {
  const [data, setData] = useState<BoardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('all');
  const [purposeFilter, setPurposeFilter] = useState('all');
  const [receiverFilter, setReceiverFilter] = useState('all');

  // 获取看板数据
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('range', timeRange);
      if (purposeFilter && purposeFilter !== 'all') params.append('purpose', purposeFilter);
      if (receiverFilter && receiverFilter !== 'all') params.append('receiver', receiverFilter);

      const response = await fetch(`/api/visitor-board?${params}`);
      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      console.error('获取看板数据失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [timeRange, purposeFilter, receiverFilter]);

  // 处理来访目的数据（用于饼图）
  const getPieChartData = () => {
    if (!data?.purposeStats) return [];
    return Object.entries(data.purposeStats).map(([name, value], index) => ({
      name,
      value,
      color: CHART_COLORS[index % CHART_COLORS.length],
    }));
  };

  // 处理访客类型分布数据
  const getCategoryData = () => {
    if (!data?.categoryStats) return [];
    return Object.entries(data.categoryStats).map(([name, value], index) => ({
      name,
      value,
      color: CHART_COLORS[index % CHART_COLORS.length],
    }));
  };

  // 处理状态分布数据
  const getStatusData = () => {
    if (!data?.statusStats) return [];
    return Object.entries(data.statusStats)
      .filter(([_, value]) => value > 0)
      .map(([name, value], index) => ({
        name,
        value,
        color: CHART_COLORS[index % CHART_COLORS.length],
      }));
  };

  // 格式化饼图标签
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }: any) => {
    if (percent < 0.05) return null;
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12}>
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  // 状态标签颜色
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
      case 'pending':
        return 'bg-green-100 text-green-700';
      case 'rejected':
        return 'bg-red-100 text-red-700';
      case 'cancelled':
        return 'bg-gray-100 text-gray-700';
      default:
        return 'bg-blue-100 text-blue-700';
    }
  };

  const getStatusLabel = (status: string, hasCheckedIn: boolean, hasCheckedOut: boolean) => {
    if (hasCheckedOut) return '已签退';
    if (hasCheckedIn) return '已签到';
    switch (status) {
      case 'approved':
        return '已审批';
      case 'pending':
        return '待审批';
      case 'rejected':
        return '已拒绝';
      case 'cancelled':
        return '已取消';
      default:
        return status;
    }
  };

  // 格式化日期
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 顶部标题和操作栏 */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">访客管理看板</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">实时查看访客预约和来访数据</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchData} disabled={isLoading}>
              <RefreshCw className={cn("h-4 w-4 mr-1", isLoading && "animate-spin")} />
              刷新
            </Button>
          </div>
        </div>

        {/* 筛选栏 */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            {/* 时间筛选 */}
            <div className="flex flex-wrap gap-2">
              {TIME_RANGES.map((range) => (
                <Button
                  key={range.value}
                  variant={timeRange === range.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTimeRange(range.value)}
                >
                  {range.label}
                </Button>
              ))}
            </div>

            {/* 下拉筛选 */}
            <div className="flex flex-wrap gap-3 lg:ml-auto">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600 dark:text-slate-400">来访事由</span>
                <Select value={purposeFilter} onValueChange={setPurposeFilter}>
                  <SelectTrigger className="w-[180px] h-9">
                    <SelectValue placeholder="全部" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    {data?.filters.purposes.filter(Boolean).map((purpose) => (
                      <SelectItem key={purpose} value={purpose}>
                        {purpose}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600 dark:text-slate-400">接待人员</span>
                <Select value={receiverFilter} onValueChange={setReceiverFilter}>
                  <SelectTrigger className="w-[180px] h-9">
                    <SelectValue placeholder="全部" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    {data?.filters.receivers.filter(Boolean).map((receiver) => (
                      <SelectItem key={receiver} value={receiver}>
                        {receiver}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        {/* 数据卡片区 */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                预约访客总数
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {data?.totalVisitors || 0}
                <span className="text-sm font-normal text-slate-500 ml-1">人</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                待接待访客
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-500">
                {data?.pendingVisitors || 0}
                <span className="text-sm font-normal text-slate-500 ml-1">人</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                今日预约
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-500">
                {data?.todayData?.appointments || 0}
                <span className="text-sm font-normal text-slate-500 ml-1">人</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                今日签到
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">
                {data?.todayData?.checkIns || 0}
                <span className="text-sm font-normal text-slate-500 ml-1">人</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                在厂访客
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-500">
                {data?.todayData?.inFactory || 0}
                <span className="text-sm font-normal text-slate-500 ml-1">人</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                来访事由类型
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-cyan-500">
                {Object.keys(data?.purposeStats || {}).length}
                <span className="text-sm font-normal text-slate-500 ml-1">种</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 图表区 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 来访目的统计 */}
          <Card>
            <CardHeader>
              <CardTitle>来访目的统计</CardTitle>
              <CardDescription>按来访目的分类的访客分布</CardDescription>
            </CardHeader>
            <CardContent>
              {getPieChartData().length > 0 ? (
                <div className="flex flex-col items-center">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={getPieChartData()}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={renderCustomizedLabel}
                        outerRadius={70}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {getPieChartData().map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(255, 255, 255, 0.95)',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  
                  {/* 图例 */}
                  <div className="flex flex-wrap justify-center gap-3 mt-3">
                    {getPieChartData().slice(0, 5).map((item, index) => (
                      <div key={index} className="flex items-center gap-1.5">
                        <div
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-xs text-slate-600 dark:text-slate-400">
                          {item.name}: {item.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[200px] text-slate-400">
                  暂无数据
                </div>
              )}
            </CardContent>
          </Card>

          {/* 访客类型分布 */}
          <Card>
            <CardHeader>
              <CardTitle>访客类型分布</CardTitle>
              <CardDescription>业务类/事务类/特殊类分布</CardDescription>
            </CardHeader>
            <CardContent>
              {getCategoryData().length > 0 ? (
                <div className="flex flex-col items-center">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={getCategoryData()}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={renderCustomizedLabel}
                        outerRadius={70}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {getCategoryData().map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(255, 255, 255, 0.95)',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  
                  {/* 图例 */}
                  <div className="flex flex-wrap justify-center gap-4 mt-3">
                    {getCategoryData().map((item, index) => (
                      <div key={index} className="flex items-center gap-1.5">
                        <div
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-xs text-slate-600 dark:text-slate-400">
                          {item.name}: {item.value}人
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[200px] text-slate-400">
                  暂无数据
                </div>
              )}
            </CardContent>
          </Card>

          {/* 状态分布 */}
          <Card>
            <CardHeader>
              <CardTitle>预约状态分布</CardTitle>
              <CardDescription>各状态访客数量</CardDescription>
            </CardHeader>
            <CardContent>
              {getStatusData().length > 0 ? (
                <div className="flex flex-col items-center">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={getStatusData()}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={renderCustomizedLabel}
                        outerRadius={70}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {getStatusData().map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(255, 255, 255, 0.95)',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  
                  {/* 图例 */}
                  <div className="flex flex-wrap justify-center gap-3 mt-3">
                    {getStatusData().map((item, index) => (
                      <div key={index} className="flex items-center gap-1.5">
                        <div
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-xs text-slate-600 dark:text-slate-400">
                          {item.name}: {item.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[200px] text-slate-400">
                  暂无数据
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 来访趋势图 */}
        <Card>
          <CardHeader>
            <CardTitle>来访次数趋势</CardTitle>
            <CardDescription>最近5个月的来访次数变化</CardDescription>
          </CardHeader>
          <CardContent>
            {data?.trendData && data.trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={data.trendData}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorCount)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-slate-400">
                暂无数据
              </div>
            )}
          </CardContent>
        </Card>

        {/* 预约列表 */}
        <Card>
          <CardHeader>
            <CardTitle>预约列表</CardTitle>
            <CardDescription>
              共 {data?.appointments?.length || 0} 条预约记录
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data?.appointments && data.appointments.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-400">访客姓名</th>
                      <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-400">公司</th>
                      <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-400">访客类型</th>
                      <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-400">来访事由</th>
                      <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-400">接待人</th>
                      <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-400">预约时间</th>
                      <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-400">状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.appointments.map((appointment) => (
                      <tr key={appointment.id} className="border-b last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="py-3 px-4">
                          <div className="font-medium">{appointment.visitorName}</div>
                          <div className="text-sm text-slate-500">{appointment.visitorPhone}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                          {appointment.company || '-'}
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className="text-xs">
                            {appointment.visitorCategory || '业务类'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="secondary">{appointment.visitPurpose}</Badge>
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                          {appointment.visitObject}
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-sm">
                            {formatDate(appointment.appointmentDate)}
                          </div>
                          <div className="text-xs text-slate-500">
                            {appointment.appointmentTime}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge className={getStatusColor(appointment.status)}>
                            {getStatusLabel(appointment.status, appointment.hasCheckedIn, appointment.hasCheckedOut)}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400">
                暂无预约数据
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 悬浮添加按钮 */}
      <a
        href="/appointment"
        className="fixed right-6 bottom-6 w-14 h-14 bg-pink-500 hover:bg-pink-600 text-white rounded-full shadow-lg flex items-center justify-center transition-colors"
      >
        <Plus className="h-6 w-6" />
      </a>
    </div>
  );
}

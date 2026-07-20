'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Search, Calendar, User, Clock, CheckCircle, XCircle, Hourglass, Building2, Users, Car, Trash2, Download, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { VISITOR_TYPE, PASS_COLOR } from '@/lib/schema';
import { usePagination } from '@/hooks/use-pagination';
import { DataPagination } from '@/components/ui/data-pagination';

// 日期格式化函数 - 直接解析字符串，避免时区转换
const fmtDate = (dateStr?: string) => {
  if (!dateStr) return '-';
  const d = dateStr.substring(0, 10);
  const [y, m, day] = d.split('-');
  return `${y}年${m}月${day}日`;
};

interface Visitor {
  id: number;
  name: string;
  phone: string;
  company?: string;
  visitObject: string;
  visitPurpose: string;
  visitDate: string;
  appointmentTime?: string;
  visitorType?: string;
  visitorCategory?: string;
  visitorCode?: string;
  status: string;
  totalVisitors?: number;
  createdAt: string;
  checkInTime?: string;
  checkOutTime?: string;
  isLongTerm?: boolean;
  longTermEntryType?: string;
  // 车辆信息
  licensePlate?: string;
  vehicleInfo?: { licensePlate: string; vehicleModel: string; vehicleType: string }[];
  // 随访人员
  followers?: { id: string; name: string; phone: string; licensePlate: string }[];
}

interface VisitorManagementProps {
  hideSearch?: boolean;
  hideActions?: boolean;
}

export default function VisitorManagement({ hideSearch = false, hideActions = false }: VisitorManagementProps) {
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [visitorTypeFilter, setVisitorTypeFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [visitObjectFilter, setVisitObjectFilter] = useState<string>('');
  const [companyFilter, setCompanyFilter] = useState<string>('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [visitorToDelete, setVisitorToDelete] = useState<Visitor | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // 分页
  const {
    currentPage,
    totalPages,
    pageSize,
    paginatedData: paginatedVisitors,
    goToPage,
    setPageSize,
    startIndex,
    endIndex,
  } = usePagination({ data: visitors });

  const fetchVisitors = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();

      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      if (categoryFilter !== 'all') {
        params.append('category', categoryFilter);
      }

      if (visitorTypeFilter !== 'all') {
        params.append('visitorType', visitorTypeFilter);
      }

      if (dateFrom) {
        params.append('dateFrom', dateFrom);
      }

      if (dateTo) {
        params.append('dateTo', dateTo);
      }

      if (visitObjectFilter) {
        params.append('visitObject', visitObjectFilter);
      }

      if (companyFilter) {
        params.append('company', companyFilter);
      }

      if (searchQuery) {
        params.append('query', searchQuery);
      }

      const response = await fetch(`/api/visitors/management-query?${params.toString()}`);
      const data = await response.json();

      if (response.ok) {
        setVisitors(data.visitors || []);
      } else {
        toast.error('获取访客列表失败');
      }
    } catch (error) {
      toast.error('网络错误，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClick = (visitor: Visitor) => {
    setVisitorToDelete(visitor);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!visitorToDelete) return;
    
    setIsDeleting(true);
    try {
      const response = await fetch(
        `/api/visitors/delete?id=${visitorToDelete.id}&reason=${encodeURIComponent('管理员删除异常数据')}`,
        { method: 'DELETE' }
      );

      const data = await response.json();

      if (response.ok) {
        toast.success(data.isAbnormal ? '异常数据已删除' : '记录已删除');
        fetchVisitors(); // 刷新列表
      } else {
        toast.error(data.error || '删除失败');
      }
    } catch (error) {
      toast.error('删除失败，请重试');
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setVisitorToDelete(null);
    }
  };

  useEffect(() => {
    // 页面加载时自动查询数据
    fetchVisitors();
  }, [statusFilter, categoryFilter, searchQuery]);

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; color: string; icon: typeof Hourglass }> = {
      pending: { label: '待审批', color: 'bg-yellow-100 text-yellow-800', icon: Hourglass },
      scheduled: { label: '待签到', color: 'bg-blue-100 text-blue-800', icon: Clock },
      approved: { label: '已审批', color: 'bg-indigo-100 text-indigo-800', icon: CheckCircle },
      checked_in: { label: '已签到', color: 'bg-green-100 text-green-800', icon: CheckCircle },
      checked_out: { label: '已签退', color: 'bg-gray-100 text-gray-800', icon: CheckCircle },
      rejected: { label: '已拒绝', color: 'bg-orange-100 text-orange-800', icon: XCircle },
      cancelled: { label: '已取消', color: 'bg-red-100 text-red-800', icon: XCircle },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <Badge className={config.color}>
        <Icon className="mr-1 h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getPassBadge = (visitorType?: string) => {
    if (!visitorType) return null;

    const colorMapping: Record<string, string> = {
      customer: PASS_COLOR.GREEN,
      supplier: PASS_COLOR.RED,
      long_term_supplier: PASS_COLOR.YELLOW,
      government: PASS_COLOR.YELLOW,
      applicant: PASS_COLOR.RED,
      delivery: PASS_COLOR.RED,
      temp_supplier: PASS_COLOR.YELLOW,
      visit: PASS_COLOR.YELLOW,
    };

    const passColor = colorMapping[visitorType] || PASS_COLOR.GREEN;

    const colorConfig = {
      green: { label: '绿色', color: 'bg-green-100 text-green-800' },
      yellow: { label: '黄色', color: 'bg-yellow-100 text-yellow-800' },
      red: { label: '红色', color: 'bg-red-100 text-red-800' },
    };

    const config = colorConfig[passColor as keyof typeof colorConfig];

    return (
      <Badge className={config.color}>
        {config.label}通行牌
      </Badge>
    );
  };

  // 获取访客类型中文名
  const getVisitorTypeName = (visitorType?: string) => {
    if (!visitorType) return '-';
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

  // 导出 CSV
  const handleExport = () => {
    if (visitors.length === 0) {
      toast.error('暂无数据可导出');
      return;
    }

    // CSV 表头
    const headers = ['序号', '类型', '访客编号', '访客姓名', '手机号', '公司/单位', '受访人', '来访事由', '访客类型', '来访日期', '预约时间', '签到时间', '签退时间', '通行牌', '状态', '创建时间'];

    // CSV 数据行
    const rows = visitors.map((visitor, index) => [
      index + 1,
      visitor.isLongTerm ? '长约' : '预约',
      visitor.visitorCode || '',
      visitor.name,
      visitor.phone,
      visitor.company || '',
      visitor.visitObject,
      visitor.visitPurpose,
      getVisitorTypeName(visitor.visitorType),
      fmtDate(visitor.visitDate),
      visitor.appointmentTime || '-',
      visitor.checkInTime || '-',
      visitor.checkOutTime || '-',
      visitor.visitorType ? (visitor.visitorType === 'customer' ? '绿色' :
                              visitor.visitorType === 'supplier' ? '红色' :
                              ['long_term_supplier', 'government', 'temp_supplier', 'visit'].includes(visitor.visitorType) ? '黄色' : '红色') : '',
      visitor.status === 'pending' ? '待审批' :
        visitor.status === 'scheduled' ? '待签到' :
        visitor.status === 'approved' ? '已审批' :
        visitor.status === 'checked_in' ? '已签到' :
        visitor.status === 'checked_out' ? '已签退' :
        visitor.status === 'rejected' ? '已拒绝' :
        visitor.status === 'cancelled' ? '已取消' : visitor.status,
      visitor.createdAt || '-',
    ]);

    // 添加 BOM 以支持中文（兼容 WPS）
    const BOM = '\uFEFF';
    const csvContent = BOM + [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    // 创建下载链接
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `访客记录_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast.success('导出成功');
  };

  return (
    <div className="space-y-4">
      {/* 搜索和筛选 */}
      {!hideSearch && (
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-2">
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
              <Button onClick={fetchVisitors} disabled={isLoading}>
                {isLoading ? '查询中...' : '刷新'}
              </Button>
              <Button onClick={handleExport} disabled={isLoading || visitors.length === 0} variant="outline">
                <Download className="mr-2 h-4 w-4" />
                导出
              </Button>
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="状态筛选" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">活跃预约</SelectItem>
                  <SelectItem value="pending">待审批</SelectItem>
                  <SelectItem value="scheduled">待签到</SelectItem>
                  <SelectItem value="checked_in">已签到</SelectItem>
                  <SelectItem value="checked_out">已签退</SelectItem>
                  <SelectItem value="rejected">已拒绝</SelectItem>
                  <SelectItem value="cancelled">已取消</SelectItem>
                  <SelectItem value="all">全部状态</SelectItem>
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="访客分类" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部分类</SelectItem>
                  <SelectItem value="business">业务类</SelectItem>
                  <SelectItem value="affairs">事务类</SelectItem>
                  <SelectItem value="special">特殊类</SelectItem>
                </SelectContent>
              </Select>
              <Select value={visitorTypeFilter} onValueChange={setVisitorTypeFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="访客类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部类型</SelectItem>
                  <SelectItem value="customer">客户</SelectItem>
                  <SelectItem value="supplier">供应商</SelectItem>
                  <SelectItem value="government">政府人员</SelectItem>
                  <SelectItem value="applicant">应聘者</SelectItem>
                  <SelectItem value="delivery">送货/装货人员</SelectItem>
                  <SelectItem value="visit">参观访客</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Input
                type="date"
                placeholder="开始日期"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-[150px]"
              />
              <Input
                type="date"
                placeholder="结束日期"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-[150px]"
              />
              <Input
                placeholder="被拜访人员"
                value={visitObjectFilter}
                onChange={(e) => setVisitObjectFilter(e.target.value)}
                className="w-[150px]"
              />
              <Input
                placeholder="公司/单位"
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
                className="w-[150px]"
              />
            </div>
          </div>
        </CardContent>
      </Card>
      )}



      {/* 访客列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            访客记录 ({visitors.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">加载中...</div>
            </div>
          ) : visitors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <User className="mb-4 h-12 w-12 opacity-50" />
              <p>暂无访客记录</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">序号</TableHead>
                    <TableHead className="w-[90px]">状态</TableHead>
                    <TableHead className="w-[100px]">访客类型</TableHead>
                    <TableHead>访客信息</TableHead>
                    <TableHead className="w-[80px]">受访人</TableHead>
                    <TableHead>预约时间</TableHead>
                    <TableHead className="w-[120px]">签到时间</TableHead>
                    <TableHead className="w-[120px]">签退时间</TableHead>
                    <TableHead>车辆信息</TableHead>
                    <TableHead>随访人员</TableHead>
                    <TableHead>公司</TableHead>
                    <TableHead>来访事由</TableHead>
                    <TableHead className="w-[90px]">通行牌</TableHead>
                    {!hideActions && <TableHead className="w-[80px]">操作</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedVisitors.map((visitor, index) => (
                    <TableRow key={visitor.id} className={visitor.status === 'checked_in' ? 'bg-red-50 dark:bg-red-950/20' : ''}>
                      <TableCell className="text-center font-medium">{startIndex + index}</TableCell>
                      <TableCell>{getStatusBadge(visitor.status)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {getVisitorTypeName(visitor.visitorType)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          <span className="font-medium">{visitor.name}</span>
                          {visitor.totalVisitors && visitor.totalVisitors > 1 && (
                            <Badge variant="outline" className="text-xs">
                              {visitor.totalVisitors}人
                            </Badge>
                          )}
                          {visitor.isLongTerm && (
                            <Badge className="text-xs bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
                              长约
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">{visitor.phone}</div>
                        {visitor.visitorCode && (
                          <div className="text-xs font-mono text-blue-600 mt-1">编号：{visitor.visitorCode}</div>
                        )}
                      </TableCell>
                      <TableCell>{visitor.visitObject}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span className="text-sm">{fmtDate(visitor.visitDate)}</span>
                          </div>
                          {visitor.appointmentTime && (
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span className="text-sm">{visitor.appointmentTime}</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{visitor.checkInTime || '-'}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{visitor.checkOutTime || '-'}</span>
                      </TableCell>
                      <TableCell>
                        {visitor.vehicleInfo && visitor.vehicleInfo.length > 0 ? (
                          <div className="flex items-center gap-1">
                            <Car className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm font-mono">{visitor.vehicleInfo.map(v => v.licensePlate).join('、')}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">无</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {visitor.followers && visitor.followers.length > 0 ? (
                          <div className="flex items-center gap-1">
                            <Users className="h-3 w-3 text-purple-500" />
                            <span className="text-sm text-purple-600">{visitor.followers.map(f => f.name).join('、')}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">无</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {visitor.company && (
                          <div className="flex items-center gap-2">
                            <Building2 className="h-3 w-3" />
                            <span className="text-sm">{visitor.company}</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{visitor.visitPurpose}</TableCell>
                      <TableCell>{getPassBadge(visitor.visitorType)}</TableCell>
                      {!hideActions && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteClick(visitor)}
                          title="删除记录"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          
          {/* 分页控件 */}
          <DataPagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            total={visitors.length}
            startIndex={startIndex}
            endIndex={endIndex}
            onPageChange={goToPage}
            onPageSizeChange={setPageSize}
          />
        </CardContent>
      </Card>

      {/* 删除确认对话框 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              确认删除
            </AlertDialogTitle>
            <AlertDialogDescription>
              {visitorToDelete && (
                <div className="space-y-2">
                  <p>确定要删除访客 <strong>{visitorToDelete.name}</strong> 的记录吗？</p>
                  {visitorToDelete.status === 'checked_in' && (
                    <div className="mt-2 p-2 bg-red-50 dark:bg-red-950 rounded text-sm text-red-700 dark:text-red-300">
                      ⚠️ 该访客状态为&quot;已签到&quot;，可能存在未签退的异常情况，删除后将无法恢复。
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground">此操作不可撤销。</p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

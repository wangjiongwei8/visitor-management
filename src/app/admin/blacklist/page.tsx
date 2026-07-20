'use client';

import * as React from 'react';
import { toast } from 'sonner';
import {
  Ban,
  Plus,
  Search,
  RefreshCw,
  Trash2,
  AlertTriangle,
  Calendar,
  User,
  Phone,
  CreditCard,
  FileText,
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
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { usePagination } from '@/hooks/use-pagination';
import { DataPagination } from '@/components/ui/data-pagination';

interface BlacklistItem {
  id: number;
  name: string;
  idCard: string;
  phone: string | null;
  reason: string;
  blacklistedBy: string;
  isPermanent: boolean;
  expiryDate: string | null;
  createdAt: string;
}

export default function BlacklistManagementPage() {
  const [blacklist, setBlacklist] = React.useState<BlacklistItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [addDialogOpen, setAddDialogOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [newItem, setNewItem] = React.useState({
    name: '',
    idCard: '',
    phone: '',
    reason: '',
    isPermanent: false,
    expiryDate: '',
  });

  // 分页
  const {
    currentPage,
    totalPages,
    pageSize,
    paginatedData: paginatedBlacklist,
    goToPage,
    setPageSize,
    startIndex,
    endIndex,
  } = usePagination({ data: blacklist });

  React.useEffect(() => {
    fetchBlacklist();
  }, []);

  const fetchBlacklist = async () => {
    setLoading(true);
    try {
      const url = searchQuery 
        ? `/api/admin/blacklist?query=${encodeURIComponent(searchQuery)}`
        : '/api/admin/blacklist';
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setBlacklist(data);
      } else {
        toast.error('获取黑名单失败');
      }
    } catch (error) {
      console.error('Failed to fetch blacklist:', error);
      toast.error('获取黑名单失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newItem.name || !newItem.idCard || !newItem.reason) {
      toast.error('请填写必填项');
      return;
    }

    if (!newItem.isPermanent && !newItem.expiryDate) {
      toast.error('非永久黑名单需要设置到期日期');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/admin/blacklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItem),
      });

      if (response.ok) {
        toast.success('添加成功');
        setAddDialogOpen(false);
        setNewItem({
          name: '',
          idCard: '',
          phone: '',
          reason: '',
          isPermanent: false,
          expiryDate: '',
        });
        fetchBlacklist();
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

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`确定要移除 ${name} 的黑名单记录吗？`)) return;

    try {
      const response = await fetch(`/api/admin/blacklist?id=${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('移除成功');
        fetchBlacklist();
      } else {
        toast.error('移除失败');
      }
    } catch (error) {
      console.error('Delete failed:', error);
      toast.error('移除失败');
    }
  };

  // 检查是否已过期
  const isExpired = (item: BlacklistItem) => {
    if (item.isPermanent) return false;
    if (!item.expiryDate) return false;
    return new Date(item.expiryDate) < new Date();
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">黑名单管理</h1>
          <p className="text-slate-500 mt-1">管理被禁止入内的访客名单</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchBlacklist} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
            刷新
          </Button>
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                添加黑名单
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>添加黑名单</DialogTitle>
                <DialogDescription>
                  将访客添加到黑名单，禁止其再次入内
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">姓名 *</Label>
                    <Input
                      id="name"
                      value={newItem.name}
                      onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                      placeholder="访客姓名"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="idCard">身份证号 *</Label>
                    <Input
                      id="idCard"
                      value={newItem.idCard}
                      onChange={(e) => setNewItem({ ...newItem, idCard: e.target.value })}
                      placeholder="身份证号码"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">联系电话</Label>
                  <Input
                    id="phone"
                    value={newItem.phone}
                    onChange={(e) => setNewItem({ ...newItem, phone: e.target.value })}
                    placeholder="联系电话"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reason">拉黑原因 *</Label>
                  <Textarea
                    id="reason"
                    value={newItem.reason}
                    onChange={(e) => setNewItem({ ...newItem, reason: e.target.value })}
                    placeholder="请输入拉黑原因"
                    rows={3}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>永久黑名单</Label>
                    <p className="text-xs text-slate-500">开启后该访客将永久禁止入内</p>
                  </div>
                  <Switch
                    checked={newItem.isPermanent}
                    onCheckedChange={(checked) => setNewItem({ ...newItem, isPermanent: checked })}
                  />
                </div>
                {!newItem.isPermanent && (
                  <div className="space-y-2">
                    <Label htmlFor="expiryDate">到期日期</Label>
                    <Input
                      id="expiryDate"
                      type="date"
                      value={newItem.expiryDate}
                      onChange={(e) => setNewItem({ ...newItem, expiryDate: e.target.value })}
                    />
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                  取消
                </Button>
                <Button onClick={handleAdd} disabled={submitting}>
                  {submitting ? '添加中...' : '确认添加'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* 搜索 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="搜索姓名、身份证号、电话..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                onKeyDown={(e) => e.key === 'Enter' && fetchBlacklist()}
              />
            </div>
            <Button onClick={fetchBlacklist}>搜索</Button>
          </div>
        </CardContent>
      </Card>

      {/* 黑名单列表 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Ban className="h-5 w-5 text-red-500" />
            黑名单列表
          </CardTitle>
          <CardDescription>共 {blacklist.length} 条记录</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>姓名</TableHead>
                  <TableHead>身份证号</TableHead>
                  <TableHead>电话</TableHead>
                  <TableHead>原因</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>到期日期</TableHead>
                  <TableHead>添加人</TableHead>
                  <TableHead>添加时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-slate-500">
                      加载中...
                    </TableCell>
                  </TableRow>
                ) : paginatedBlacklist.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-slate-500">
                      暂无黑名单记录
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedBlacklist.map((item) => {
                    const expired = isExpired(item);
                    return (
                      <TableRow key={item.id} className={expired ? 'opacity-50' : ''}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-slate-400" />
                            {item.name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4 text-slate-400" />
                            {item.idCard}
                          </div>
                        </TableCell>
                        <TableCell>
                          {item.phone && (
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-slate-400" />
                              {item.phone}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 max-w-xs">
                            <FileText className="h-4 w-4 text-slate-400 flex-shrink-0" />
                            <span className="truncate">{item.reason}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {item.isPermanent ? (
                            <Badge className="bg-red-100 text-red-800">永久</Badge>
                          ) : expired ? (
                            <Badge className="bg-gray-100 text-gray-800">已过期</Badge>
                          ) : (
                            <Badge className="bg-orange-100 text-orange-800">临时</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {item.isPermanent ? (
                            <span className="text-slate-400">-</span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-slate-400" />
                              {item.expiryDate ? item.expiryDate.substring(0, 10) : '-'}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{item.blacklistedBy}</TableCell>
                        <TableCell>
                          {item.createdAt ? item.createdAt.substring(0, 10) : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDelete(item.id, item.name)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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
            total={blacklist.length}
            startIndex={startIndex}
            endIndex={endIndex}
            onPageChange={goToPage}
            onPageSizeChange={setPageSize}
          />
        </CardContent>
      </Card>

      {/* 提示信息 */}
      <Card className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div className="text-sm text-amber-800 dark:text-amber-300">
              <p className="font-medium">注意事项</p>
              <ul className="mt-1 list-disc list-inside space-y-1">
                <li>黑名单人员将在签到时被系统自动拦截</li>
                <li>临时黑名单到期后将自动解除限制</li>
                <li>移除黑名单后，该访客可正常进行预约和签到</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

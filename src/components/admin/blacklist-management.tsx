'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Plus, Trash2, CalendarIcon, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface BlacklistItem {
  id: number;
  name: string;
  idCard: string;
  phone: string;
  reason: string;
  blacklistedBy: string;
  isPermanent: boolean;
  expiryDate: string | null;
  createdAt: string;
}

export default function BlacklistManagement() {
  const [blacklist, setBlacklist] = useState<BlacklistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    idCard: '',
    phone: '',
    reason: '',
    blacklistedBy: 'admin',
    isPermanent: true,
    expiryDate: null as Date | null,
  });

  useEffect(() => {
    fetchBlacklist();
  }, []);

  const fetchBlacklist = async () => {
    try {
      const response = await fetch('/api/blacklist');
      if (response.ok) {
        const data = await response.json();
        setBlacklist(data);
      }
    } catch (error) {
      toast.error('获取黑名单失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddToBlacklist = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/blacklist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast.success('已添加到黑名单');
        setIsDialogOpen(false);
        setFormData({
          name: '',
          idCard: '',
          phone: '',
          reason: '',
          blacklistedBy: 'admin',
          isPermanent: true,
          expiryDate: null,
        });
        fetchBlacklist();
      } else {
        const error = await response.json();
        toast.error(error.error || '添加失败');
      }
    } catch (error) {
      toast.error('网络错误，请重试');
    }
  };

  const handleRemoveFromBlacklist = async (id: number) => {
    try {
      const response = await fetch(`/api/blacklist/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('已从黑名单移除');
        fetchBlacklist();
      }
    } catch (error) {
      toast.error('移除失败');
    }
  };

  const isExpired = (item: BlacklistItem) => {
    if (item.isPermanent) return false;
    if (!item.expiryDate) return false;
    return new Date(item.expiryDate) < new Date();
  };

  return (
    <div className="space-y-6">
      {/* 操作栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <AlertTriangle className="h-4 w-4" />
          <span>共 {blacklist.length} 条黑名单记录</span>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="destructive">
              <Plus className="mr-2 h-4 w-4" />
              添加黑名单
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>添加黑名单</DialogTitle>
              <DialogDescription>
                将访客添加到黑名单后，该访客将无法进入
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddToBlacklist} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">姓名 *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="idCard">身份证号 *</Label>
                  <Input
                    id="idCard"
                    value={formData.idCard}
                    onChange={(e) => setFormData({ ...formData, idCard: e.target.value })}
                    required
                    maxLength={18}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">联系电话</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    maxLength={11}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="blacklistedBy">操作人</Label>
                  <Input
                    id="blacklistedBy"
                    value={formData.blacklistedBy}
                    onChange={(e) => setFormData({ ...formData, blacklistedBy: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reason">拉黑原因 *</Label>
                <Input
                  id="reason"
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  required
                  placeholder="请说明拉黑原因"
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="permanent">永久拉黑</Label>
                  <p className="text-sm text-muted-foreground">关闭后可选择过期时间</p>
                </div>
                <Switch
                  id="permanent"
                  checked={formData.isPermanent}
                  onCheckedChange={(checked) => setFormData({ ...formData, isPermanent: checked })}
                />
              </div>
              {!formData.isPermanent && (
                <div className="space-y-2">
                  <Label>过期日期</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn('w-full justify-start text-left font-normal', !formData.expiryDate && 'text-muted-foreground')}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.expiryDate ? format(formData.expiryDate, 'yyyy年MM月dd日') : '选择过期日期'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.expiryDate || undefined}
                        onSelect={(date) => setFormData({ ...formData, expiryDate: date || null })}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  取消
                </Button>
                <Button type="submit" variant="destructive">
                  确认添加
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* 黑名单列表 */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">
          加载中...
        </div>
      ) : blacklist.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          黑名单为空
        </div>
      ) : (
        <div className="space-y-4">
          {blacklist.map((item) => (
            <div
              key={item.id}
              className={cn(
                'rounded-lg border bg-card p-4 shadow-sm',
                isExpired(item) && 'opacity-50'
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{item.name}</h3>
                    <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900 dark:text-red-400">
                      黑名单
                    </span>
                    {item.isPermanent ? (
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800 dark:bg-gray-900 dark:text-gray-400">
                        永久
                      </span>
                    ) : isExpired(item) ? (
                      <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900 dark:text-yellow-400">
                        已过期
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-400">
                        有效期至 {item.expiryDate ? item.expiryDate.substring(0, 10) : '未设置'}
                      </span>
                    )}
                  </div>
                  <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                    <div>身份证：{item.idCard}</div>
                    <div>电话：{item.phone || '无'}</div>
                    <div className="col-span-2">
                      <span className="font-medium text-red-600 dark:text-red-400">拉黑原因：</span>
                      {item.reason}
                    </div>
                    <div>操作人：{item.blacklistedBy}</div>
                    <div>添加时间：{item.createdAt ? item.createdAt.substring(0, 16).replace('T', ' ') : '-'}</div>
                  </div>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleRemoveFromBlacklist(item.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

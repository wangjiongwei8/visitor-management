'use client';

import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Plus, Search, Edit, Trash2, Users, Upload, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import UserInfo from '@/components/user-info';
import { Checkbox } from '@/components/ui/checkbox';

interface HostContact {
  id: number;
  name: string;
  department: string;
  phone: string;
  email: string;
  position: string;
  createdBy: string;
  createdAt: string;
}

const DEPARTMENTS = [
  '总经办',
  '行政部',
  '人力资源部',
  '财务部',
  '销售部',
  '市场部',
  '研发部',
  '生产部',
  '采购部',
  '质量部',
  '仓储部',
  '其他',
];

export default function HostContactsPage() {
  const [contacts, setContacts] = useState<HostContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<HostContact | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    department: '',
    phone: '',
    email: '',
    position: '',
  });
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 批量选择相关状态
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);
  
  // 分页相关状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    try {
      const response = await fetch('/api/host-contacts');
      if (response.ok) {
        const data = await response.json();
        setContacts(data);
      }
    } catch (error) {
      console.error('获取受访人清单失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const url = editingContact
        ? `/api/host-contacts/${editingContact.id}`
        : '/api/host-contacts';
      const method = editingContact ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast.success(editingContact ? '修改成功' : '添加成功');
        setDialogOpen(false);
        setEditingContact(null);
        setFormData({ name: '', department: '', phone: '', email: '', position: '' });
        fetchContacts();
      } else {
        const data = await response.json();
        toast.error(data.error || '操作失败');
      }
    } catch (error) {
      toast.error('网络错误');
    }
  };

  const handleEdit = (contact: HostContact) => {
    setEditingContact(contact);
    setFormData({
      name: contact.name,
      department: contact.department,
      phone: contact.phone || '',
      email: contact.email || '',
      position: contact.position || '',
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这个受访人吗？')) return;

    try {
      const response = await fetch(`/api/host-contacts/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('删除成功');
        fetchContacts();
      } else {
        toast.error('删除失败');
      }
    } catch (error) {
      toast.error('网络错误');
    }
  };

  // 全选/取消全选
  const handleSelectAll = () => {
    if (selectedIds.size === filteredContacts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredContacts.map(c => c.id)));
    }
  };

  // 单个选择
  const handleSelect = (id: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  // 批量删除
  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) {
      toast.error('请先选择要删除的记录');
      return;
    }

    if (!confirm(`确定要删除选中的 ${selectedIds.size} 条记录吗？`)) return;

    setDeleting(true);
    try {
      const response = await fetch('/api/host-contacts/batch-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });

      if (response.ok) {
        toast.success(`成功删除 ${selectedIds.size} 条记录`);
        setSelectedIds(new Set());
        fetchContacts();
      } else {
        const data = await response.json();
        toast.error(data.error || '删除失败');
      }
    } catch (error) {
      toast.error('网络错误');
    } finally {
      setDeleting(false);
    }
  };

  const filteredContacts = contacts.filter(
    (c) =>
      c.name.includes(searchQuery) ||
      c.department.includes(searchQuery) ||
      c.phone?.includes(searchQuery)
  );
  
  // 分页计算
  const totalPages = Math.ceil(filteredContacts.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedContacts = filteredContacts.slice(startIndex, endIndex);
  
  // 搜索时重置页码
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);
  
  // 清空选中时重置选中状态
  useEffect(() => {
    if (paginatedContacts.length === 0 && currentPage > 1) {
      setCurrentPage(1);
    }
  }, [filteredContacts.length]);

  // 导出模板
  const handleDownloadTemplate = () => {
    const template = '姓名,部门,办公电话,邮箱,职位\n张三,销售部,0755-12345678,zhangsan@example.com,经理\n李四,技术部,0755-87654321,lisi@example.com,工程师';
    const blob = new Blob(['\ufeff' + template], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '受访人导入模板.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // 导入CSV（自动检测编码和列映射）
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      // 读取文件并检测编码
      let text = await readFileWithEncodingDetection(file);
      
      // 统一换行符
      text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      
      // 去掉 BOM（双重保险）
      if (text.charCodeAt(0) === 0xFEFF) {
        text = text.substring(1);
      }
      
      const lines = text.split('\n').filter(line => line.trim());

      if (lines.length < 2) {
        toast.error('文件为空或格式不正确');
        setImporting(false);
        return;
      }

      // 自动检测分隔符：逗号、制表符、分号
      const firstLine = lines[0];
      let delimiter = ',';
      const commaCount = (firstLine.match(/,/g) || []).length;
      const tabCount = (firstLine.match(/\t/g) || []).length;
      const semicolonCount = (firstLine.match(/;/g) || []).length;
      
      if (tabCount > commaCount && tabCount > semicolonCount) {
        delimiter = '\t';
      } else if (semicolonCount > commaCount) {
        delimiter = ';';
      }
      
      console.log('[受访人导入] 检测到分隔符:', delimiter === '\t' ? '制表符' : delimiter === ';' ? '分号' : '逗号');
      
      // 检测列映射（根据标题行）
      const headerLine = firstLine.split(delimiter).map(s => s.trim().replace(/^"(.*)"$/, '$1'));
      const hasHeader = headerLine.some(h => 
        h === '姓名' || h === '部门' || h === '职位' || h === '办公电话' || h === '邮箱'
      );
      
      console.log('[受访人导入] 标题行检测:', hasHeader, headerLine);
      
      // 构建列映射
      const colMapping: Record<string, number> = {};
      if (hasHeader) {
        headerLine.forEach((col, idx) => {
          if (col === '姓名') colMapping.name = idx;
          else if (col === '部门') colMapping.department = idx;
          else if (col === '职位') colMapping.position = idx;
          else if (col === '办公电话' || col === '电话') colMapping.phone = idx;
          else if (col === '邮箱') colMapping.email = idx;
        });
      }
      
      // 数据起始行
      const dataStartIndex = hasHeader ? 1 : 0;
      
      let successCount = 0;
      let errorCount = 0;

      for (let i = dataStartIndex; i < lines.length; i++) {
        const line = lines[i];
        const parts = line.split(delimiter).map(p => p.trim().replace(/^"(.*)"$/, '$1'));
        
        // 根据列映射提取数据
        let name: string, department: string, position: string, phone: string, email: string;
        
        if (Object.keys(colMapping).length >= 2) {
          // 有列映射
          name = colMapping.name !== undefined ? parts[colMapping.name] : '';
          department = colMapping.department !== undefined ? parts[colMapping.department] : '';
          position = colMapping.position !== undefined ? parts[colMapping.position] : '';
          phone = colMapping.phone !== undefined ? parts[colMapping.phone] : '';
          email = colMapping.email !== undefined ? parts[colMapping.email] : '';
        } else {
          // 无列映射，按默认顺序
          // 支持 3 列格式：姓名,部门,职位
          // 支持 5 列格式：姓名,部门,办公电话,邮箱,职位
          if (parts.length === 3) {
            [name, department, position] = parts;
            phone = '';
            email = '';
          } else {
            [name, department, phone, email, position] = parts;
          }
        }
        
        if (name && department) {
          try {
            const response = await fetch('/api/host-contacts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name,
                department,
                phone: phone || '',
                email: email || '',
                position: position || '',
              }),
            });
            if (response.ok) {
              successCount++;
            } else {
              errorCount++;
            }
          } catch {
            errorCount++;
          }
        } else {
          errorCount++;
        }
      }

      console.log('[受访人导入] 导入完成：成功', successCount, '失败', errorCount);
      
      if (successCount > 0) {
        toast.success(`成功导入 ${successCount} 条记录`);
        fetchContacts();
      }
      if (errorCount > 0) {
        toast.error(`${errorCount} 条记录导入失败`);
      }
    } catch (error) {
      console.error('[受访人导入] 导入失败:', error);
      toast.error('导入失败');
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  
  // 检测文件编码并读取
  const readFileWithEncodingDetection = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        let text = e.target?.result as string;
        
        // 先去掉 BOM 标记（WPS 导出的 CSV 带有 BOM）
        if (text.charCodeAt(0) === 0xFEFF) {
          text = text.substring(1);
        }
        
        // 检测是否为 GBK 编码被错误解读为 UTF-8
        const hasGarbledChars = text.includes('�') || 
          /[\u00c0-\u00ff][\u0080-\u00bf]/.test(text) ||
          text.includes('锘');
        
        console.log('[受访人导入] 乱码检测结果:', hasGarbledChars, '首字符编码:', text.charCodeAt(0));
        
        if (hasGarbledChars) {
          // 用 GBK 重新读取
          const gbkReader = new FileReader();
          gbkReader.onload = (e2) => {
            let gbkText = e2.target?.result as string;
            // GBK 读取后也要去掉 BOM
            if (gbkText.charCodeAt(0) === 0xFEFF) {
              gbkText = gbkText.substring(1);
            }
            resolve(gbkText);
          };
          gbkReader.onerror = () => reject(new Error('文件读取失败'));
          gbkReader.readAsText(file, 'GBK');
        } else {
          resolve(text);
        }
      };
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsText(file, 'UTF-8');
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="border-b bg-white dark:bg-slate-900">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <button className="inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-slate-100 dark:hover:bg-slate-800">
                <ArrowLeft className="mr-2 h-4 w-4" />
                返回
              </button>
            </Link>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              <h1 className="text-2xl font-bold">受访人清单</h1>
            </div>
          </div>
          <UserInfo />
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-6">
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle>受访人列表 ({filteredContacts.length})</CardTitle>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="搜索姓名、部门或电话"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-64"
                  />
                </div>
                {selectedIds.size > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleBatchDelete}
                    disabled={deleting}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {deleting ? '删除中...' : `删除选中 (${selectedIds.size})`}
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                  <Download className="h-4 w-4 mr-2" />
                  下载模板
                </Button>
                <input
                  type="file"
                  accept=".csv"
                  ref={fileInputRef}
                  onChange={handleImport}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importing}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {importing ? '导入中...' : '导入CSV'}
                </Button>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => {
                      setEditingContact(null);
                      setFormData({ name: '', department: '', phone: '', email: '', position: '' });
                    }}>
                      <Plus className="h-4 w-4 mr-2" />
                      添加受访人
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingContact ? '编辑受访人' : '添加受访人'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>姓名 *</Label>
                          <Input
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>部门 *</Label>
                          <Select
                            value={formData.department}
                            onValueChange={(value) => setFormData({ ...formData, department: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="选择部门" />
                            </SelectTrigger>
                            <SelectContent>
                              {DEPARTMENTS.map((dept) => (
                                <SelectItem key={dept} value={dept}>
                                  {dept}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>办公电话</Label>
                          <Input
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>职位</Label>
                          <Input
                            value={formData.position}
                            onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                          <Label>邮箱</Label>
                          <Input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-3">
                        <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                          取消
                        </Button>
                        <Button type="submit">
                          {editingContact ? '保存' : '添加'}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">加载中...</div>
            ) : filteredContacts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? '未找到匹配的受访人' : '暂无受访人数据'}
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedIds.size === paginatedContacts.length && paginatedContacts.length > 0}
                          onCheckedChange={() => {
                            if (selectedIds.size === paginatedContacts.length) {
                              setSelectedIds(new Set());
                            } else {
                              setSelectedIds(new Set(paginatedContacts.map(c => c.id)));
                            }
                          }}
                          className="cursor-pointer"
                        />
                      </TableHead>
                      <TableHead>姓名</TableHead>
                      <TableHead>部门</TableHead>
                      <TableHead>职位</TableHead>
                      <TableHead>办公电话</TableHead>
                      <TableHead>邮箱</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedContacts.map((contact) => (
                      <TableRow key={contact.id} className={selectedIds.has(contact.id) ? 'bg-blue-50 dark:bg-blue-950/30' : ''}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(contact.id)}
                            onCheckedChange={() => handleSelect(contact.id)}
                            className="cursor-pointer"
                          />
                        </TableCell>
                        <TableCell className="font-medium">{contact.name}</TableCell>
                        <TableCell>{contact.department}</TableCell>
                        <TableCell>{contact.position || '-'}</TableCell>
                        <TableCell>{contact.phone || '-'}</TableCell>
                        <TableCell>{contact.email || '-'}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(contact)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(contact.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                
                {/* 分页控件 */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between border-t pt-4 mt-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>每页</span>
                      <Select value={String(pageSize)} onValueChange={(v) => {
                        setPageSize(Number(v));
                        setCurrentPage(1);
                      }}>
                        <SelectTrigger className="w-16 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="20">20</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                        </SelectContent>
                      </Select>
                      <span>条</span>
                      <span className="ml-4">
                        共 {filteredContacts.length} 条，第 {currentPage}/{totalPages} 页
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                      >
                        首页
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="px-3 text-sm">
                        {currentPage} / {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages}
                      >
                        末页
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
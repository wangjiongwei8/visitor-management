'use client';

import * as React from 'react';
import { toast } from 'sonner';
import {
  Users,
  UserPlus,
  Upload,
  Download,
  Search,
  RefreshCw,
  Building2,
  Hash,
  MoreHorizontal,
  Edit,
  Trash2,
  UserCog,
  Shield,
  AlertCircle,
  CheckCircle2,
  FileText,
  X,
  KeyRound,
  RotateCcw,
  Clock,
  AlertTriangle,
  Eye,
  EyeOff,
  Key,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { usePagination } from '@/hooks/use-pagination';
import { DataPagination } from '@/components/ui/data-pagination';
import { Checkbox } from '@/components/ui/checkbox';

interface User {
  id: number;
  username: string;
  name: string;
  role: string;
  status: string;
  employeeId?: string;
  department?: string;
  phone?: string;
  createdAt: string;
  // 密码管理字段
  mustChangePassword?: boolean;
  passwordChangedAt?: string;
  passwordExpiresAt?: string;
}

const ROLE_LABELS: Record<string, string> = {
  admin: '管理员',
  security: '门卫',
  employee: '员工',
};

export default function UsersManagementPage() {
  const [users, setUsers] = React.useState<User[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [roleFilter, setRoleFilter] = React.useState('all');
  
  // 导入相关状态
  const [importDialogOpen, setImportDialogOpen] = React.useState(false);
  const [importFile, setImportFile] = React.useState<File | null>(null);
  const [importing, setImporting] = React.useState(false);
  const [importResult, setImportResult] = React.useState<{
    created: number;
    updated: number;
    failed: number;
    errors: string[];
    details: { name: string; employeeId: string; action: 'created' | 'updated' | 'failed'; reason?: string }[];
  } | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // 批量选择相关状态
  const [selectedIds, setSelectedIds] = React.useState<Set<number>>(new Set());

  // 新增用户相关状态
  const [addDialogOpen, setAddDialogOpen] = React.useState(false);
  const [newUser, setNewUser] = React.useState({
    name: '',
    role: 'employee',
    employeeId: '',
    department: '',
    password: '',
  });

  // 编辑用户相关状态
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [editingUser, setEditingUser] = React.useState<User | null>(null);
  const [editUserData, setEditUserData] = React.useState({
    name: '',
    role: '',
    employeeId: '',
    department: '',
    phone: '',
  });

  // 初始化密码相关状态
  const [initPwdDialogOpen, setInitPwdDialogOpen] = React.useState(false);
  const [initPwdUser, setInitPwdUser] = React.useState<User | null>(null);
  const [initPwdData, setInitPwdData] = React.useState({
    newPassword: '',
    confirmPassword: '',
    forceChange: true,
  });
  const [showInitPwd, setShowInitPwd] = React.useState(false);
  const [showInitConfirmPwd, setShowInitConfirmPwd] = React.useState(false);
  const [initPwdLoading, setInitPwdLoading] = React.useState(false);

  React.useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/users');
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
      toast.error('获取用户列表失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 下载统一导入模板
  const downloadTemplate = () => {
    const template = `角色,工号,姓名,部门
admin,A001,管理员张三,管理部
security,S001,门卫李四,安保部
security,S002,门卫王五,安保部
employee,E001,员工赵六,技术部
employee,E002,员工孙七,市场部
employee,E003,员工周八,人事部`;
    
    const blob = new Blob(['\ufeff' + template], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '用户导入模板.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // 处理文件选择
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // 检查文件类型
      const validTypes = ['text/csv', 'text/plain', 'application/vnd.ms-excel'];
      if (!validTypes.includes(file.type) && !file.name.endsWith('.csv')) {
        toast.error('请上传CSV格式的文件');
        return;
      }
      setImportFile(file);
      setImportResult(null);
    }
  };

  // 解析CSV文件（统一模板，支持角色字段，自动检测编码和分隔符）
  const parseCSVFile = async (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      // 先尝试 UTF-8 读取
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          let text = e.target?.result as string;
          
          // 先去掉 BOM 标记（必须在乱码检测之前）
          if (text.charCodeAt(0) === 0xFEFF) {
            text = text.substring(1);
          }
          
          // 检测是否为 GBK 编码被错误解读为 UTF-8（常见乱码特征）
          const hasGarbledChars = text.includes('�') || 
            /[\u00c0-\u00ff][\u0080-\u00bf]/.test(text) ||
            text.includes('锘') || // BOM 错误
            /^[^\u4e00-\u9fa5a-zA-Z0-9,\r\n\t;]/.test(text.trim()); // 开头是乱码
          
          console.log('[CSV解析] UTF-8读取，乱码检测:', hasGarbledChars, '首字符:', text.charCodeAt(0));
          
          // 如果检测到乱码，重新用 GBK 解码
          if (hasGarbledChars) {
            const gbkReader = new FileReader();
            gbkReader.onload = (e2) => {
              try {
                text = e2.target?.result as string;
                // GBK 读取后也要去掉 BOM
                if (text.charCodeAt(0) === 0xFEFF) {
                  text = text.substring(1);
                }
                processCSV(text);
              } catch (err) {
                reject(new Error('文件解析失败'));
              }
            };
            gbkReader.onerror = () => reject(new Error('文件读取失败'));
            gbkReader.readAsText(file, 'GBK');
            return;
          }
          
          processCSV(text);
        } catch (err) {
          reject(new Error('文件解析失败'));
        }
      };
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsText(file, 'UTF-8');
      
      function processCSV(text: string) {
        // 再次确保去掉 BOM 标记（双重保险）
        if (text.charCodeAt(0) === 0xFEFF) {
          text = text.substring(1);
        }
        
        // 统一换行符，处理 \r\n 和 \r
        const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const lines = normalizedText.split('\n').filter(line => line.trim());
        
        if (lines.length === 0) {
          resolve([]);
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
        
        console.log('[CSV解析] 检测到分隔符:', delimiter === '\t' ? '制表符' : delimiter === ';' ? '分号' : '逗号', '首行:', firstLine);
        
        // 检测是否有标题行（包含"角色"、"工号"或"姓名"等关键词）
        const columns = firstLine.split(delimiter).map(s => s.trim().replace(/^"(.*)"$/, '$1'));
        const hasHeader = columns.some(c => 
          c === '角色' || c === 'role' || c === '工号' || c === 'employeeId' || 
          c === '姓名' || c === 'name' || c === '部门' || c === 'department'
        );
        const startIndex = hasHeader ? 1 : 0;
        
        // 检测是否包含角色列
        const roleColumnIndex = columns.findIndex(c => c === '角色' || c === 'role');
        const hasRoleColumn = roleColumnIndex !== -1;
        
        // 自动检测列顺序（根据标题行）
        let colMapping: Record<string, number> = {};
        if (hasHeader) {
          columns.forEach((col, idx) => {
            const colLower = col.toLowerCase();
            // 同时检查中文和英文字段名（toLowerCase 对中文无效）
            if (col === '角色' || colLower === 'role') colMapping.role = idx;
            else if (col === '工号' || colLower === 'employeeid' || colLower === 'username') colMapping.employeeId = idx;
            else if (col === '姓名' || colLower === 'name') colMapping.name = idx;
            else if (col === '部门' || colLower === 'department') colMapping.department = idx;
          });
        }
        
        const hasColumnMapping = Object.keys(colMapping).length >= 2; // 至少有2列能识别
        
        const items = lines.slice(startIndex).map((line, idx) => {
          const parts = line.split(delimiter).map(s => s.trim().replace(/^"(.*)"$/, '$1'));
          
          let role, employeeId, name, department;
          
          if (hasColumnMapping) {
            // 根据标题行映射提取字段
            role = colMapping.role !== undefined ? parts[colMapping.role] : undefined;
            employeeId = colMapping.employeeId !== undefined ? parts[colMapping.employeeId] : parts[0];
            name = colMapping.name !== undefined ? parts[colMapping.name] : parts[1];
            department = colMapping.department !== undefined ? parts[colMapping.department] : parts[3];
          } else if (hasRoleColumn) {
            // 统一模板格式：角色,工号,姓名,部门
            [role, employeeId, name, department] = parts;
          } else {
            // 旧格式：工号,姓名,部门（默认为员工）
            [employeeId, name, department] = parts;
            role = 'employee';
          }
          
          // 验证角色值
          const validRoles = ['admin', 'security', 'employee', 'visitor', '管理员', '门卫', '员工', '访客'];
          let finalRole = role || 'employee';
          
          // 中文角色映射
          const roleMapping: Record<string, string> = {
            '管理员': 'admin',
            '门卫': 'security',
            '员工': 'employee',
            '访客': 'visitor',
          };
          
          if (roleMapping[finalRole]) {
            finalRole = roleMapping[finalRole];
          }
          
          return {
            username: employeeId,
            name,
            employeeId,
            department: department || '',
            role: finalRole,
            password: '123456',
          };
        }).filter(item => item.username && item.name);
        
        console.log('[CSV解析] 解析结果:', items.length, '条有效记录', items.slice(0, 3));
        
        // 调试：检查是否有重复工号
        const employeeIdSet = new Set<string>();
        const duplicates: string[] = [];
        items.forEach(item => {
          if (employeeIdSet.has(item.employeeId)) {
            duplicates.push(item.employeeId);
          } else {
            employeeIdSet.add(item.employeeId);
          }
        });
        
        if (duplicates.length > 0) {
          console.error('CSV解析发现重复工号:', duplicates);
          console.error('解析结果:', items.filter(i => duplicates.includes(i.employeeId)));
        }
        
        resolve(items);
      }
    });
  };

  // 重置导入对话框
  const resetImportDialog = () => {
    setImportFile(null);
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 执行导入
  const handleImport = async () => {
    if (!importFile) {
      toast.error('请先选择文件');
      return;
    }

    setImporting(true);
    setImportResult(null);

    try {
      const items = await parseCSVFile(importFile);
      
      console.log('[导入] 解析到', items.length, '条记录', items);
      
      if (items.length === 0) {
        toast.error('未能解析出有效数据，请检查文件格式。确保CSV使用逗号分隔，包含工号和姓名列。');
        setImporting(false);
        return;
      }

      const response = await fetch('/api/admin/users/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ users: items }),
      });

      console.log('[导入] API响应状态:', response.status);

      if (response.ok) {
        const result = await response.json();
        console.log('[导入] API返回结果:', result);
        setImportResult({
          created: result.created || 0,
          updated: result.updated || 0,
          failed: result.failed || 0,
          errors: result.errors || [],
          details: result.details || [],
        });
        
        if (result.created > 0 || result.updated > 0) {
          toast.success(`导入完成：新增 ${result.created} 名，更新 ${result.updated} 名`);
          fetchUsers();
        } else if (result.failed > 0) {
          toast.error(`导入失败 ${result.failed} 条，请查看明细`);
        }
      } else {
        const errorData = await response.json();
        console.error('[导入] API错误:', errorData);
        toast.error(errorData.error || '导入失败');
      }
    } catch (error) {
      console.error('Import failed:', error);
      toast.error(error instanceof Error ? error.message : '导入失败');
    } finally {
      setImporting(false);
    }
  };

  // 添加用户
  const handleAddUser = async () => {
    if (!newUser.employeeId || !newUser.name) {
      toast.error('请填写必填字段（工号和姓名）');
      return;
    }

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUser.employeeId, // 用户名统一为工号
          name: newUser.name,
          role: newUser.role,
          employeeId: newUser.employeeId,
          department: newUser.department,
          password: newUser.password || '123456',
        }),
      });

      if (response.ok) {
        toast.success('添加用户成功');
        setAddDialogOpen(false);
        setNewUser({
          name: '',
          role: 'employee',
          employeeId: '',
          department: '',
          password: '',
        });
        fetchUsers();
      } else {
        const error = await response.json();
        toast.error(error.error || '添加失败');
      }
    } catch (error) {
      console.error('Add user failed:', error);
      toast.error('添加失败');
    }
  };

  // 删除用户
  const handleDeleteUser = async (userId: number, userName: string) => {
    if (!confirm(`确定要删除用户 "${userName}" 吗？`)) return;

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('删除成功');
        fetchUsers();
      } else {
        const data = await response.json();
        toast.error(data.error || '删除失败');
      }
    } catch (error) {
      console.error('Delete user failed:', error);
      toast.error('删除失败');
    }
  };

  // 批量删除用户
  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`确定要删除选中的 ${selectedIds.size} 名用户吗？此操作不可恢复！`)) return;

    try {
      const response = await fetch('/api/admin/users/batch-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message || `成功删除 ${data.count} 名用户`);
        setSelectedIds(new Set());
        fetchUsers();
      } else {
        const data = await response.json();
        toast.error(data.error || '批量删除失败');
      }
    } catch (error) {
      console.error('Batch delete failed:', error);
      toast.error('批量删除失败');
    }
  };

  // 选择/取消选择单个用户
  const toggleSelectUser = (userId: number, isAdmin: boolean) => {
    if (isAdmin) return; // admin 用户不可选
    const newSet = new Set(selectedIds);
    if (newSet.has(userId)) {
      newSet.delete(userId);
    } else {
      newSet.add(userId);
    }
    setSelectedIds(newSet);
  };

  // 全选/取消全选（当前页，排除 admin）
  const toggleSelectAll = () => {
    const selectableIds = paginatedUsers
      .filter(u => u.username !== 'admin')
      .map(u => u.id);

    const allSelected = selectableIds.every(id => selectedIds.has(id));

    if (allSelected) {
      // 取消当前页的选择
      const newSet = new Set(selectedIds);
      selectableIds.forEach(id => newSet.delete(id));
      setSelectedIds(newSet);
    } else {
      // 选中当前页所有可选用户
      const newSet = new Set(selectedIds);
      selectableIds.forEach(id => newSet.add(id));
      setSelectedIds(newSet);
    }
  };

  // 重置密码
  const handleResetPassword = async (userId: number, userName: string) => {
    if (!confirm(`确定要重置用户 "${userName}" 的密码吗？\n密码将被重置为默认密码，用户首次登录需修改。`)) return;

    try {
      const response = await fetch(`/api/admin/users/${userId}/reset-password`, {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message || '密码重置成功');
        fetchUsers();
      } else {
        const data = await response.json();
        toast.error(data.error || '重置失败');
      }
    } catch (error) {
      console.error('Reset password failed:', error);
      toast.error('重置密码失败');
    }
  };

  // 初始化密码 - 打开对话框
  const handleOpenInitPwd = (user: User) => {
    setInitPwdUser(user);
    setInitPwdData({ newPassword: '', confirmPassword: '', forceChange: true });
    setShowInitPwd(false);
    setShowInitConfirmPwd(false);
    setInitPwdDialogOpen(true);
  };

  // 初始化密码 - 提交
  const handleInitPassword = async () => {
    if (!initPwdUser) return;

    if (!initPwdData.newPassword) {
      toast.error('请输入新密码');
      return;
    }

    if (initPwdData.newPassword.length < 6) {
      toast.error('密码长度不能少于6位');
      return;
    }

    if (initPwdData.newPassword !== initPwdData.confirmPassword) {
      toast.error('两次输入的密码不一致');
      return;
    }

    setInitPwdLoading(true);
    try {
      const response = await fetch(`/api/admin/users/${initPwdUser.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newPassword: initPwdData.newPassword,
          forceChange: initPwdData.forceChange,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message || '密码初始化成功');
        setInitPwdDialogOpen(false);
        setInitPwdUser(null);
        fetchUsers();
      } else {
        const data = await response.json();
        toast.error(data.error || '初始化失败');
      }
    } catch (error) {
      console.error('Init password failed:', error);
      toast.error('密码初始化失败');
    } finally {
      setInitPwdLoading(false);
    }
  };

  // 格式化日期
  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  // 检查密码是否即将过期
  const isPasswordExpiringSoon = (user: User) => {
    if (!user.passwordExpiresAt) return false;
    const expiryDate = new Date(user.passwordExpiresAt);
    const now = new Date();
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 7 && daysUntilExpiry > 0;
  };

  // 检查密码是否已过期
  const isPasswordExpired = (user: User) => {
    if (!user.passwordExpiresAt) return false;
    const expiryDate = new Date(user.passwordExpiresAt);
    return expiryDate < new Date();
  };

  // 编辑用户 - 打开对话框
  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setEditUserData({
      name: user.name,
      role: user.role,
      employeeId: user.employeeId || user.username,
      department: user.department || '',
      phone: user.phone || '',
    });
    setEditDialogOpen(true);
  };

  // 编辑用户 - 提交
  const handleUpdateUser = async () => {
    if (!editingUser) return;

    try {
      const response = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editUserData.name,
          role: editUserData.role,
          employeeId: editUserData.employeeId,
          department: editUserData.department,
          phone: editUserData.phone,
        }),
      });

      if (response.ok) {
        toast.success('更新成功');
        setEditDialogOpen(false);
        fetchUsers();
      } else {
        const data = await response.json();
        toast.error(data.error || '更新失败');
      }
    } catch (error) {
      console.error('Update user failed:', error);
      toast.error('更新失败');
    }
  };

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      admin: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-300 dark:border-purple-900/40',
      security: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900/40',
      employee: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-900/40',
    };
    return colors[role] || 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400';
  };

  const getStatusBadge = (status: string) => {
    return status === 'active'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900/40'
      : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-900/40';
  };

  // 过滤用户并排序
  const filteredUsers = users
    .filter((user) => {
      const matchesSearch =
        user.name.includes(searchQuery) ||
        user.username.includes(searchQuery) ||
        user.employeeId?.includes(searchQuery) ||
        user.department?.includes(searchQuery);

      const matchesRole = roleFilter === 'all' || user.role === roleFilter;

      return matchesSearch && matchesRole;
    })
    .sort((a, b) => {
      // 排序优先级：角色 > 工号 > 姓名 > 部门 > 状态
      const roleOrder: Record<string, number> = { admin: 0, security: 1, employee: 2, visitor: 3 };
      
      // 1. 角色排序
      const roleCompare = (roleOrder[a.role] ?? 99) - (roleOrder[b.role] ?? 99);
      if (roleCompare !== 0) return roleCompare;
      
      // 2. 工号排序
      const empIdA = a.employeeId || a.username || '';
      const empIdB = b.employeeId || b.username || '';
      const empIdCompare = empIdA.localeCompare(empIdB, 'zh-CN');
      if (empIdCompare !== 0) return empIdCompare;
      
      // 3. 姓名排序
      const nameCompare = a.name.localeCompare(b.name, 'zh-CN');
      if (nameCompare !== 0) return nameCompare;
      
      // 4. 部门排序
      const deptCompare = (a.department || '').localeCompare(b.department || '', 'zh-CN');
      if (deptCompare !== 0) return deptCompare;
      
      // 5. 状态排序
      return (a.status === 'active' ? 0 : 1) - (b.status === 'active' ? 0 : 1);
    });

  // 统计各角色数量（不包含访客，访客通过预约系统录入）
  const roleCounts = {
    admin: users.filter(u => u.role === 'admin').length,
    security: users.filter(u => u.role === 'security').length,
    employee: users.filter(u => u.role === 'employee').length,
  };

  // 分页
  const {
    currentPage,
    totalPages,
    pageSize,
    paginatedData: paginatedUsers,
    goToPage,
    setPageSize,
    startIndex,
    endIndex,
  } = usePagination({ data: filteredUsers });

  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">用户管理</h1>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-0.5">管理系统用户和员工信息</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchUsers}
            disabled={isLoading}
            className="h-8 rounded-lg border-slate-200 dark:border-slate-700 gap-1.5"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
            刷新
          </Button>
          <Dialog open={importDialogOpen} onOpenChange={(open) => {
            setImportDialogOpen(open);
            if (!open) resetImportDialog();
          }}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 rounded-lg border-slate-200 dark:border-slate-700 gap-1.5">
                <Upload className="h-3.5 w-3.5" />
                批量导入
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-base">批量导入用户</DialogTitle>
                <DialogDescription className="text-sm">
                  上传CSV文件批量导入用户，支持一次性导入不同角色的用户
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-3">
                {/* 模板格式说明 */}
                <Card className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 rounded-xl">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="font-semibold text-sm">
                        统一模板格式：角色,工号,姓名,部门
                      </Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={downloadTemplate}
                        className="h-7 text-xs rounded-lg gap-1"
                      >
                        <Download className="h-3.5 w-3.5" />
                        下载模板
                      </Button>
                    </div>
                    <div className="text-xs text-slate-400 dark:text-slate-500 space-y-1">
                      <p>• 角色可选值：admin（管理员）、security（门卫）、employee（员工）</p>
                      <p>• 也支持中文角色名：管理员、门卫、员工</p>
                      <p>• 第一行可以是标题行，系统会自动跳过</p>
                      <p>• 默认密码为系统设定值，请提醒用户首次登录后修改</p>
                      <p>• 工号已存在时将更新姓名、角色、部门信息（不修改密码）</p>
                    </div>
                  </CardContent>
                </Card>

                {/* 文件上传区域 */}
                <div
                  className={cn(
                    'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all',
                    'hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/20',
                    importFile ? 'border-green-400 bg-green-50/50 dark:bg-green-950/20' : 'border-slate-300 dark:border-slate-700'
                  )}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv,text/plain"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  {importFile ? (
                    <div className="flex items-center justify-center gap-3">
                      <FileText className="h-8 w-8 text-green-600" />
                      <div className="text-left">
                        <p className="font-medium text-green-700 dark:text-green-300">{importFile.name}</p>
                        <p className="text-sm text-slate-500">{(importFile.size / 1024).toFixed(1)} KB</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="ml-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          setImportFile(null);
                          setImportResult(null);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div>
                      <Upload className="h-10 w-10 text-slate-400 mx-auto mb-2" />
                      <p className="text-slate-600 dark:text-slate-400">点击或拖拽上传CSV文件</p>
                      <p className="text-sm text-slate-400 mt-1">支持 .csv 格式</p>
                    </div>
                  )}
                </div>

                {/* 导入结果 */}
                {importResult && (
                  <div className="space-y-3">
                    <div className="flex gap-4">
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle2 className="h-4 w-4" />
                        新增: {importResult.created}
                      </div>
                      <div className="flex items-center gap-2 text-blue-600">
                        <Edit className="h-4 w-4" />
                        更新: {importResult.updated}
                      </div>
                      {importResult.failed > 0 && (
                        <div className="flex items-center gap-2 text-red-600">
                          <AlertCircle className="h-4 w-4" />
                          失败: {importResult.failed}
                        </div>
                      )}
                    </div>
                    {importResult.details && importResult.details.length > 0 && (
                      <div className="border rounded-lg overflow-auto max-h-48">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                              <TableHead className="text-xs py-2">姓名</TableHead>
                              <TableHead className="text-xs py-2">工号</TableHead>
                              <TableHead className="text-xs py-2">操作</TableHead>
                              <TableHead className="text-xs py-2">说明</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {importResult.details.map((d, i) => (
                              <TableRow key={i}>
                                <TableCell className="text-xs py-1.5">{d.name}</TableCell>
                                <TableCell className="text-xs py-1.5 font-mono">{d.employeeId}</TableCell>
                                <TableCell className="text-xs py-1.5">
                                  {d.action === 'created' && (
                                    <Badge className="text-xs bg-green-50 text-green-700 border-green-200">新增</Badge>
                                  )}
                                  {d.action === 'updated' && (
                                    <Badge className="text-xs bg-blue-50 text-blue-700 border-blue-200">更新</Badge>
                                  )}
                                  {d.action === 'failed' && (
                                    <Badge className="text-xs bg-red-50 text-red-700 border-red-200">失败</Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-xs py-1.5 text-slate-500">{d.reason || '—'}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                    {importResult.errors.length > 0 && (
                      <div className="text-xs text-red-600 space-y-1 max-h-24 overflow-auto">
                        {importResult.errors.map((err, i) => (
                          <p key={i}>{err}</p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setImportDialogOpen(false)} className="rounded-lg">
                  关闭
                </Button>
                <Button onClick={handleImport} disabled={importing || !importFile} className="rounded-lg bg-blue-600 hover:bg-blue-700">
                  {importing ? '导入中...' : '确认导入'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8 rounded-lg bg-blue-600 hover:bg-blue-700 gap-1.5">
                <UserPlus className="h-3.5 w-3.5" />
                添加用户
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-base">添加新用户</DialogTitle>
                <DialogDescription className="text-sm">
                  创建新的系统用户，工号将作为登录账号
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {/* 角色选择 */}
                <div className="space-y-2">
                  <Label>用户角色 *</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 'admin', label: '管理员', icon: UserCog, color: 'text-purple-600' },
                      { value: 'security', label: '门卫', icon: Shield, color: 'text-green-600' },
                      { value: 'employee', label: '员工', icon: Users, color: 'text-blue-600' },
                    ].map((role) => (
                      <div
                        key={role.value}
                        className={cn(
                          'flex flex-col items-center gap-1 p-3 rounded-lg border-2 cursor-pointer transition-all',
                          newUser.role === role.value
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                            : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'
                        )}
                        onClick={() => setNewUser({ ...newUser, role: role.value })}
                      >
                        <role.icon className={cn('h-5 w-5', role.color)} />
                        <span className="text-sm font-medium">{role.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 基本信息 */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="employeeId">工号 * <span className="text-xs text-slate-500">(登录账号)</span></Label>
                    <Input
                      id="employeeId"
                      value={newUser.employeeId}
                      onChange={(e) => setNewUser({ ...newUser, employeeId: e.target.value })}
                      placeholder="工号即登录账号"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">姓名 *</Label>
                    <Input
                      id="name"
                      value={newUser.name}
                      onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                      placeholder="用户姓名"
                    />
                  </div>
                </div>

                {/* 部门 */}
                <div className="space-y-2">
                  <Label htmlFor="department">部门</Label>
                  <Input
                    id="department"
                    value={newUser.department}
                    onChange={(e) => setNewUser({ ...newUser, department: e.target.value })}
                    placeholder="所属部门"
                  />
                </div>

                {/* 密码 */}
                <div className="space-y-2">
                  <Label htmlFor="password">初始密码</Label>
                  <Input
                    id="password"
                    type="text"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    placeholder="默认为系统设定密码"
                  />
                  <p className="text-xs text-slate-500">留空则使用密码策略中的默认密码</p>
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setAddDialogOpen(false)} className="rounded-lg">
                  取消
                </Button>
                <Button onClick={handleAddUser} className="rounded-lg bg-blue-600 hover:bg-blue-700">确认添加</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* 编辑用户对话框 */}
          <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogContent className="sm:max-w-[425px] rounded-xl">
              <DialogHeader>
                <DialogTitle>编辑用户</DialogTitle>
                <DialogDescription>
                  修改用户信息
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-name" className="text-right text-sm">姓名</Label>
                  <Input
                    id="edit-name"
                    value={editUserData.name}
                    onChange={(e) => setEditUserData({ ...editUserData, name: e.target.value })}
                    className="col-span-3 rounded-lg text-sm"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-role" className="text-right text-sm">角色</Label>
                  <Select value={editUserData.role} onValueChange={(v) => setEditUserData({ ...editUserData, role: v })}>
                    <SelectTrigger id="edit-role" className="col-span-3 rounded-lg text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">管理员</SelectItem>
                      <SelectItem value="security">门卫</SelectItem>
                      <SelectItem value="employee">员工</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-employeeId" className="text-right text-sm">工号</Label>
                  <Input
                    id="edit-employeeId"
                    value={editUserData.employeeId}
                    onChange={(e) => setEditUserData({ ...editUserData, employeeId: e.target.value })}
                    className="col-span-3 rounded-lg text-sm"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-department" className="text-right text-sm">部门</Label>
                  <Input
                    id="edit-department"
                    value={editUserData.department}
                    onChange={(e) => setEditUserData({ ...editUserData, department: e.target.value })}
                    className="col-span-3 rounded-lg text-sm"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-phone" className="text-right text-sm">电话</Label>
                  <Input
                    id="edit-phone"
                    value={editUserData.phone}
                    onChange={(e) => setEditUserData({ ...editUserData, phone: e.target.value })}
                    className="col-span-3 rounded-lg text-sm"
                  />
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setEditDialogOpen(false)} className="rounded-lg">
                  取消
                </Button>
                <Button onClick={handleUpdateUser} className="rounded-lg bg-blue-600 hover:bg-blue-700">保存修改</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* 初始化密码对话框 */}
          <Dialog open={initPwdDialogOpen} onOpenChange={setInitPwdDialogOpen}>
            <DialogContent className="sm:max-w-[420px] rounded-xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5 text-emerald-600" />
                  初始化密码
                </DialogTitle>
                <DialogDescription>
                  为用户「{initPwdUser?.name}」设置新密码
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                {/* 新密码 */}
                <div className="space-y-2">
                  <Label htmlFor="init-newPassword" className="text-sm">新密码</Label>
                  <div className="relative">
                    <Input
                      id="init-newPassword"
                      type={showInitPwd ? 'text' : 'password'}
                      value={initPwdData.newPassword}
                      onChange={(e) => setInitPwdData({ ...initPwdData, newPassword: e.target.value })}
                      placeholder="请输入新密码"
                      className="pr-10 rounded-lg text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowInitPwd(!showInitPwd)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showInitPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* 确认密码 */}
                <div className="space-y-2">
                  <Label htmlFor="init-confirmPassword" className="text-sm">确认密码</Label>
                  <div className="relative">
                    <Input
                      id="init-confirmPassword"
                      type={showInitConfirmPwd ? 'text' : 'password'}
                      value={initPwdData.confirmPassword}
                      onChange={(e) => setInitPwdData({ ...initPwdData, confirmPassword: e.target.value })}
                      placeholder="请再次输入新密码"
                      className="pr-10 rounded-lg text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowInitConfirmPwd(!showInitConfirmPwd)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showInitConfirmPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {initPwdData.confirmPassword && initPwdData.newPassword !== initPwdData.confirmPassword && (
                    <p className="text-xs text-red-500">两次输入的密码不一致</p>
                  )}
                </div>

                {/* 强制修改 */}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50">
                  <input
                    type="checkbox"
                    id="init-forceChange"
                    checked={initPwdData.forceChange}
                    onChange={(e) => setInitPwdData({ ...initPwdData, forceChange: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <Label htmlFor="init-forceChange" className="text-sm font-medium text-amber-700 dark:text-amber-300 cursor-pointer">
                      强制用户下次登录修改密码
                    </Label>
                    <p className="text-xs text-amber-600/70 dark:text-amber-400/50 mt-0.5">建议勾选，确保用户使用自己的密码</p>
                  </div>
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setInitPwdDialogOpen(false)} className="rounded-lg">
                  取消
                </Button>
                <Button
                  onClick={handleInitPassword}
                  disabled={initPwdLoading || !initPwdData.newPassword || !initPwdData.confirmPassword || initPwdData.newPassword !== initPwdData.confirmPassword}
                  className="rounded-lg bg-emerald-600 hover:bg-emerald-700"
                >
                  {initPwdLoading ? '提交中...' : '确认初始化'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card
          className="cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 border-purple-100 dark:border-purple-900/30 stat-card-purple"
          onClick={() => setRoleFilter('admin')}
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">管理员</p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1 tabular-nums">{roleCounts.admin}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 shadow-sm">
                <UserCog className="h-5 w-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className="cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 border-emerald-100 dark:border-emerald-900/30 stat-card-green"
          onClick={() => setRoleFilter('security')}
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">门卫</p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">{roleCounts.security}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-sm">
                <Shield className="h-5 w-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className="cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 border-blue-100 dark:border-blue-900/30 stat-card-blue"
          onClick={() => setRoleFilter('employee')}
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">员工</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1 tabular-nums">{roleCounts.employee}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-sm">
                <Users className="h-5 w-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 搜索和筛选 */}
      <Card className="border-slate-200/80 dark:border-slate-800">
        <CardContent className="pt-4 pb-4 px-5">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="搜索姓名、用户名、工号、部门..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-sm rounded-lg border-slate-200 dark:border-slate-700"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-32 h-9 text-sm rounded-lg border-slate-200 dark:border-slate-700">
                <SelectValue placeholder="角色筛选" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">全部角色</SelectItem>
                <SelectItem value="admin">管理员</SelectItem>
                <SelectItem value="security">门卫</SelectItem>
                <SelectItem value="employee">员工</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* 用户列表 */}
      <Card className="border-slate-200/80 dark:border-slate-800">
        <CardHeader className="pb-3 pt-4 px-5">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold">用户列表</CardTitle>
              <CardDescription className="text-xs">
                共 {filteredUsers.length} 名用户
                {roleFilter !== 'all' && ` (${ROLE_LABELS[roleFilter]})`}
                {selectedIds.size > 0 && ` · 已选 ${selectedIds.size} 名`}
              </CardDescription>
            </div>
            {selectedIds.size > 0 && (
              <Button
                variant="destructive"
                size="sm"
                className="h-8 rounded-lg gap-1.5"
                onClick={handleBatchDelete}
              >
                <Trash2 className="h-3.5 w-3.5" />
                删除选中 ({selectedIds.size})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="border border-slate-200/80 dark:border-slate-700/80 rounded-xl overflow-auto max-h-[60vh]">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200/80 dark:border-slate-700/80 sticky top-0 z-10">
                  <TableHead className="w-[40px] text-xs font-semibold text-slate-500 dark:text-slate-400 py-3 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-sm">
                    <Checkbox
                      checked={
                        paginatedUsers.filter(u => u.username !== 'admin').length > 0 &&
                        paginatedUsers.filter(u => u.username !== 'admin').every(u => selectedIds.has(u.id))
                      }
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 dark:text-slate-400 py-3 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-sm">工号</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 dark:text-slate-400 py-3 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-sm">姓名</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 dark:text-slate-400 py-3 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-sm">角色</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 dark:text-slate-400 py-3 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-sm">部门</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 dark:text-slate-400 py-3 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-sm">密码状态</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 dark:text-slate-400 py-3 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-sm">状态</TableHead>
                  <TableHead className="w-[150px] text-xs font-semibold text-slate-500 dark:text-slate-400 py-3 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-sm">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-slate-400 text-sm">
                      <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-slate-300" />
                      加载中...
                    </TableCell>
                  </TableRow>
                ) : paginatedUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-slate-400 text-sm">
                      暂无用户数据
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedUsers.map((user) => (
                    <TableRow
                      key={user.id}
                      className={cn(
                        'hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-b-0',
                        selectedIds.has(user.id) && 'bg-blue-50/50 dark:bg-blue-950/20'
                      )}
                    >
                      <TableCell className="py-3">
                        <Checkbox
                          checked={selectedIds.has(user.id)}
                          onCheckedChange={() => toggleSelectUser(user.id, user.username === 'admin')}
                          disabled={user.username === 'admin'}
                        />
                      </TableCell>
                      <TableCell className="py-3 font-mono text-sm font-medium text-slate-600 dark:text-slate-400">
                        {user.employeeId || user.username}
                      </TableCell>
                      <TableCell className="py-3 text-sm font-medium text-slate-800 dark:text-slate-200">
                        {user.name}
                        {user.username === 'admin' && (
                          <span className="ml-1 text-xs text-purple-500">系统</span>
                        )}
                      </TableCell>
                      <TableCell className="py-3">
                        <Badge className={cn('text-xs border rounded-md font-medium', getRoleBadgeColor(user.role))}>
                          {ROLE_LABELS[user.role] || user.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-3">
                        {user.department ? (
                          <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400">
                            <Building2 className="h-3 w-3 text-slate-400 shrink-0" />
                            {user.department}
                          </div>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600 text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell className="py-3">
                        {user.mustChangePassword ? (
                          <Badge className="text-xs border rounded-md font-medium bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900/40">
                            <KeyRound className="h-3 w-3 mr-1" />
                            待修改
                          </Badge>
                        ) : isPasswordExpired(user) ? (
                          <Badge className="text-xs border rounded-md font-medium bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-900/40">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            已过期
                          </Badge>
                        ) : isPasswordExpiringSoon(user) ? (
                          <Badge className="text-xs border rounded-md font-medium bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-300 dark:border-orange-900/40">
                            <Clock className="h-3 w-3 mr-1" />
                            即将过期
                          </Badge>
                        ) : (
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            <CheckCircle2 className="h-3 w-3 inline mr-1 text-green-600" />
                            {formatDate(user.passwordChangedAt)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="py-3">
                        <Badge className={cn('text-xs border rounded-md font-medium', getStatusBadge(user.status))}>
                          {user.status === 'active' ? '正常' : '禁用'}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-3 relative">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            className="h-8 w-8 rounded text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 flex items-center justify-center cursor-pointer border border-transparent hover:border-blue-200"
                            title="编辑"
                            onClick={() => handleEditUser(user)}
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="h-8 w-8 rounded text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 flex items-center justify-center cursor-pointer border border-transparent hover:border-emerald-200"
                            onClick={() => handleOpenInitPwd(user)}
                            title="初始化密码"
                          >
                            <Key className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="h-8 w-8 rounded text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 flex items-center justify-center cursor-pointer border border-transparent hover:border-amber-200"
                            onClick={() => handleResetPassword(user.id, user.name)}
                            title="重置密码"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </button>
                          {user.username !== 'admin' && (
                            <button
                              type="button"
                              className="h-8 w-8 rounded text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center justify-center cursor-pointer border border-transparent hover:border-red-200"
                              onClick={() => handleDeleteUser(user.id, user.name)}
                              title="删除"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          
          {/* 分页控件 */}
          <DataPagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            total={filteredUsers.length}
            startIndex={startIndex}
            endIndex={endIndex}
            onPageChange={goToPage}
            onPageSizeChange={setPageSize}
          />
        </CardContent>
      </Card>
    </div>
  );
}

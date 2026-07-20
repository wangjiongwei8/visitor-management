import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/storage/database/shared/schema';
import { hashPassword, parseToken } from '@/lib/auth';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  // 生产环境禁止
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: '此接口在生产环境中不可用' }, { status: 403 });
  }

  // 必须管理员认证
  const token = request.cookies.get('auth-token')?.value;
  if (!token) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }
  const userData = parseToken(token);
  if (!userData || userData.role !== 'admin') {
    return NextResponse.json({ error: '仅管理员可执行此操作' }, { status: 403 });
  }

  try {
    const testUsers = [
      { username: 'E003', name: '王五', role: 'employee', employeeId: 'E003', department: '销售部', phone: '13800000003' },
      { username: 'E004', name: '赵六', role: 'employee', employeeId: 'E004', department: '市场部', phone: '13800000004' },
      { username: 'E005', name: '钱七', role: 'employee', employeeId: 'E005', department: '人事部', phone: '13800000005' },
      { username: 'E006', name: '孙八', role: 'employee', employeeId: 'E006', department: '财务部', phone: '13800000006' },
      { username: 'E007', name: '周九', role: 'employee', employeeId: 'E007', department: '采购部', phone: '13800000007' },
      { username: 'E008', name: '吴十', role: 'employee', employeeId: 'E008', department: '客服部', phone: '13800000008' },
      { username: 'E009', name: '郑十一', role: 'employee', employeeId: 'E009', department: '技术部', phone: '13800000009' },
      { username: 'E010', name: '冯十二', role: 'employee', employeeId: 'E010', department: '生产部', phone: '13800000010' },
      { username: 'S003', name: '保安C', role: 'security', employeeId: 'S003', department: '安保部', phone: '13800000011' },
      { username: 'S004', name: '保安D', role: 'security', employeeId: 'S004', department: '安保部', phone: '13800000012' },
    ];

    const results = [];
    for (const user of testUsers) {
      const hashedPassword = hashPassword('123456');
      try {
        await db.insert(users).values({
          username: user.username,
          name: user.name,
          role: user.role,
          password: hashedPassword,
          employeeId: user.employeeId,
          department: user.department,
          phone: user.phone,
          status: 'active',
        });
        results.push({ username: user.username, status: 'created' });
      } catch (error: unknown) {
        const err = error as { code?: string; message?: string };
        if (err.code === '23505') {
          results.push({ username: user.username, status: 'already exists' });
        } else {
          results.push({ username: user.username, status: 'error', message: err.message });
        }
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('Insert test data failed:', error);
    return NextResponse.json({ error: '插入测试数据失败' }, { status: 500 });
  }
}

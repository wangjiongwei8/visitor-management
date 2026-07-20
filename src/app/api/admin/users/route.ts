import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/storage/database/shared/schema';
import { desc, eq } from 'drizzle-orm';
import { parseToken, getUserById, hashPassword } from '@/lib/auth';
import { cookies } from 'next/headers';

const ROLE_LABELS: Record<string, string> = {
  admin: '管理员',
  security: '门卫',
  employee: '员工',
};

// GET - 获取所有用户列表（仅管理员）
export async function GET() {
  try {
    // 验证权限
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const userData = parseToken(token);
    if (!userData) {
      return NextResponse.json({ error: '登录已过期' }, { status: 401 });
    }

    const user = await getUserById(userData.userId);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: '无权限访问' }, { status: 403 });
    }

    // 查询所有用户（包含员工扩展字段）
    const allUsers = await db
      .select({
        id: users.id,
        username: users.username,
        name: users.name,
        role: users.role,
        status: users.status,
        employeeId: users.employeeId,
        department: users.department,
        phone: users.phone,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt));

    return NextResponse.json(allUsers);
  } catch (error) {
    console.error('Failed to fetch users:', error);
    return NextResponse.json({ error: '获取用户列表失败' }, { status: 500 });
  }
}

// POST - 创建新用户（仅管理员）
export async function POST(request: NextRequest) {
  try {
    // 验证权限
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const userData = parseToken(token);
    if (!userData) {
      return NextResponse.json({ error: '登录已过期' }, { status: 401 });
    }

    const currentUser = await getUserById(userData.userId);
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: '无权限访问' }, { status: 403 });
    }

    const body = await request.json();
    const { username, name, role, password, employeeId, department } = body;

    // 用户名统一为工号
    const finalUsername = username || employeeId;
    const finalEmployeeId = employeeId || username;

    // 检查必填字段
    if (!finalUsername || !name) {
      return NextResponse.json({ error: '工号和姓名为必填项' }, { status: 400 });
    }

    // 检查用户名/工号是否已存在
    const existingUsers = await db
      .select()
      .from(users)
      .where(eq(users.username, finalUsername));

    if (existingUsers.length > 0) {
      return NextResponse.json({ error: '工号已存在，请使用其他工号' }, { status: 400 });
    }

    // 创建用户
    const defaultPassword = password || '123456';
    const hashedPassword = hashPassword(defaultPassword);
    const newUser = await db
      .insert(users)
      .values({
        username: finalUsername, // 用户名统一为工号
        name,
        role: role || 'employee',
        password: hashedPassword,
        employeeId: finalEmployeeId, // 工号
        department: department || null,
        status: 'active',
        mustChangePassword: true, // 新用户必须修改密码
      })
      .returning();

    return NextResponse.json({
      id: newUser[0].id,
      username: newUser[0].username,
      name: newUser[0].name,
      role: newUser[0].role,
      employeeId: newUser[0].employeeId,
      department: newUser[0].department,
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to create user:', error);
    return NextResponse.json({ error: '创建用户失败' }, { status: 500 });
  }
}

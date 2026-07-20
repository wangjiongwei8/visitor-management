import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users, passwordPolicy } from '@/storage/database/shared/schema';
import { eq, or, inArray } from 'drizzle-orm';
import { parseToken, getUserById, hashPassword } from '@/lib/auth';
import { cookies } from 'next/headers';

interface UserImport {
  username: string;
  name: string;
  employeeId: string;
  department?: string;
  role: string;
  password: string;
}

interface ImportDetail {
  name: string;
  employeeId: string;
  action: 'created' | 'updated' | 'failed';
  reason?: string;
}

// POST - 批量导入用户（upsert 模式：工号存在则更新，不存在则新增）
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

    const user = await getUserById(userData.userId);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: '无权限访问' }, { status: 403 });
    }

    const body = await request.json();
    const { users: usersToImport } = body as { users: UserImport[] };

    if (!usersToImport || !Array.isArray(usersToImport) || usersToImport.length === 0) {
      return NextResponse.json({ error: '请提供有效的用户数据' }, { status: 400 });
    }

    // 检测CSV文件内重复工号
    const employeeIdCounts = new Map<string, number>();
    const duplicateInFile: string[] = [];

    usersToImport.forEach((userData) => {
      const empId = userData.employeeId || userData.username;
      if (empId) {
        const count = employeeIdCounts.get(empId) || 0;
        employeeIdCounts.set(empId, count + 1);
        if (count === 1) {
          duplicateInFile.push(empId);
        }
      }
    });

    if (duplicateInFile.length > 0) {
      return NextResponse.json({
        error: `CSV文件内存在重复工号：${duplicateInFile.slice(0, 5).join('、')}${duplicateInFile.length > 5 ? '等' : ''}，请检查文件后重新导入`,
        duplicateEmployeeIds: duplicateInFile,
        duplicateType: 'in_file',
        failCount: usersToImport.length,
        total: usersToImport.length,
      }, { status: 400 });
    }

    // 获取所有要导入的工号
    const employeeIds = usersToImport
      .map(u => u.employeeId || u.username)
      .filter(Boolean);

    // 查询数据库中已存在的工号
    let existingUsers: any[] = [];
    if (employeeIds.length > 0) {
      existingUsers = await db
        .select()
        .from(users)
        .where(
          or(
            inArray(users.username, employeeIds),
            inArray(users.employeeId, employeeIds)
          )
        );
    }

    // 构建已存在用户的映射：工号 -> 用户记录
    const existingMap = new Map<string, any>();
    existingUsers.forEach(u => {
      const key = u.username || u.employeeId;
      if (key) existingMap.set(key, u);
    });

    // 验证角色类型
    const validRoles = ['admin', 'security', 'employee'];
    const roleMapping: Record<string, string> = {
      '管理员': 'admin',
      '门卫': 'security',
      '员工': 'employee',
    };

    // 获取密码策略中的默认密码设置
    let defaultPassword = '123456';
    let forceChangeOnFirstLogin = true;
    try {
      const policies = await db.select().from(passwordPolicy).where(eq(passwordPolicy.isActive, true)).limit(1);
      if (policies.length > 0) {
        defaultPassword = policies[0].defaultPassword || '123456';
        forceChangeOnFirstLogin = policies[0].forceChangeOnFirstLogin !== false;
      }
    } catch (e) {
      console.error('Failed to fetch password policy for import, using defaults:', e);
    }

    let createdCount = 0;
    let updatedCount = 0;
    let failCount = 0;
    const errors: string[] = [];
    const details: ImportDetail[] = [];

    for (const userData of usersToImport) {
      try {
        // 检查必填字段
        if (!userData.employeeId && !userData.username) {
          errors.push(`跳过：${userData.name || '未知'} - 缺少工号`);
          details.push({ name: userData.name || '未知', employeeId: '—', action: 'failed', reason: '缺少工号' });
          failCount++;
          continue;
        }

        if (!userData.name) {
          const empId = userData.employeeId || userData.username;
          errors.push(`跳过：工号 ${empId} - 缺少姓名`);
          details.push({ name: '—', employeeId: empId, action: 'failed', reason: '缺少姓名' });
          failCount++;
          continue;
        }

        // 统一使用工号作为用户名
        const employeeId = userData.employeeId || userData.username;

        // 验证并转换角色
        let role = userData.role || 'employee';
        if (roleMapping[role]) {
          role = roleMapping[role];
        }
        if (!validRoles.includes(role)) {
          errors.push(`跳过：${userData.name} (${employeeId}) - 无效角色 "${userData.role}"`);
          details.push({ name: userData.name, employeeId, action: 'failed', reason: `无效角色 "${userData.role}"` });
          failCount++;
          continue;
        }

        // 判断工号是否已存在
        const existingUser = existingMap.get(employeeId);

        if (existingUser) {
          // 工号已存在，更新用户信息（不修改密码）
          await db.update(users)
            .set({
              name: userData.name,
              role: role,
              department: userData.department || null,
              updatedAt: new Date(),
            })
            .where(eq(users.id, existingUser.id));

          updatedCount++;
          details.push({ name: userData.name, employeeId, action: 'updated' });
        } else {
          // 工号不存在，新增用户
          const initialPassword = userData.password || defaultPassword;
          const hashedPassword = hashPassword(initialPassword);
          await db.insert(users).values({
            username: employeeId,
            name: userData.name,
            role: role,
            password: hashedPassword,
            employeeId: employeeId,
            department: userData.department || null,
            status: 'active',
            mustChangePassword: forceChangeOnFirstLogin,
          });

          createdCount++;
          details.push({ name: userData.name, employeeId, action: 'created' });
        }
      } catch (error) {
        errors.push(`失败：${userData.name} - ${error instanceof Error ? error.message : '未知错误'}`);
        details.push({
          name: userData.name,
          employeeId: userData.employeeId || userData.username,
          action: 'failed',
          reason: error instanceof Error ? error.message : '未知错误',
        });
        failCount++;
      }
    }

    return NextResponse.json({
      success: true,
      created: createdCount,
      updated: updatedCount,
      failed: failCount,
      total: usersToImport.length,
      details,
      errors: errors.length > 0 ? errors.slice(0, 20) : undefined,
    });
  } catch (error) {
    console.error('Failed to import users:', error);
    return NextResponse.json({ error: '导入用户失败' }, { status: 500 });
  }
}

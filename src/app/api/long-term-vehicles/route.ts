import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { longTermVehicles, visitRecords, users } from '@/storage/database/shared/schema';
import { desc, eq, or, like, and, count, isNull, inArray, sql } from 'drizzle-orm';
import { parseToken, getUserById } from '@/lib/auth';
import { cookies } from 'next/headers';

// 禁用路由缓存 — 长约车数据要求实时性
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - 获取长约列表（员工/管理员/门卫）
export async function GET(request: NextRequest) {
  try {
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
    if (!user || !['admin', 'security', 'employee'].includes(user.role)) {
      return NextResponse.json({ error: '无权限访问' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('query');
    const status = searchParams.get('status');
    const showEnded = searchParams.get('showEnded'); // 是否显示已结束的记录

    const conditions = [];

    // 员工只能看到自己的记录
    if (user.role === 'employee') {
      conditions.push(eq(longTermVehicles.createdBy, user.username));
    }

    if (query) {
      conditions.push(
        or(
          like(longTermVehicles.licensePlate || '', `%${query}%`),
          like(longTermVehicles.personName || '', `%${query}%`),
          like(longTermVehicles.driverName || '', `%${query}%`),
          like(longTermVehicles.company || '', `%${query}%`)
        )
      );
    }

    if (status && status !== 'all') {
      conditions.push(eq(longTermVehicles.status, status));
    }

    // 默认不显示已结束的记录（签退过且不在厂的）
    // 管理员默认看到所有记录，不做此过滤
    if ((!showEnded || showEnded !== 'true') && user.role !== 'admin') {
      // isOnSite=true 表示在厂；或者 lastVisitRecordId IS NULL 表示从未签到过
      conditions.push(
        or(
          eq(longTermVehicles.isOnSite, true),
          isNull(longTermVehicles.lastVisitRecordId)
        )
      );
    }

    let vehiclesQuery = db.select().from(longTermVehicles);

    if (conditions.length > 0) {
      vehiclesQuery = vehiclesQuery.where(
        conditions.length === 1 ? conditions[0] : and(...conditions)
      ) as any;
    }

    const records = await vehiclesQuery.orderBy(desc(longTermVehicles.createdAt));

    // 批量查询 createdBy 对应的用户真实姓名
    const usernames = [...new Set(records.map(r => r.createdBy).filter(Boolean))] as string[];
    const userMap = new Map<string, string>();
    if (usernames.length > 0) {
      const userRows = await db
        .select({ username: users.username, name: users.name })
        .from(users)
        .where(inArray(users.username, usernames));
      userRows.forEach(u => userMap.set(u.username, u.name));
    }

    // 为每条记录统计签到次数
    const recordsWithCheckinCount = await Promise.all(
      records.map(async (record) => {
        // 统计该长约的签到次数
        const checkinCountResult = await db
          .select({ count: count() })
          .from(visitRecords)
          .where(eq(visitRecords.longTermVehicleId, record.id));

        const checkinCount = checkinCountResult[0]?.count || 0;

        // 判断当前状态：在厂/已结束/空闲
        let currentStatus = 'idle'; // 空闲（从未签到）
        if (record.isOnSite) {
          currentStatus = 'onsite'; // 在厂
        } else if (record.lastVisitRecordId) {
          currentStatus = 'ended'; // 已结束（已签退）
        }

        return {
          ...record,
          checkinCount,
          currentStatus,
          createdByName: record.createdBy ? (userMap.get(record.createdBy) || record.createdBy) : '-',
        };
      })
    );

    return NextResponse.json(recordsWithCheckinCount);
  } catch (error) {
    console.error('Failed to fetch long-term:', error);
    return NextResponse.json({ error: '获取长约列表失败' }, { status: 500 });
  }
}

// POST - 添加长约（员工提交待审批，管理员直接生效）
export async function POST(request: NextRequest) {
  try {
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
    if (!user || !['admin', 'employee'].includes(user.role)) {
      return NextResponse.json({ error: '无权限访问' }, { status: 403 });
    }

    const body = await request.json();
    const {
      entryType,           // vehicle | person | both
      // 车辆字段
      licensePlate,
      vehicleModel,
      driverName,
      driverPhone,
      company,
      validFrom,
      validTo,
      allowedAreas,
      notes,
      // 人员字段
      personName,
      personIdCard,
      personPhone,
      // 访客类型
      visitorType,
    } = body;

    if (!validFrom || !validTo) {
      return NextResponse.json({ error: '有效期开始和结束时间为必填项' }, { status: 400 });
    }

    // 校验：根据 entryType 校验必填
    const et = entryType || 'vehicle';
    if ((et === 'vehicle' || et === 'both') && !licensePlate) {
      return NextResponse.json({ error: '车辆类型必须填写车牌号' }, { status: 400 });
    }
    if ((et === 'person' || et === 'both') && !personName) {
      return NextResponse.json({ error: '人员类型必须填写姓名' }, { status: 400 });
    }

    // 车辆类检查车牌重复（排除已驳回和已过期的）
    if (et !== 'person' && licensePlate) {
      const now = new Date();
      const existing = await db
        .select()
        .from(longTermVehicles)
        .where(and(
          eq(longTermVehicles.licensePlate, licensePlate),
          or(eq(longTermVehicles.status, 'active'), eq(longTermVehicles.status, 'pending')),
          // 必须仍在有效期内才算重复（允许过期后重新申请）
          sql`${longTermVehicles.validTo} >= ${now}`
        ));

      if (existing.length > 0) {
        return NextResponse.json({ error: '该车牌号已在白名单中或正在审批中' }, { status: 400 });
      }
    }

    // 人员类检查身份证重复（排除已驳回和已过期的）
    if ((et === 'person' || et === 'both') && personIdCard) {
      const now = new Date();
      const existing = await db
        .select()
        .from(longTermVehicles)
        .where(and(
          eq(longTermVehicles.personIdCard, personIdCard),
          or(eq(longTermVehicles.status, 'active'), eq(longTermVehicles.status, 'pending')),
          sql`${longTermVehicles.validTo} >= ${now}`
        ));

      if (existing.length > 0) {
        return NextResponse.json({ error: '该身份证号已在白名单中或正在审批中' }, { status: 400 });
      }
    }

    // 员工创建 → pending；管理员 → active
    const initialStatus = user.role === 'admin' ? 'active' : 'pending';

    // 生成长约编号：L + 创建日期(YYYYMMDD) + 3位序号（按天编序，同天连号）
    const todayStr = new Date().toISOString().substring(0, 10); // UTC日期，足够用于编号
    const dateStr = todayStr.replace(/-/g, '');
    const seqResult = await db.execute(sql`
      INSERT INTO long_term_code_sequences (date, last_seq)
      VALUES (${todayStr}::date, 1)
      ON CONFLICT (date)
      DO UPDATE SET last_seq = long_term_code_sequences.last_seq + 1
      RETURNING last_seq
    `);
    const seq = seqResult.rows[0].last_seq as number;
    const longTermCode = `L${dateStr}${String(seq).padStart(3, '0')}`;

    // 日期处理：
    // validFrom: 用户选 "2026-05-23"，存为上海当天 00:00 = UTC 前一天 16:00
    // validTo:   用户选 "2026-06-30"，存为上海当天 23:59:59 = UTC 当天 15:59:59
    // 这样 validTo >= NOW() 在有效期内最后一天也能匹配
    const parseValidFrom = (d: string) => {
      const [y, m, day] = d.split('-').map(Number);
      return new Date(Date.UTC(y, m - 1, day - 1, 16, 0, 0));
    };
    const parseValidTo = (d: string) => {
      const [y, m, day] = d.split('-').map(Number);
      // 有效期结束日当天的 23:59:59 上海时间 = UTC 当天 15:59:59
      return new Date(Date.UTC(y, m - 1, day, 15, 59, 59));
    };

    const newRecord = await db
      .insert(longTermVehicles)
      .values({
        longTermCode,
        entryType: et,
        licensePlate: licensePlate || null,
        vehicleModel: vehicleModel || null,
        driverName: driverName || null,
        driverPhone: driverPhone || null,
        company: company || null,
        validFrom: parseValidFrom(validFrom),
        validTo: parseValidTo(validTo),
        status: initialStatus,
        allowedAreas: allowedAreas || null,
        notes: notes || null,
        createdBy: user.username,
        personName: personName || null,
        personIdCard: personIdCard || null,
        personPhone: personPhone || null,
        visitorType: visitorType || 'supplier',
      })
      .returning();

    return NextResponse.json(newRecord[0], { status: 201 });
  } catch (error) {
    console.error('Failed to add long-term:', error);
    return NextResponse.json({ error: '添加长约失败' }, { status: 500 });
  }
}

// PUT - 更新长约（管理员操作：编辑/审批通过/驳回）
export async function PUT(request: NextRequest) {
  try {
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
    if (!user || !['admin', 'employee'].includes(user.role)) {
      return NextResponse.json({ error: '无权限操作' }, { status: 403 });
    }

    const body = await request.json();
    const {
      id,
      action,           // 'approve' | 'reject' | 'edit'
      rejectionReason,
      entryType,
      licensePlate,
      vehicleModel,
      driverName,
      driverPhone,
      company,
      validFrom,
      validTo,
      allowedAreas,
      notes,
      status,
      personName,
      personIdCard,
      personPhone,
      visitorType,
    } = body;

    if (!id && action !== 'batch') {
      return NextResponse.json({ error: '缺少记录ID' }, { status: 400 });
    }

    const existing = await db
      .select()
      .from(longTermVehicles)
      .where(eq(longTermVehicles.id, id));

    if (existing.length === 0) {
      return NextResponse.json({ error: '长约记录不存在' }, { status: 404 });
    }

    // 员工权限控制：只能编辑自己的待审批记录，不能审批/驳回
    if (user.role === 'employee') {
      if (existing[0].createdBy !== user.username) {
        return NextResponse.json({ error: '无权限操作他人的记录' }, { status: 403 });
      }
      if (action === 'approve' || action === 'reject') {
        return NextResponse.json({ error: '无权限审批' }, { status: 403 });
      }
      if (existing[0].status !== 'pending') {
        return NextResponse.json({ error: '已审核的记录不可编辑' }, { status: 403 });
      }
    }

    if (action === 'approve') {
      const updated = await db
        .update(longTermVehicles)
        .set({
          status: 'active',
          updatedAt: new Date(),
        })
        .where(eq(longTermVehicles.id, id))
        .returning();
      return NextResponse.json(updated[0]);
    }

    if (action === 'reject') {
      const rejectNote = rejectionReason
        ? `${existing[0].notes || ''} | 驳回原因：${rejectionReason}`
        : existing[0].notes;
      const updated = await db
        .update(longTermVehicles)
        .set({
          status: 'rejected',
          notes: rejectNote,
          updatedAt: new Date(),
        })
        .where(eq(longTermVehicles.id, id))
        .returning();
      return NextResponse.json(updated[0]);
    }

    // 日期处理（与 POST 一致，保证时区正确）
    const parseValidFrom = (d: string) => {
      const [y, m, day] = d.split('-').map(Number);
      return new Date(Date.UTC(y, m - 1, day - 1, 16, 0, 0));
    };
    const parseValidTo = (d: string) => {
      const [y, m, day] = d.split('-').map(Number);
      return new Date(Date.UTC(y, m - 1, day, 15, 59, 59));
    };

    // 普通编辑
    const updated = await db
      .update(longTermVehicles)
      .set({
        entryType: entryType || existing[0].entryType,
        licensePlate: licensePlate || existing[0].licensePlate,
        vehicleModel: vehicleModel !== undefined ? vehicleModel : existing[0].vehicleModel,
        driverName: driverName !== undefined ? driverName : existing[0].driverName,
        driverPhone: driverPhone !== undefined ? driverPhone : existing[0].driverPhone,
        company: company !== undefined ? company : existing[0].company,
        validFrom: validFrom ? parseValidFrom(validFrom) : existing[0].validFrom,
        validTo: validTo ? parseValidTo(validTo) : existing[0].validTo,
        allowedAreas: allowedAreas !== undefined ? allowedAreas : existing[0].allowedAreas,
        notes: notes !== undefined ? notes : existing[0].notes,
        status: status || existing[0].status,
        personName: personName !== undefined ? personName : existing[0].personName,
        personIdCard: personIdCard !== undefined ? personIdCard : existing[0].personIdCard,
        personPhone: personPhone !== undefined ? personPhone : existing[0].personPhone,
        visitorType: visitorType || existing[0].visitorType,
        updatedAt: new Date(),
      })
      .where(eq(longTermVehicles.id, id))
      .returning();

    return NextResponse.json(updated[0]);
  } catch (error) {
    console.error('Failed to update long-term:', error);
    return NextResponse.json({ error: '更新长约失败' }, { status: 500 });
  }
}

// DELETE - 删除长约（仅管理员）
export async function DELETE(request: NextRequest) {
  try {
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
    if (!user || !['admin', 'employee'].includes(user.role)) {
      return NextResponse.json({ error: '无权限操作' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '缺少长约ID' }, { status: 400 });
    }

    const existing = await db
      .select()
      .from(longTermVehicles)
      .where(eq(longTermVehicles.id, parseInt(id)));

    if (existing.length === 0) {
      return NextResponse.json({ error: '长约记录不存在' }, { status: 404 });
    }

    // 员工只能删除自己的且待审批的记录
    if (user.role === 'employee') {
      if (existing[0].createdBy !== user.username) {
        return NextResponse.json({ error: '无权限删除他人的记录' }, { status: 403 });
      }
      if (existing[0].status !== 'pending') {
        return NextResponse.json({ error: '已审核的记录不可删除' }, { status: 403 });
      }
    }

    await db
      .delete(longTermVehicles)
      .where(eq(longTermVehicles.id, parseInt(id)));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete long-term:', error);
    return NextResponse.json({ error: '删除长约失败' }, { status: 500 });
  }
}

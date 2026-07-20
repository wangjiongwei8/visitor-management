import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { appointments, visitors, vehicles } from '@/lib/schema';
import { VISITOR_TYPE_CONFIG } from '@/lib/schema';
import { systemSettings, SYSTEM_SETTING_KEYS } from '@/storage/database/shared/schema';
import { checkBlacklist } from '@/lib/blacklist';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// ==================== 速率限制 ====================
const submitAttempts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5; // 每IP每小时最多5次预约提交
const RATE_WINDOW_MS = 60 * 60 * 1000;

function checkSubmitRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = submitAttempts.get(ip);
  if (!record || now > record.resetAt) {
    submitAttempts.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (record.count >= RATE_LIMIT) return false;
  record.count++;
  return true;
}

// POST - 访客扫码预约
export async function POST(request: NextRequest) {
  try {
    // IP 速率限制
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown';
    if (!checkSubmitRateLimit(clientIp)) {
      return NextResponse.json({ error: '提交过于频繁，请稍后再试' }, { status: 429 });
    }

    const body = await request.json();
    
    const {
      visitorName,
      visitorIdCard,
      visitorPhone,
      company,
      visitorType,
      visitObject,
      visitPurpose,
      appointmentDate,
      appointmentTime,
      licensePlate,
      needMeal,
      notes,
      visitorCount = 1,
      followers = [],
    } = body;

    // 验证必填字段
    if (!visitorName || !visitorPhone || !visitorType || !visitObject || !visitPurpose || !appointmentDate || !appointmentTime) {
      return NextResponse.json({ error: '请填写所有必填字段' }, { status: 400 });
    }

    // 检查黑名单（身份证号）
    if (visitorIdCard) {
      const blacklisted = await checkBlacklist(visitorIdCard);
      if (blacklisted) {
        return NextResponse.json({ error: '该人员已被列入黑名单，无法创建预约。如有疑问请联系管理员。', blacklisted: true }, { status: 403 });
      }
    }

    // 读取审核开关，决定初始状态
    const reviewSetting = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, SYSTEM_SETTING_KEYS.REVIEW_ENABLED))
      .limit(1);
    const reviewEnabled = reviewSetting.length > 0 ? reviewSetting[0].value === 'true' : true;
    const initialStatus = reviewEnabled ? 'pending' : 'scheduled';
    const applicantId = 'visitor';
    const applicantName = visitorName;

    // 解析日期字符串为 UTC 时间存储
    // 目标：用户选"2026-04-27"，查询 AT TIME ZONE 'Asia/Shanghai' 后显示"2026-04-27"
    // 原理：UTC 16:00 = 上海次日 00:00 → 要显示04-27，需存 UTC 04-26 16:00
    // 公式：Date.UTC(y, m-1, d-1, 16, 0, 0)
    const [y, m, day] = appointmentDate.split('-').map(Number);
    const localAppointmentDate = new Date(Date.UTC(y, m - 1, day - 1, 16, 0, 0));

    // 获取访客分类配置
    const typeConfig = VISITOR_TYPE_CONFIG[visitorType] || {};
    const visitorCategory = typeConfig.category || 'business';

    // 生成唯一的身份证占位符（因为数据库有唯一约束）
    const idCardPlaceholder = visitorIdCard 
      ? visitorIdCard 
      : `PUBLIC_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // 首先创建访客记录
    const [newVisitor] = await db
      .insert(visitors)
      .values({
        name: visitorName,
        idCard: idCardPlaceholder,
        phone: visitorPhone,
        company: company || null,
        visitPurpose,
        visitObject,
        visitDate: localAppointmentDate,
        status: 'pending',
        visitorType,
        visitorCategory,
        totalVisitors: visitorCount,
        vehicleInfo: licensePlate ? [{ licensePlate, vehicleModel: '', vehicleType: 'car' }] : null,
        entourageInfo: followers.length > 0 ? followers : null,
        notes: notes || null,
      })
      .returning();

    // 生成访客编号：V + 预约日期(YYYYMMDD) + 3位序号（按预约日期编序，同天连号）
    const dateStr = appointmentDate.replace(/-/g, '');

    // 使用序列表获取该预约日期的序号（原子操作，避免并发冲突）
    const { sql } = await import('drizzle-orm');
    const seqResult = await db.execute(sql`
      INSERT INTO visitor_code_sequences (date, last_seq)
      VALUES (${appointmentDate}::date, 1)
      ON CONFLICT (date)
      DO UPDATE SET last_seq = visitor_code_sequences.last_seq + 1
      RETURNING last_seq
    `);

    const seq = seqResult.rows[0].last_seq as number;
    const visitorCode = `V${dateStr}${String(seq).padStart(3, '0')}`;

    // 创建预约记录
    const [newAppointment] = await db
      .insert(appointments)
      .values({
        visitorCode,
        visitorId: newVisitor.id,
        visitorName,
        visitorIdCard: idCardPlaceholder,
        visitorPhone,
        visitorCount,
        visitorType,
        visitorCategory,
        company: company || '',
        visitObject,
        visitPurpose,
        appointmentDate: localAppointmentDate,
        appointmentTime,
        needMeal: needMeal || false,
        status: initialStatus,
        applicantId,
        applicantName,
        createdBy: 'visitor', // 访客扫码创建
        notes: notes || null,
      })
      .returning();

    // 创建车辆记录
    const scanConfig = VISITOR_TYPE_CONFIG[visitorType] || ({} as any);
    const scanVehiclePassColor = scanConfig.vehiclePassColor || 'red';

    // 主车牌
    if (licensePlate) {
      await db.insert(vehicles).values({
        appointmentId: newAppointment.id,
        licensePlate: licensePlate.trim(),
        vehicleModel: '',
        vehicleType: 'car',
        vehiclePassColor: scanVehiclePassColor,
        passNumber: `V${newAppointment.id}-${licensePlate}`,
        followerName: null,
        followerPhone: null,
      });
    }

    // 随访人员车辆
    if (Array.isArray(followers) && followers.length > 0) {
      for (const f of followers) {
        if (!f.name?.trim()) continue;
        await db.insert(vehicles).values({
          appointmentId: newAppointment.id,
          licensePlate: f.licensePlate?.trim() || '',
          vehicleModel: '',
          vehicleType: 'car',
          vehiclePassColor: scanVehiclePassColor,
          passNumber: `V${newAppointment.id}-f-${f.name?.trim().slice(0, 4)}`,
          followerName: f.name.trim(),
          followerPhone: f.phone?.trim() || null,
        });
      }
    }

    return NextResponse.json({
      success: true,
      appointment: newAppointment,
      visitor: newVisitor,
      reviewEnabled,
      message: reviewEnabled ? '预约已提交，请等待受访人审批。' : '预约成功，请在约定时间到达。',
    });
  } catch (error) {
    console.error('扫码预约失败:', error);
    return NextResponse.json({ error: '预约提交失败，请重试' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { visitors, appointments } from '@/storage/database/shared/schema';
import { requireAuth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const authResult = requireAuth(request, ['admin']);
    if (authResult instanceof NextResponse) return authResult;

    // 生成访客数据
    const visitorData = [
      { name: '张三', phone: '13900001001', idCard: '110101199001011234', company: '阿里巴巴', visitPurpose: '业务洽谈', visitObject: '李经理', visitObjectPhone: '13800000001' },
      { name: '李四', phone: '13900001002', idCard: '110101199002021234', company: '腾讯科技', visitPurpose: '技术交流', visitObject: '王工', visitObjectPhone: '13800000002' },
      { name: '王五', phone: '13900001003', idCard: '110101199003031234', company: '百度在线', visitPurpose: '合作洽谈', visitObject: '张总', visitObjectPhone: '13800000003' },
      { name: '赵六', phone: '13900001004', idCard: '110101199004041234', company: '京东集团', visitPurpose: '采购对接', visitObject: '刘经理', visitObjectPhone: '13800000004' },
      { name: '钱七', phone: '13900001005', idCard: '110101199005051234', company: '美团点评', visitPurpose: '会议讨论', visitObject: '陈主管', visitObjectPhone: '13800000005' },
      { name: '孙八', phone: '13900001006', idCard: '110101199006061234', company: '字节跳动', visitPurpose: '项目沟通', visitObject: '周经理', visitObjectPhone: '13800000006' },
      { name: '周九', phone: '13900001007', idCard: '110101199007071234', company: '滴滴出行', visitPurpose: '商务访问', visitObject: '吴总监', visitObjectPhone: '13800000007' },
      { name: '吴十', phone: '13900001008', idCard: '110101199008081234', company: '小米科技', visitPurpose: '产品展示', visitObject: '郑工程师', visitObjectPhone: '13800000008' },
      { name: '郑十一', phone: '13900001009', idCard: '110101199009091234', company: '华为技术', visitPurpose: '技术研讨', visitObject: '冯经理', visitObjectPhone: '13800000009' },
      { name: '冯十二', phone: '13900001010', idCard: '110101199010101234', company: '中兴通讯', visitPurpose: '合作交流', visitObject: '褚经理', visitObjectPhone: '13800000010' },
    ];

    const today = new Date();
    const results = [];

    for (let i = 0; i < visitorData.length; i++) {
      const v = visitorData[i];
      const visitDate = new Date(today);
      visitDate.setDate(today.getDate() + i - 3); // 分散日期

      try {
        const [newVisitor] = await db.insert(visitors).values({
          name: v.name,
          phone: v.phone,
          idCard: v.idCard,
          company: v.company,
          visitPurpose: v.visitPurpose,
          visitObject: v.visitObject,
          visitObjectPhone: v.visitObjectPhone,
          visitDate: visitDate,
          status: i < 7 ? 'approved' : 'pending',
          totalVisitors: Math.floor(Math.random() * 3) + 1,
        }).returning();

        results.push({ name: v.name, id: newVisitor.id, status: 'created' });
      } catch (error) {
        results.push({ name: v.name, status: 'error', message: String(error) });
      }
    }

    // 生成预约数据
    const appointmentData = [
      { visitorName: '访客A', visitorPhone: '13700001001', visitorCompany: '甲公司', visitObject: '李经理', visitPurpose: '商务洽谈', plannedVisitDate: new Date(today.getTime() + 86400000), plannedVisitTime: '09:00' },
      { visitorName: '访客B', visitorPhone: '13700001002', visitorCompany: '乙公司', visitObject: '王工', visitPurpose: '技术交流', plannedVisitDate: new Date(today.getTime() + 86400000 * 2), plannedVisitTime: '14:00' },
      { visitorName: '访客C', visitorPhone: '13700001003', visitorCompany: '丙公司', visitObject: '张总', visitPurpose: '高层会议', plannedVisitDate: new Date(today.getTime() + 86400000 * 3), plannedVisitTime: '10:00' },
      { visitorName: '访客D', visitorPhone: '13700001004', visitorCompany: '丁公司', visitObject: '刘经理', visitPurpose: '供应商评估', plannedVisitDate: new Date(today.getTime() + 86400000 * 4), plannedVisitTime: '15:00' },
      { visitorName: '访客E', visitorPhone: '13700001005', visitorCompany: '戊公司', visitObject: '陈主管', visitPurpose: '市场调研', plannedVisitDate: new Date(today.getTime() + 86400000 * 5), plannedVisitTime: '11:00' },
    ];

    for (let i = 0; i < appointmentData.length; i++) {
      const a = appointmentData[i];
      try {
        const [newAppt] = await db.insert(appointments).values({
          visitorName: a.visitorName,
          visitorPhone: a.visitorPhone,
          visitorIdCard: '1101011990' + String(1000 + i) + '1234',
          visitorCount: Math.floor(Math.random() * 3) + 1,
          visitorType: 'business',
          visitorCategory: 'business',
          company: a.visitorCompany,
          visitObject: a.visitObject,
          visitObjectPhone: a.visitorPhone,
          visitPurpose: a.visitPurpose,
          appointmentDate: a.plannedVisitDate,
          appointmentTime: a.plannedVisitTime,
          applicantId: 'test_user',
          applicantName: '测试用户',
          status: i < 3 ? 'scheduled' : 'pending',
        }).returning();

        results.push({ name: a.visitorName, id: newAppt.id, type: 'appointment', status: 'created' });
      } catch (error) {
        results.push({ name: a.visitorName, type: 'appointment', status: 'error', message: String(error) });
      }
    }

    return NextResponse.json({ success: true, count: results.length, results });
  } catch (error) {
    console.error('Insert test data failed:', error);
    return NextResponse.json({ error: '插入测试数据失败: ' + String(error) }, { status: 500 });
  }
}

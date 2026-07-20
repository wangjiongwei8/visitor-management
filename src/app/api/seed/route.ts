import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { visitors, blacklist, visitRecords, VISITOR_TYPE, VISITOR_CATEGORY, PASS_COLOR } from '@/storage/database/shared/schema';
import { VISITOR_TYPE_CONFIG } from '@/lib/schema';
import { cookies } from 'next/headers';
import { parseToken } from '@/lib/auth';

// 测试数据配置
const TEST_VISITORS = [
  {
    name: '张伟',
    idCard: '110101199001011234',
    phone: '13800138001',
    company: '华为技术有限公司',
    visitPurpose: '商务洽谈',
    visitObject: '李明',
    visitObjectPhone: '13900139001',
    visitDate: new Date('2025-01-15'),
    notes: '重要客户，定期合作',
    visitorType: VISITOR_TYPE.CUSTOMER,
    totalVisitors: 3,
    vehicleInfo: [
      { licensePlate: '京A88888', vehicleModel: '奥迪A6', vehicleType: 'car' }
    ],
    entourageInfo: [
      { name: '王芳', idCard: '110101199002022345', phone: '13800138002', vehicleIds: [0], licensePlate: '京A88888' },
      { name: '刘洋', idCard: '110101199003033456', phone: '13800138003', vehicleIds: [], licensePlate: '' }
    ]
  },
  {
    name: '陈静',
    idCard: '110101199004044567',
    phone: '13800138004',
    company: '腾讯科技有限公司',
    visitPurpose: '技术交流',
    visitObject: '赵强',
    visitObjectPhone: '13900139002',
    visitDate: new Date('2025-01-16'),
    notes: '技术方案讨论',
    visitorType: VISITOR_TYPE.CUSTOMER,
    totalVisitors: 2,
    vehicleInfo: [
      { licensePlate: '京B66666', vehicleModel: '宝马5系', vehicleType: 'car' }
    ],
    entourageInfo: [
      { name: '杨光', idCard: '110101199005055678', phone: '13800138005', vehicleIds: [0], licensePlate: '京B66666' }
    ]
  },
  {
    name: '周健',
    idCard: '110101199006066789',
    phone: '13800138006',
    company: '中兴通讯股份有限公司',
    visitPurpose: '供应链会议',
    visitObject: '孙丽',
    visitObjectPhone: '13900139003',
    visitDate: new Date('2025-01-17'),
    notes: '长期合作供应商',
    visitorType: VISITOR_TYPE.SUPPLIER,
    totalVisitors: 2,
    vehicleInfo: [],
    entourageInfo: [
      { name: '吴刚', idCard: '110101199007077890', phone: '13800138007', vehicleIds: [], licensePlate: '' }
    ]
  },
  {
    name: '郑华',
    idCard: '110101199008088901',
    phone: '13800138008',
    company: '',
    visitPurpose: '面试',
    visitObject: '钱洋',
    visitObjectPhone: '13900139004',
    visitDate: new Date('2025-01-18'),
    notes: '前端开发工程师面试',
    visitorType: VISITOR_TYPE.APPLICANT,
    totalVisitors: 1,
    vehicleInfo: [],
    entourageInfo: []
  },
  {
    name: '冯伟',
    idCard: '110101199009099012',
    phone: '13800138009',
    company: '',
    visitPurpose: '面试',
    visitObject: '朱敏',
    visitObjectPhone: '13900139005',
    visitDate: new Date('2025-01-19'),
    notes: '后端开发工程师面试',
    visitorType: VISITOR_TYPE.APPLICANT,
    totalVisitors: 1,
    vehicleInfo: [],
    entourageInfo: []
  },
  {
    name: '赵磊',
    idCard: '110101199010101123',
    phone: '13800138010',
    company: '顺丰速运',
    visitPurpose: '货物配送',
    visitObject: '何平',
    visitObjectPhone: '13900139006',
    visitDate: new Date('2025-01-20'),
    notes: '办公物资配送',
    visitorType: VISITOR_TYPE.DELIVERY,
    totalVisitors: 2,
    vehicleInfo: [
      { licensePlate: '京C12345', vehicleModel: '全顺货车', vehicleType: 'truck' }
    ],
    entourageInfo: [
      { name: '孙婷', idCard: '110101199011112234', phone: '13800138011', vehicleIds: [0], licensePlate: '京C12345' }
    ]
  },
  {
    name: '李娜',
    idCard: '110101199012123345',
    phone: '13800138012',
    company: '京东物流',
    visitPurpose: '货物配送',
    visitObject: '周波',
    visitObjectPhone: '13900139007',
    visitDate: new Date('2025-01-21'),
    notes: '设备采购配送',
    visitorType: VISITOR_TYPE.DELIVERY,
    totalVisitors: 1,
    vehicleInfo: [
      { licensePlate: '京D67890', vehicleModel: '依维柯', vehicleType: 'van' }
    ],
    entourageInfo: []
  },
  {
    name: '刘洋',
    idCard: '110101199013134456',
    phone: '13800138013',
    company: '临时维修公司',
    visitPurpose: '设备维修',
    visitObject: '吴红',
    visitObjectPhone: '13900139008',
    visitDate: new Date('2025-01-22'),
    notes: '空调维修服务',
    visitorType: VISITOR_TYPE.SUPPLIER,
    totalVisitors: 2,
    vehicleInfo: [],
    entourageInfo: [
      { name: '陈静', idCard: '110101199014145567', phone: '13800138014', vehicleIds: [], licensePlate: '' }
    ]
  },
  {
    name: '周健',
    idCard: '110101199015156678',
    phone: '13800138015',
    company: '市科技局',
    visitPurpose: '政策调研',
    visitObject: '郑华',
    visitObjectPhone: '13900139009',
    visitDate: new Date('2025-01-23'),
    notes: '科技创新政策调研',
    visitorType: VISITOR_TYPE.GOVERNMENT,
    totalVisitors: 3,
    vehicleInfo: [
      { licensePlate: '京E98765', vehicleModel: '奥迪A8', vehicleType: 'car' }
    ],
    entourageInfo: [
      { name: '杨光', idCard: '110101199016167789', phone: '13800138016', vehicleIds: [0], licensePlate: '京E98765' },
      { name: '吴刚', idCard: '110101199017178890', phone: '13800138017', vehicleIds: [0], licensePlate: '京E98765' }
    ]
  },
  {
    name: '钱洋',
    idCard: '110101199018189901',
    phone: '13800138018',
    company: '行业协会',
    visitPurpose: '参观交流',
    visitObject: '冯伟',
    visitObjectPhone: '13900139010',
    visitDate: new Date('2025-01-24'),
    notes: '行业标杆企业参观',
    visitorType: VISITOR_TYPE.VISIT,
    totalVisitors: 4,
    vehicleInfo: [],
    entourageInfo: [
      { name: '朱敏', idCard: '110101199019101012', phone: '13800138019', vehicleIds: [], licensePlate: '' },
      { name: '何平', idCard: '110101199020112123', phone: '13800138020', vehicleIds: [], licensePlate: '' },
      { name: '周波', idCard: '110101199021123234', phone: '13800138021', vehicleIds: [], licensePlate: '' }
    ]
  }
];

const TEST_BLACKLIST = [
  {
    name: '王强',
    idCard: '110101199001019999',
    phone: '13800138000',
    reason: '多次违反公司安全规定，擅自进入限制区域',
    blacklistedBy: '安保部-张经理',
    isPermanent: false,
    expiryDate: new Date('2026-01-01')
  },
  {
    name: '李四',
    idCard: '110101199002028888',
    phone: '13800138099',
    reason: '曾发生货物丢失事件，被禁止入厂',
    blacklistedBy: '物流部-刘经理',
    isPermanent: true,
    expiryDate: null
  },
  {
    name: '赵五',
    idCard: '110101199003037777',
    phone: '13800138098',
    reason: '扰乱工作秩序，言语冲突',
    blacklistedBy: '人事部-王主管',
    isPermanent: false,
    expiryDate: new Date('2025-06-01')
  }
];

export async function POST(request: Request) {
  // 生产环境保护
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: '此接口在生产环境中不可用' }, { status: 403 });
  }

  // 认证检查（仅管理员）
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  if (token) {
    const userData = parseToken(token);
    if (!userData || userData.role !== 'admin') {
      return NextResponse.json({ error: '仅管理员可执行此操作' }, { status: 403 });
    }
  } else if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: '需要登录' }, { status: 401 });
  }

  try {
    let createdCount = 0;
    let errors: string[] = [];

    // 插入测试访客
    for (const visitorData of TEST_VISITORS) {
      try {
        const config = VISITOR_TYPE_CONFIG[visitorData.visitorType];
        await db.insert(visitors).values({
          ...visitorData,
          visitorCategory: config.category,
          status: 'pending'
        });
        createdCount++;
      } catch (error) {
        const errorMsg = `插入访客 ${visitorData.name} 失败`;
        errors.push(errorMsg);
        console.error(errorMsg, error);
      }
    }

    // 插入黑名单
    for (const blacklistData of TEST_BLACKLIST) {
      try {
        await db.insert(blacklist).values(blacklistData);
        createdCount++;
      } catch (error) {
        const errorMsg = `插入黑名单 ${blacklistData.name} 失败`;
        errors.push(errorMsg);
        console.error(errorMsg, error);
      }
    }

    // 插入签到记录（基于部分访客）
    try {
      const allVisitors = await db.select().from(visitors).limit(5);
      for (let i = 0; i < allVisitors.length; i++) {
        const visitor = allVisitors[i];
        const config = VISITOR_TYPE_CONFIG[visitor.visitorType || VISITOR_TYPE.CUSTOMER];
        const passNumber = `PASS${String(Date.now()).slice(-6)}${i}`;

        await db.insert(visitRecords).values({
          visitorId: visitor.id,
          visitorName: visitor.name,
          visitorIdCard: visitor.idCard || '',
          visitorPhone: visitor.phone,
          visitObject: visitor.visitObject,
          visitPurpose: visitor.visitPurpose,
          visitorType: visitor.visitorType || VISITOR_TYPE.CUSTOMER,
          visitorCategory: visitor.visitorCategory || VISITOR_CATEGORY.BUSINESS,
          passNumber,
          passColor: config.passColor,
          checkInTime: new Date(),
          visitStatus: i < 3 ? 'visiting' : 'completed',
          checkOutTime: i >= 3 ? new Date() : null,
          riskLevel: 'green',
        });
        createdCount++;
      }
    } catch (error) {
      errors.push(`插入签到记录失败`);
      console.error('插入签到记录失败', error);
    }

    return NextResponse.json({
      success: true,
      message: `成功创建 ${createdCount} 条测试数据`,
      details: {
        visitors: TEST_VISITORS.length,
        blacklist: TEST_BLACKLIST.length,
        visitRecords: Math.min(5, TEST_VISITORS.length)
      },
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('生成测试数据失败:', error);
    return NextResponse.json({
      success: false,
      error: '生成测试数据失败'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: '请使用 POST 方法生成测试数据',
    endpoint: '/api/seed',
    method: 'POST',
    preview: {
      visitors: TEST_VISITORS.length,
      blacklist: TEST_BLACKLIST.length
    }
  });
}

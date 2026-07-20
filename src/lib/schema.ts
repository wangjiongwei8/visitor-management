import { pgTable, serial, text, timestamp, integer, boolean, json } from 'drizzle-orm/pg-core';

// ==================== 访客基础信息表 ====================
export const visitors = pgTable('visitors', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  idCard: text('id_card'),
  phone: text('phone').notNull(),
  company: text('company'),
  visitPurpose: text('visit_purpose').notNull(),
  visitObject: text('visit_object').notNull(),
  visitObjectPhone: text('visit_object_phone'),
  visitDate: timestamp('visit_date').notNull(),
  status: text('status').notNull().default('pending'), // pending, checked_in, checked_out, cancelled
  isBlacklisted: boolean('is_blacklisted').notNull().default(false),
  notes: text('notes'),
  // 访客分类
  visitorType: text('visitor_type'),
  visitorCategory: text('visitor_category'),
  totalVisitors: integer('total_visitors').notNull().default(1),
  // 车辆信息（JSON格式：[{licensePlate, vehicleModel, vehicleType}]）
  vehicleInfo: json('vehicle_info').$type<Array<{
    licensePlate: string;
    vehicleModel: string;
    vehicleType: string;
  }>>(),
  // 随行人员信息（JSON格式：[{name, phone, vehicleIds, licensePlate}]）
  entourageInfo: json('entourage_info').$type<Array<{
    name: string;
    phone: string;
    vehicleIds: number[];
    licensePlate: string;
  }>>(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});


// ==================== 访客分类枚举 ====================
export const VISITOR_CATEGORY = {
  BUSINESS: 'business', // 业务类
  AFFAIRS: 'affairs',   // 事务类
  SPECIAL: 'special',   // 特殊类
} as const;

export const VISITOR_TYPE = {
  // 业务类
  CUSTOMER: 'customer',         // 客户
  // 事务类
  SUPPLIER: 'supplier',         // 供应商
  APPLICANT: 'applicant',       // 应聘者
  DELIVERY: 'delivery',         // 送货/装货人员
  // 特殊类
  GOVERNMENT: 'government',     // 政府
  VISIT: 'visit',               // 参观访客
} as const;

export const PASS_COLOR = {
  GREEN: 'green',    // 绿色通行牌
  YELLOW: 'yellow',  // 黄色通行牌
  RED: 'red',       // 红色通行牌
} as const;

export const USER_ROLE = {
  ADMIN: 'admin',
  SECURITY: 'security',
  VISITOR: 'visitor',
  EMPLOYEE: 'employee',
} as const;

// 权限配置
export const PERMISSIONS = {
  // 管理员：所有权限
  admin: {
    pages: ['*'], // 所有页面
    api: ['*'], // 所有API
    features: {
      viewAllVisitors: true,
      manageUsers: true,
      manageRoles: true,
      manageLongTermVehicles: true,
      viewOperationLogs: true,
      manageBlacklist: true,
      approveAppointments: true,
    },
  },
  // 员工：创建预约、发起审批
  employee: {
    pages: ['/', '/appointment', '/my-appointments'],
    api: ['/api/appointments', '/api/my-appointments'],
    features: {
      createAppointment: true,
      approveAppointment: true, // 可以审批预约
      viewOwnAppointments: true,
    },
  },
  // 访客：通过二维码预约
  visitor: {
    pages: ['/', '/appointment', '/scan'],
    api: ['/api/appointments', '/api/scan'],
    features: {
      createAppointmentByQR: true,
      viewOwnAppointments: true,
    },
  },
  // 门卫：签到签退、长约车管理、打印访客单
  security: {
    pages: ['/', '/security', '/security/check-in', '/security/check-out', '/security/long-term-vehicles', '/security/visitor-pass'],
    api: ['/api/visitors/search', '/api/visit-records', '/api/visit-records/checkout', '/api/long-term-vehicles', '/api/visitor-pass'],
    features: {
      checkIn: true,
      checkOut: true,
      manageLongTermVehicles: true,
      printVisitorPass: true,
      searchVisitor: true,
    },
  },
} as const;

// 访客类型配置 — 统一从 shared/schema 重导出，确保全项目使用同一份配置
export { VISITOR_TYPE_CONFIG } from '@/storage/database/shared/schema';

// ==================== 预约记录表（升级版） ====================
export const appointments = pgTable('appointments', {
  id: serial('id').primaryKey(),
  visitorCode: text('visitor_code').unique(), // 访客编号，格式：V + YYYYMMDD + 3位序号
  // 访客基本信息
  visitorId: integer('visitor_id'),
  visitorName: text('visitor_name').notNull(),
  visitorIdCard: text('visitor_id_card').notNull(),
  visitorPhone: text('visitor_phone').notNull(),
  visitorCount: integer('visitor_count').notNull().default(1), // 随行人数

  // 访客分类
  visitorType: text('visitor_type').notNull(), // visitorType 枚举值
  visitorCategory: text('visitor_category').notNull(), // visitorCategory 枚举值

  // 访问信息
  company: text('company'),
  visitObject: text('visit_object').notNull(), // 受访人
  visitObjectPhone: text('visit_object_phone'),
  visitPurpose: text('visit_purpose').notNull(), // 事由类型

  // 时间信息
  appointmentDate: timestamp('appointment_date').notNull(),
  appointmentTime: text('appointment_time').notNull(), // 预约时间段
  needMeal: boolean('need_meal').notNull().default(false), // 是否提供就餐

  // 审批信息
  status: text('status').notNull().default('pending'), // pending, scheduled, checked_in, checked_out, rejected, cancelled
  applicantId: text('applicant_id').notNull(), // 申请人工号
  applicantName: text('applicant_name').notNull(), // 申请人姓名
  createdBy: text('created_by').notNull().default('employee'), // 创建来源：employee=员工创建(自动通过), visitor=访客扫码创建(需审批)
  deptApproverId: text('dept_approver_id'), // 部门负责人工号
  deptApproverName: text('dept_approver_name'), // 部门负责人姓名
  deptApprovalTime: timestamp('dept_approval_time'), // 部门审批时间
  deptApprovalNotes: text('dept_approval_notes'), // 部门审批意见
  secretOfficeApproverId: text('secret_office_approver_id'), // 保密办公室审批人工号
  secretOfficeApproverName: text('secret_office_approver_name'), // 保密办公室审批人姓名
  secretOfficeApprovalTime: timestamp('secret_office_approval_time'), // 保密办公室审批时间
  secretOfficeApprovalNotes: text('secret_office_approval_notes'), // 保密办公室审批意见
  authorizedBy: text('authorized_by'), // 人力资源授权人
  authorizedTime: timestamp('authorized_time'), // 授权时间

  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ==================== 车辆信息表 ====================
export const vehicles = pgTable('vehicles', {
  id: serial('id').primaryKey(),
  appointmentId: integer('appointment_id').notNull(),
  licensePlate: text('license_plate').notNull(), // 车牌号
  vehicleModel: text('vehicle_model'), // 车型
  vehicleType: text('vehicle_type').notNull(), // car, truck, van 等
  vehiclePassColor: text('vehicle_pass_color').notNull(), // green, yellow, red
  passNumber: text('pass_number').notNull(), // 车辆通行证号
  followerName: text('follower_name'), // 随行人员姓名（主访客车为空）
  followerPhone: text('follower_phone'), // 随行人员手机号（主访客车为空）
  status: text('status').notNull().default('pending'), // pending, entered, exited
  entryTime: timestamp('entry_time'), // 入场时间
  exitTime: timestamp('exit_time'), // 出场时间
  isChecked: boolean('is_checked').notNull().default(false), // 是否已检查后备箱
  checkNotes: text('check_notes'), // 检查备注
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ==================== 黑名单表 ====================
export const blacklist = pgTable('blacklist', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  idCard: text('id_card').notNull().unique(),
  phone: text('phone'),
  reason: text('reason').notNull(),
  blacklistedBy: text('blacklisted_by').notNull(),
  isPermanent: boolean('is_permanent').notNull().default(false),
  expiryDate: timestamp('expiry_date'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ==================== 访客签到签退记录表 ====================
export const visitRecords = pgTable('visit_records', {
  id: serial('id').primaryKey(),
  visitorId: integer('visitor_id').notNull(),
  visitorName: text('visitor_name').notNull(),
  visitorIdCard: text('visitor_id_card').notNull(),
  visitorPhone: text('visitor_phone').notNull(),
  appointmentId: integer('appointment_id'),

  // 访客分类
  visitorType: text('visitor_type').notNull(),
  visitorCategory: text('visitor_category').notNull(),

  // 访问信息
  visitObject: text('visit_object').notNull(),
  visitPurpose: text('visit_purpose').notNull(),

  // 通行牌信息
  passNumber: text('pass_number').notNull(), // 通行牌号
  passColor: text('pass_color').notNull(), // green, yellow, red

  // 时间信息
  checkInTime: timestamp('check_in_time').notNull(),
  checkOutTime: timestamp('check_out_time'),
  visitStatus: text('visit_status').notNull().default('visiting'), // visiting, completed
  riskLevel: text('risk_level').notNull().default('green'), // green, yellow, red

  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ==================== 访客证打印记录表 ====================
// 【v2 移除】visitCards 表已废弃，访客证打印功能不再需要
// 如需恢复，请从 v1.x 版本的代码中找回表定义

// ==================== 安全装备管理表 ====================
export const safetyEquipment = pgTable('safety_equipment', {
  id: serial('id').primaryKey(),
  visitRecordId: integer('visit_record_id').notNull(),
  equipmentType: text('equipment_type').notNull(), // helmet, safety_vest, goggles 等
  equipmentName: text('equipment_name').notNull(), // 装备名称
  serialNumber: text('serial_number'), // 序列号
  issueTime: timestamp('issue_time').notNull(),
  returnTime: timestamp('return_time'),
  status: text('status').notNull().default('issued'), // issued, returned
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});


// ==================== 受访人清单表 ====================
export const hostContacts = pgTable('host_contacts', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),           // 受访人姓名
  department: text('department').notNull(), // 部门
  phone: text('phone'),                   // 办公电话
  email: text('email'),                   // 邮箱
  position: text('position'),             // 职位
  createdBy: text('created_by').notNull(), // 创建人工号
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ==================== 回执单管理表 ====================
export const receipts = pgTable('receipts', {
  id: serial('id').primaryKey(),
  visitRecordId: integer('visit_record_id').notNull(),
  receiptType: text('receipt_type').notNull(), // visitor_receipt, exit_permit
  receiptNumber: text('receipt_number').notNull(),
  visitorName: text('visitor_name').notNull(),
  visitorIdCard: text('visitor_id_card').notNull(),
  visitObject: text('visit_object').notNull(),
  signatoryId: text('signatory_id').notNull(), // 签字人工号
  signatoryName: text('signatory_name').notNull(), // 签字人姓名
  signTime: timestamp('sign_time'),
  signatoryDepartment: text('signatory_department'), // 签字部门
  notes: text('notes'),
  status: text('status').notNull().default('pending'), // pending, signed, verified
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});


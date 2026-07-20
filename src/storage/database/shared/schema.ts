import { pgTable, serial, text, timestamp, integer, boolean, json } from 'drizzle-orm/pg-core';

// ==================== 用户表 ====================
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  password: text('password').notNull(),
  name: text('name').notNull(),
  role: text('role').notNull(), // admin, security, visitor, employee
  status: text('status').notNull().default('active'), // active, inactive
  // 员工扩展字段
  employeeId: text('employee_id'), // 工号
  department: text('department'), // 部门
  phone: text('phone'), // 电话
  // 密码管理字段
  mustChangePassword: boolean('must_change_password').notNull().default(true), // 是否必须修改密码
  passwordChangedAt: timestamp('password_changed_at'), // 密码最后修改时间
  passwordExpiresAt: timestamp('password_expires_at'), // 密码过期时间
  lastPasswordChangeBy: text('last_password_change_by'), // 最后修改密码的操作人（admin/用户自己）
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ==================== 密码修改历史表 ====================
export const passwordHistory = pgTable('password_history', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  changedAt: timestamp('changed_at').notNull().defaultNow(),
  changedBy: text('changed_by').notNull(), // 操作人：用户自己 或 管理员用户名
  changeType: text('change_type').notNull(), // self_change, admin_reset, initial_set
  ipAddress: text('ip_address'), // 操作IP
  userAgent: text('user_agent'), // 操作浏览器
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ==================== 密码策略设置表 ====================
export const passwordPolicy = pgTable('password_policy', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().default('default'), // 策略名称
  // 密码复杂度要求
  minLength: integer('min_length').notNull().default(8), // 最小长度
  requireUppercase: boolean('require_uppercase').notNull().default(true), // 需要大写字母
  requireLowercase: boolean('require_lowercase').notNull().default(true), // 需要小写字母
  requireNumber: boolean('require_number').notNull().default(true), // 需要数字
  requireSpecialChar: boolean('require_special_char').notNull().default(true), // 需要特殊字符
  specialChars: text('special_chars').default('!@#$%^&*()_+-=[]{}|;:,.<>?'), // 允许的特殊字符
  // 密码过期设置
  maxPasswordAge: integer('max_password_age').default(90), // 密码最大有效期（天），null表示永不过期
  passwordExpiryWarningDays: integer('password_expiry_warning_days').default(7), // 过期前警告天数
  // 历史密码检查
  passwordHistoryCount: integer('password_history_count').default(5), // 不能重复使用最近N次密码
  // 初始密码设置
  defaultPassword: text('default_password').default('123456'), // 默认初始密码
  forceChangeOnFirstLogin: boolean('force_change_on_first_login').notNull().default(true), // 首次登录强制修改
  // 锁定设置
  maxLoginAttempts: integer('max_login_attempts').default(5), // 最大登录失败次数
  lockoutDuration: integer('lockout_duration').default(30), // 锁定时长（分钟）
  // 状态
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ==================== 系统设置表 ====================
export const systemSettings = pgTable('system_settings', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(),
  value: text('value').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ==================== 长约表（车辆+人员长期通行） ====================
export const longTermVehicles = pgTable('long_term_vehicles', {
  id: serial('id').primaryKey(),
  longTermCode: text('long_term_code').unique(), // 长约编号，格式：L + YYYYMMDD + 3位序号
  entryType: text('entry_type').notNull().default('vehicle'), // vehicle, person, both
  // 车辆信息
  licensePlate: text('license_plate'),
  vehicleModel: text('vehicle_model'),
  driverName: text('driver_name'),
  driverPhone: text('driver_phone'),
  company: text('company'),
  validFrom: timestamp('valid_from').notNull(),
  validTo: timestamp('valid_to').notNull(),
  status: text('status').notNull().default('active'), // pending, active, rejected, cancelled
  allowedAreas: text('allowed_areas'), // 允许进入的区域
  notes: text('notes'),
  createdBy: text('created_by'), // 申请人工号，admin表示管理员直接创建
  visitorType: text('visitor_type'), // 访客类型：customer/supplier/applicant/delivery/government/visit 等
  // 人员信息（person/both 类型时使用）
  personName: text('person_name'),
  personIdCard: text('person_id_card'),
  personPhone: text('person_phone'),
  // 当前状态
  isOnSite: boolean('is_on_site').notNull().default(false), // 当前是否在厂（签到未签退）
  lastVisitRecordId: integer('last_visit_record_id'), // 最近一次签到记录ID
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

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
  status: text('status').notNull().default('pending'),
  isBlacklisted: boolean('is_blacklisted').notNull().default(false),
  notes: text('notes'),
  // 访客分类
  visitorType: text('visitor_type'),
  visitorCategory: text('visitor_category'),
  totalVisitors: integer('total_visitors').notNull().default(1),
  // 车辆信息
  vehicleInfo: json('vehicle_info').$type<Array<{
    licensePlate: string;
    vehicleModel: string;
    vehicleType: string;
  }>>(),
  // 随行人员信息
  entourageInfo: json('entourage_info').$type<Array<{
    name: string;
    phone: string;
    vehicleIds: number[];
    licensePlate: string;
  }>>(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ==================== 预约记录表 ====================
export const appointments = pgTable('appointments', {
  id: serial('id').primaryKey(),
  visitorCode: text('visitor_code').unique(), // 访客编号，格式：V + YYYYMMDD + 3位序号
  visitorId: integer('visitor_id'),
  visitorName: text('visitor_name').notNull(),
  visitorIdCard: text('visitor_id_card').notNull(),
  visitorPhone: text('visitor_phone').notNull(),
  visitorCount: integer('visitor_count').notNull().default(1),
  visitorType: text('visitor_type').notNull(),
  visitorCategory: text('visitor_category').notNull(),
  company: text('company'),
  visitObject: text('visit_object').notNull(),
  visitObjectPhone: text('visit_object_phone'),
  visitPurpose: text('visit_purpose').notNull(),
  appointmentDate: timestamp('appointment_date').notNull(),
  appointmentTime: text('appointment_time').notNull(),
  needMeal: boolean('need_meal').notNull().default(false), // 是否提供就餐
  status: text('status').notNull().default('pending'),
  applicantId: text('applicant_id').notNull(),
  applicantName: text('applicant_name').notNull(),
  notes: text('notes'),
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

// ==================== 车辆信息表 ====================
export const vehicles = pgTable('vehicles', {
  id: serial('id').primaryKey(),
  appointmentId: integer('appointment_id').notNull(),
  licensePlate: text('license_plate').notNull(),
  vehicleModel: text('vehicle_model'),
  vehicleType: text('vehicle_type').notNull(),
  vehiclePassColor: text('vehicle_pass_color').notNull(),
  passNumber: text('pass_number').notNull(),
  status: text('status').notNull().default('pending'),
  entryTime: timestamp('entry_time'),
  exitTime: timestamp('exit_time'),
  isChecked: boolean('is_checked').notNull().default(false),
  checkNotes: text('check_notes'),
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
  longTermVehicleId: integer('long_term_vehicle_id'), // 关联的长约记录ID
  visitorType: text('visitor_type').notNull(),
  visitorCategory: text('visitor_category').notNull(),
  visitObject: text('visit_object').notNull(),
  visitPurpose: text('visit_purpose').notNull(),
  passNumber: text('pass_number').notNull(),
  passColor: text('pass_color').notNull(),
  checkInTime: timestamp('check_in_time').notNull(),
  checkOutTime: timestamp('check_out_time'),
  visitStatus: text('visit_status').notNull().default('visiting'),
  riskLevel: text('risk_level').notNull().default('green'),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ==================== 访客分类枚举 ====================
export const VISITOR_CATEGORY = {
  BUSINESS: 'business',
  AFFAIRS: 'affairs',
  SPECIAL: 'special',
} as const;

export const VISITOR_TYPE = {
  CUSTOMER: 'customer',
  SUPPLIER: 'supplier',
  APPLICANT: 'applicant',
  DELIVERY: 'delivery',
  GOVERNMENT: 'government',
  VISIT: 'visit',
} as const;

export const PASS_COLOR = {
  GREEN: 'green',
  YELLOW: 'yellow',
  RED: 'red',
} as const;

export const USER_ROLE = {
  ADMIN: 'admin',
  SECURITY: 'security',
  VISITOR: 'visitor',
  EMPLOYEE: 'employee',
} as const;

// 系统设置键名
export const SYSTEM_SETTING_KEYS = {
  AUTO_APPROVE: 'auto_approve',
  REVIEW_ENABLED: 'review_enabled',
} as const;

export const VISITOR_TYPE_CONFIG: Record<string, {
  category: string;
  passColor: string;
  allowVehicle: boolean;
  vehiclePassColor?: string;
  allowedAreas: string[];
  needSafetyEquipment: boolean;
}> = {
  [VISITOR_TYPE.CUSTOMER]: {
    category: VISITOR_CATEGORY.BUSINESS,
    passColor: PASS_COLOR.GREEN,
    allowVehicle: true,
    vehiclePassColor: PASS_COLOR.GREEN,
    allowedAreas: ['customer_parking', 'meeting_room', 'showroom', 'designated_area'],
    needSafetyEquipment: false,
  },
  [VISITOR_TYPE.SUPPLIER]: {
    category: VISITOR_CATEGORY.AFFAIRS,
    passColor: PASS_COLOR.RED,  // 红色通行牌（事务类）
    allowVehicle: true,
    vehiclePassColor: PASS_COLOR.RED,
    allowedAreas: ['visitor_parking', 'meeting_room', 'designated_area'],
    needSafetyEquipment: false,
  },
  [VISITOR_TYPE.APPLICANT]: {
    category: VISITOR_CATEGORY.AFFAIRS,
    passColor: PASS_COLOR.RED,
    allowVehicle: false,
    allowedAreas: ['interview_room', 'waiting_area'],
    needSafetyEquipment: false,
  },
  [VISITOR_TYPE.DELIVERY]: {
    category: VISITOR_CATEGORY.AFFAIRS,
    passColor: PASS_COLOR.RED,
    allowVehicle: true,
    vehiclePassColor: PASS_COLOR.RED,
    allowedAreas: ['receiving_area', 'unloading_area', 'designated_area'],
    needSafetyEquipment: true,
  },
  [VISITOR_TYPE.GOVERNMENT]: {
    category: VISITOR_CATEGORY.AFFAIRS,
    passColor: PASS_COLOR.YELLOW,
    allowVehicle: true,
    vehiclePassColor: PASS_COLOR.YELLOW,
    allowedAreas: ['visitor_parking', 'meeting_room'],
    needSafetyEquipment: false,
  },
  [VISITOR_TYPE.VISIT]: {
    category: VISITOR_CATEGORY.SPECIAL,
    passColor: PASS_COLOR.YELLOW,  // 参观访客使用黄色通行牌（与业务规范一致）
    allowVehicle: false,
    allowedAreas: ['designated_area'],
    needSafetyEquipment: false,
  },
};

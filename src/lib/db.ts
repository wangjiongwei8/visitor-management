import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

// 标准 Drizzle ORM 数据库连接
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // 连接池优化：防止高并发时连接耗尽导致查询失败
  max: 20,                      // 最大连接数（默认 10，门卫查询并发时不够用）
  idleTimeoutMillis: 30000,     // 空闲连接 30s 后释放
  connectionTimeoutMillis: 10000, // 新建连接超时 10s（防止无限等待）
});

export const db = drizzle(pool);

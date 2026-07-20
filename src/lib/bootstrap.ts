import { spawn } from 'node:child_process';
import { createDefaultUsers } from './auth';

let bootstrapped = false;

// 判断 drizzle-kit 是否可用（完整 node_modules 环境下存在；standalone 镜像可能不存在）
function hasDrizzleKit(): boolean {
  try {
    require.resolve('drizzle-kit/bin.cjs');
    return true;
  } catch {
    try {
      require.resolve('drizzle-kit');
      return true;
    } catch {
      return false;
    }
  }
}

// 通过 drizzle-kit 将 schema 同步到数据库（建表）
function pushSchema(): Promise<void> {
  return new Promise((resolve, reject) => {
    const bin =
      process.platform === 'win32'
        ? 'node_modules/.bin/drizzle-kit.cmd'
        : 'node_modules/.bin/drizzle-kit';
    const child = spawn(bin, ['push'], {
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
      timeout: 180000,
    });
    let out = '';
    child.stdout?.on('data', (d) => (out += String(d)));
    child.stderr?.on('data', (d) => (out += String(d)));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`drizzle-kit push exited ${code}: ${out.slice(-800)}`));
    });
  });
}

/**
 * 应用启动时的一次性数据库自举：
 * 1. 若 drizzle-kit 可用，自动将表结构同步到数据库（替代手动 db:push）
 * 2. 幂等创建默认账号（admin/security/employee/visitor）与系统设置
 * 失败不阻塞服务启动，仅记录日志。
 */
export async function bootstrapDatabase(): Promise<void> {
  if (bootstrapped) return;
  bootstrapped = true;

  if (process.env.SKIP_DB_BOOTSTRAP === '1') {
    console.log('[bootstrap] SKIP_DB_BOOTSTRAP=1，跳过数据库自举');
    return;
  }

  // 1) 建表
  if (hasDrizzleKit()) {
    try {
      await pushSchema();
      console.log('[bootstrap] 数据库表结构已同步（drizzle-kit push）');
    } catch (e) {
      console.error('[bootstrap] 表结构同步失败，请手动执行 `pnpm db:push`：', (e as Error).message);
    }
  } else {
    console.warn('[bootstrap] 未找到 drizzle-kit，跳过自动建表；若数据库为空请先执行 `pnpm db:push`');
  }

  // 2) 默认账号 + 系统设置（幂等）
  try {
    await createDefaultUsers();
    console.log('[bootstrap] 默认账号已确保存在（admin / security / employee / visitor）');
  } catch (e) {
    console.error('[bootstrap] 默认账号初始化失败：', (e as Error).message);
  }
}

// Next.js 启动钩子：应用启动时执行数据库自举（建表 + 默认账号）
// 注意：使用 src 目录时，instrumentation 必须放在 src/ 下才能被 Next 识别。
// 参考：https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { bootstrapDatabase } = await import('./lib/bootstrap');
    await bootstrapDatabase().catch((e) =>
      console.error('[instrumentation] 数据库自举异常：', e),
    );
  }
}

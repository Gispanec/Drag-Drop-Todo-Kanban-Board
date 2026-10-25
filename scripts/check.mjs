import { spawnSync } from 'node:child_process';

// Прямой запуск Node также работает в Windows-путях с символом &.
for (const args of [
  ['node_modules/eslint/bin/eslint.js', '.', '--max-warnings', '0'],
  ['node_modules/vitest/vitest.mjs', 'run'],
  ['node_modules/typescript/bin/tsc', '-b'],
  ['node_modules/vite/bin/vite.js', 'build'],
]) {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit' });
  if (result.error) { console.error(result.error); process.exit(1); }
  if (result.status !== 0) process.exit(result.status ?? 1);
}

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { realpathSync } from 'node:fs';

export default defineConfig({
  plugins: [react(), {
    name: 'flow-dev-identity',
    apply: 'serve',
    configureServer(server) {
      const root = realpathSync(server.config.root).replaceAll('\\', '/');
      const projectId = createHash('sha256').update(process.platform === 'win32' ? root.toLowerCase() : root).digest('hex');
      server.middlewares.use((request, response, next) => {
        if (request.method !== 'GET' || request.url !== '/.flow/health') return next();
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.setHeader('Cache-Control', 'no-store');
        response.end(JSON.stringify({ app: 'flow-kanban', projectId, lan: server.config.server.host === '0.0.0.0' || server.config.server.host === true }));
      });
    },
  }],
  server: { port: 5173, strictPort: true },
  test: { include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs'], environment: 'node' },
});

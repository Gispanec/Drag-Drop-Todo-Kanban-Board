import { afterEach, describe, expect, it } from 'vitest';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdtemp, writeFile, rm, rmdir, copyFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { PORT, LOCAL_URL, lanAddresses, supportedNode, missingDependencies, projectId, listenControl, requestControl, httpResponse, tcpOpen, waitForReady } from './flow-runtime.mjs';

const cleanups = [];
afterEach(async () => { while (cleanups.length) await cleanups.pop()(); });

const ipv4 = address => ({ address, family: 'IPv4', internal: false });
describe('Адрес телефона', () => {
  it('выбирает физический адаптер вместо VPN, Docker и WSL', () => {
    const entries = { WiFi: [ipv4('192.168.0.2')], VPN: [ipv4('10.2.0.1')], 'vEthernet (WSL)': [ipv4('172.28.80.1')], Docker: [ipv4('172.17.0.1')] };
    expect(lanAddresses(entries, ['WiFi'])).toEqual([{ name: 'WiFi', address: '192.168.0.2', physical: true }]);
  });
  it('показывает все подходящие физические сети с подписями', () => {
    expect(lanAddresses({ WiFi: [ipv4('192.168.0.2')], Ethernet: [ipv4('10.0.0.2')] }, ['WiFi', 'Ethernet'])).toHaveLength(2);
  });
  it('при недоступном PowerShell исключает известные виртуальные адаптеры', () => {
    const entries = { WiFi: [ipv4('192.168.0.2')], WireGuard: [ipv4('10.1.0.1')], 'vEthernet (WSL)': [ipv4('172.28.80.1')] };
    expect(lanAddresses(entries)).toEqual([{ name: 'WiFi', address: '192.168.0.2', physical: false }]);
  });
  it('не выдумывает адрес при отсутствии LAN и не выбирает APIPA/IPv6/loopback', () => {
    expect(lanAddresses({ WiFi: [ipv4('169.254.1.2'), { address: '::1', family: 'IPv6', internal: true }], Loopback: [{ ...ipv4('127.0.0.1'), internal: true }], VPN: [ipv4('10.0.0.1')] })).toEqual([]);
  });
});

describe('Проверки установки', () => {
  it('использует постоянный адрес Flow на порту 5174', () => {
    expect(PORT).toBe(5174);
    expect(LOCAL_URL).toBe('http://localhost:5174/');
  });
  it.each([['22.12.0', true], ['22.11.0', false], ['24.19.0', true], ['20.19.0', false], ['23.0.0', false]])('Node.js %s: %s', (version, expected) => expect(supportedNode(version)).toBe(expected));
  it('находит отсутствующие зависимости без npm и без установки', async () => {
    const root = await mkdtemp(join(tmpdir(), 'Flow & dependencies '));
    cleanups.push(async () => { await rm(join(root, 'package.json')); await rmdir(root); });
    await writeFile(join(root, 'package.json'), JSON.stringify({ dependencies: { react: '1' }, devDependencies: { vite: '1' } }));
    expect(missingDependencies(root)).toEqual(['react', 'vite']);
    expect(projectId(root)).toBe(projectId(root));
  });
});

describe('Готовность HTTP', () => {
  it('проверяет идентификатор и готовность страницы до открытия браузера', async () => {
    const responses = [null, { status: 200, body: '<html>Другой сайт</html>' }, { status: 200, body: JSON.stringify({ app: 'flow-kanban', projectId: 'test' }) }, { status: 200, body: '<script src="/src/main.tsx"></script>' }];
    const calls = [];
    await waitForReady('test', { probe: async (host, path) => { calls.push({ host, path }); return responses.shift(); }, sleep: async () => {} });
    expect(calls).toHaveLength(4);
    expect(calls[3]).toEqual({ host: 'localhost', path: '/' });
  });
  it('не считает чужой HTTP-сервер готовым Flow', async () => {
    await expect(waitForReady('test', { timeout: 20, probe: async () => ({ status: 200, body: '{}' }), sleep: async () => new Promise(resolve => setTimeout(resolve, 5)) })).rejects.toThrow('не ответил');
  });
  it('читает настоящий HTTP и проверяет занятый TCP-порт', async () => {
    const server = createServer((_request, response) => response.end('ready'));
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    cleanups.push(() => new Promise(resolve => server.close(resolve)));
    const port = server.address().port;
    expect(await tcpOpen('127.0.0.1', port)).toBe(true);
    expect(await httpResponse('127.0.0.1', '/', port)).toMatchObject({ status: 200, body: 'ready' });
  });
});

describe('Безопасная остановка и блокировка запуска', () => {
  it('находит только свой канал и отказывает второму владельцу', async () => {
    const id = randomUUID().replaceAll('-', '');
    let stopped = false;
    const server = await listenControl(id, () => ({ phase: 'ready' }), async () => { stopped = true; });
    cleanups.push(() => new Promise(resolve => server.close(resolve)));
    expect(await requestControl(id)).toMatchObject({ app: 'flow-launcher', projectId: id, phase: 'ready' });
    await expect(listenControl(id, () => ({}), async () => {})).rejects.toMatchObject({ code: 'EADDRINUSE' });
    expect(await requestControl(randomUUID())).toBeNull();
    expect(stopped).toBe(false);
    await requestControl(id, 'stop');
    expect(stopped).toBe(true);
  });
  it('не останавливает ещё не готовый сервер', async () => {
    const id = randomUUID().replaceAll('-', '');
    let stopped = false;
    const server = await listenControl(id, () => ({ phase: 'starting' }), async () => { stopped = true; });
    cleanups.push(() => new Promise(resolve => server.close(resolve)));
    await requestControl(id, 'stop');
    expect(stopped).toBe(false);
  });
});

function runBat(path, cwd, nodeAvailable) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => name.toLowerCase() !== 'path'));
  env.Path = [nodeAvailable ? dirname(process.execPath) : '', join(process.env.SystemRoot, 'System32')].filter(Boolean).join(';');
  return new Promise((resolve, reject) => {
    const child = spawn(process.env.ComSpec, ['/d', '/s', '/c', `""${path}""`], { cwd, env, windowsHide: true, windowsVerbatimArguments: true });
    let output = '';
    child.stdout.setEncoding('utf8').on('data', chunk => { output += chunk; });
    child.stderr.setEncoding('utf8').on('data', chunk => { output += chunk; });
    child.on('error', reject);
    child.stdin.on('error', () => {});
    child.stdin.end('\r\n');
    child.on('exit', code => resolve({ code, output }));
  });
}

describe.skipIf(process.platform !== 'win32')('Реальный BAT в Windows', () => {
  it('показывает русское сообщение без Node.js и работает из другой директории', async () => {
    const root = fileURLToPath(new URL('../', import.meta.url));
    const result = await runBat(join(root, 'Start Flow.bat'), tmpdir(), false);
    expect(result.code).toBe(1);
    expect(result.output).toContain('Node.js не найден');
    expect(result.output).not.toContain('is not recognized');
  });
  it('проверяет отсутствующие зависимости из пути с пробелами, кириллицей и &', async () => {
    const root = await mkdtemp(join(tmpdir(), 'Flow & проверка '));
    const source = fileURLToPath(new URL('../', import.meta.url));
    await mkdir(join(root, 'scripts'));
    const files = ['Start Flow.bat', 'scripts/flow.mjs', 'scripts/flow-runtime.mjs'];
    for (const file of files) await copyFile(join(source, file), join(root, file));
    await writeFile(join(root, 'package.json'), JSON.stringify({ dependencies: { vite: '1' } }));
    cleanups.push(async () => {
      for (const file of [...files, 'package.json']) await rm(join(root, file));
      await rmdir(join(root, 'scripts'));
      await rmdir(root);
    });
    const result = await runBat(join(root, 'Start Flow.bat'), tmpdir(), true);
    expect(result.code).toBe(1);
    expect(result.output).toContain('Зависимости отсутствуют');
    expect(result.output).toContain('npm ci');
    expect(result.output).not.toContain('is not recognized');
  });
});

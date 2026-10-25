import { createHash } from 'node:crypto';
import { realpathSync, existsSync, readFileSync } from 'node:fs';
import { get } from 'node:http';
import { createConnection, createServer } from 'node:net';
import { networkInterfaces, tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';

export const PORT = 5173;
export const LOCAL_URL = `http://localhost:${PORT}/`;
const execFileAsync = promisify(execFile);
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

export function projectId(root) {
  const path = realpathSync(root).replaceAll('\\', '/');
  return createHash('sha256').update(process.platform === 'win32' ? path.toLowerCase() : path).digest('hex');
}

export function supportedNode(version) {
  const [major, minor] = version.split('.').map(Number);
  return major === 22 && minor >= 12 || major >= 24;
}

export function missingDependencies(root) {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  return Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).filter(name => !existsSync(join(root, 'node_modules', name, 'package.json')));
}

const virtualAdapter = /vpn|docker|wsl|vethernet|virtual|vmware|hyper-v|tap|tun|tailscale|zerotier|wireguard|loopback|bluetooth|clash|hamachi|openvpn/i;
export function lanAddresses(interfaces, physicalNames = null) {
  const candidates = Object.entries(interfaces).flatMap(([name, entries]) => (entries ?? [])
    .filter(entry => !entry.internal && entry.family === 'IPv4' && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(entry.address))
    .map(entry => ({ name, address: entry.address, physical: physicalNames?.includes(name) ?? false })));
  const physical = candidates.filter(entry => entry.physical);
  const selected = physical.length ? physical : candidates.filter(entry => !virtualAdapter.test(entry.name));
  return selected.filter((entry, index) => selected.findIndex(other => other.address === entry.address) === index);
}

export async function detectLanAddresses() {
  let physicalNames = null;
  if (process.platform === 'win32') {
    try {
      const command = '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; @(Get-NetAdapter -Physical -ErrorAction Stop | Where-Object Status -eq "Up" | Select-Object -ExpandProperty Name) | ConvertTo-Json -Compress';
      const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { windowsHide: true, timeout: 6000, encoding: 'utf8' });
      const names = JSON.parse(stdout.replace(/^\uFEFF/, '').trim() || '[]');
      physicalNames = Array.isArray(names) ? names : [names];
    } catch {
      // Get-NetAdapter бывает недоступен без CIM/PowerShell. Тогда исключаем известные виртуальные имена.
    }
  }
  return lanAddresses(networkInterfaces(), physicalNames);
}

export function httpResponse(host, path = '/.flow/health', port = PORT) {
  return new Promise(resolve => {
    const request = get({ hostname: host, port, path, timeout: 1200, agent: false }, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => {
        body += chunk;
        if (body.length > 32768) request.destroy();
      });
      response.on('end', () => resolve({ status: response.statusCode, body }));
      response.on('error', () => resolve(null));
    });
    request.on('timeout', () => request.destroy());
    request.on('error', () => resolve(null));
  });
}

export function tcpOpen(host, port = PORT) {
  return new Promise(resolve => {
    const socket = createConnection({ host, port });
    const finish = result => { socket.destroy(); resolve(result); };
    socket.setTimeout(800, () => finish(false));
    socket.on('connect', () => finish(true));
    socket.on('error', () => finish(false));
  });
}

export async function inspectPort(id) {
  const results = await Promise.all(['127.0.0.1', '::1'].map(async host => {
    if (!await tcpOpen(host)) return null;
    const response = await httpResponse(host);
    let health;
    try { health = JSON.parse(response?.body ?? 'null'); } catch { health = null; }
    return health?.app === 'flow-kanban' && health.projectId === id && response?.status === 200 ? { kind: 'flow', lan: health.lan === true } : { kind: 'other' };
  }));
  if (results.some(result => result?.kind === 'other')) return { kind: 'other' };
  return results.find(result => result?.kind === 'flow') ?? { kind: 'free' };
}

export async function waitForReady(id, { timeout = 30000, probe = httpResponse, sleep = delay } = {}) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const response = await probe('127.0.0.1');
    let health;
    try { health = JSON.parse(response?.body ?? 'null'); } catch { health = null; }
    if (response?.status === 200 && health?.app === 'flow-kanban' && health.projectId === id) {
      const page = await probe('localhost', '/');
      if (page?.status === 200 && page.body.includes('/src/main.tsx')) return;
    }
    await sleep(150);
  }
  throw new Error('Flow не ответил по HTTP за 30 секунд. Браузер не открыт.');
}

export function controlPath(id) {
  return process.platform === 'win32' ? `\\\\.\\pipe\\flow-kanban-${id.slice(0, 24)}` : join(tmpdir(), `flow-kanban-${id.slice(0, 24)}.sock`);
}

function readMessage(socket, callback) {
  let buffer = '';
  socket.setEncoding('utf8');
  socket.setTimeout(3000, () => socket.destroy());
  socket.on('error', () => {});
  socket.on('data', chunk => {
    buffer += chunk;
    if (buffer.length > 4096) { socket.destroy(); return; }
    if (!buffer.includes('\n')) return;
    let message;
    try { message = JSON.parse(buffer.slice(0, buffer.indexOf('\n'))); } catch { socket.destroy(); return; }
    socket.removeAllListeners('data');
    callback(message);
  });
}

export async function listenControl(id, status, stop) {
  const server = createServer(socket => readMessage(socket, message => {
    if (message?.app !== 'flow-launcher' || message.projectId !== id || !['status', 'stop'].includes(message.command)) { socket.destroy(); return; }
    const state = status();
    socket.end(JSON.stringify({ app: 'flow-launcher', projectId: id, ...state }) + '\n');
    if (message.command === 'stop' && state.phase === 'ready') void stop();
  }));
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(controlPath(id), () => { server.removeListener('error', reject); resolve(); });
  });
  return server;
}

export function requestControl(id, command = 'status') {
  return new Promise(resolve => {
    const socket = createConnection(controlPath(id));
    const finish = result => { socket.destroy(); resolve(result); };
    socket.on('error', () => finish(null));
    socket.on('close', () => resolve(null));
    socket.setTimeout(1500, () => finish(null));
    socket.on('connect', () => socket.write(JSON.stringify({ app: 'flow-launcher', projectId: id, command }) + '\n'));
    readMessage(socket, message => finish(message?.app === 'flow-launcher' && message.projectId === id ? message : null));
  });
}

export async function openBrowser(url = LOCAL_URL) {
  const [command, args] = process.platform === 'win32' ? ['rundll32.exe', ['url.dll,FileProtocolHandler', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { detached: true, stdio: 'ignore', windowsHide: true });
    child.once('error', reject);
    child.once('spawn', () => { child.unref(); resolve(); });
  });
}

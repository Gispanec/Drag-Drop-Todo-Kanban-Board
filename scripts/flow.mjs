import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { projectId, supportedNode, missingDependencies, detectLanAddresses, inspectPort, listenControl, requestControl, waitForReady, openBrowser, LOCAL_URL, PORT } from './flow-runtime.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const id = projectId(root);
const action = process.argv[2];

async function printAddresses(lan, managed = true) {
  console.log(`\nКомпьютер: ${LOCAL_URL}`);
  if (lan) {
    const addresses = await detectLanAddresses();
    if (!addresses.length) console.log('Телефон: подходящий IPv4 локальной сети не найден. Проверьте Wi-Fi/кабель.');
    for (const entry of addresses) console.log(`Телефон (${entry.name}${entry.physical ? '' : ', тип адаптера не подтверждён'}): http://${entry.address}:${PORT}/`);
  } else console.log('Телефон: этот экземпляр запущен только на loopback. Остановите его в исходном терминале и используйте Start Flow.bat.');
  console.log('\nТелефон и компьютер должны быть в одной локальной сети.');
  console.log('Если телефон не подключается: разрешите Node.js в Windows Firewall только для доверенной частной сети.');
  console.log('Подробная инструкция — в README. Не отключайте брандмауэр.');
  console.log(managed ? '\nОстановка: двойной клик по Stop Flow.bat или Ctrl+C в окне сервера.' : '\nОстановка: Ctrl+C в исходном терминале. Stop Flow.bat не останавливает ручной сервер.');
}

async function stop() {
  const status = await requestControl(id);
  if (!status) {
    const port = await inspectPort(id);
    console.log(port.kind === 'flow' ? 'Flow запущен вручную. Остановите его через Ctrl+C в исходном терминале. Чужие процессы не завершались.' : 'Сервер Flow, запущенный этим скриптом, не найден. Чужие процессы не завершались.');
    return;
  }
  if (status.phase !== 'ready') throw new Error('Flow ещё запускается или уже останавливается. Повторите остановку через несколько секунд.');
  const response = await requestControl(id, 'stop');
  if (!response) throw new Error('Не удалось подтвердить команду остановки. Чужие процессы не завершались.');
  for (let attempt = 0; attempt < 100; attempt++) {
    if (!await requestControl(id)) { console.log('Flow остановлен.'); return; }
    await delay(100);
  }
  throw new Error('Flow ещё завершает работу. Проверьте исходное окно сервера.');
}

async function start() {
  if (!supportedNode(process.versions.node)) throw new Error(`Нужен Node.js 22.12+ (ветка 22) или 24+. Найден ${process.versions.node}. Установите Node.js 24 LTS с https://nodejs.org.`);
  const missing = missingDependencies(root);
  if (missing.length) throw new Error(`Зависимости отсутствуют или установлены не полностью: ${missing.slice(0, 4).join(', ')}.\nОдин раз откройте терминал в папке проекта и выполните npm ci, затем снова запустите Start Flow.bat.\nАвтоматическая установка и обновление не выполнялись.`);
  let phase = 'starting';
  let vite;
  let control;
  let resolveStopped;
  const stopped = new Promise(resolve => { resolveStopped = resolve; });
  let shutdownPromise;
  const shutdown = () => {
    shutdownPromise ??= (async () => {
      phase = 'stopping';
      try { await vite?.close(); }
      finally {
        if (control?.listening) await new Promise(resolve => control.close(resolve));
        resolveStopped();
      }
    })();
    return shutdownPromise;
  };
  try {
    // Named pipe служит блокировкой ещё до запуска Vite: одновременный двойной клик не создаст второй сервер.
    try { control = await listenControl(id, () => ({ phase }), () => shutdown().catch(error => { console.error(error); process.exitCode = 1; })); }
    catch (cause) {
      if (cause.code !== 'EADDRINUSE') throw cause;
      let status;
      for (let attempt = 0; attempt < 100; attempt++) {
        status = await requestControl(id);
        if (status?.phase === 'ready') break;
        if (!status || status.phase === 'stopping') throw new Error('Flow ещё завершает работу или канал управления недоступен. Повторите запуск через несколько секунд.', { cause });
        await delay(200);
      }
      if (status?.phase !== 'ready') throw new Error('Другой экземпляр Flow ещё запускается. Проверьте его окно.', { cause });
      console.log('Flow уже запущен. Второй сервер и лишняя вкладка не открывались.');
      await printAddresses(true);
      return;
    }
    const port = await inspectPort(id);
    if (port.kind === 'other') throw new Error(`Порт ${PORT} занят другим приложением или Flow из другой папки. Освободите порт вручную. Чужие процессы не завершались.`);
    if (port.kind === 'flow') {
      console.log('Flow уже запущен вручную. Второй сервер и лишняя вкладка не открывались.');
      await printAddresses(port.lan, false);
      return;
    }
    console.log(`Запускаю сервер на 0.0.0.0:${PORT}…`);
    const { createServer } = await import('vite');
    vite = await createServer({ root, clearScreen: false, server: { host: '0.0.0.0', port: PORT, strictPort: true, open: false } });
    await vite.listen();
    await waitForReady(id);
    phase = 'ready';
    console.log('Flow готов. HTTP-сервер отвечает.');
    await printAddresses(true);
    if (phase === 'ready' && !process.argv.includes('--no-browser')) {
      try { await openBrowser(); console.log('\nАдрес передан браузеру по умолчанию.'); }
      catch { console.log(`\nНе удалось открыть браузер автоматически. Откройте ${LOCAL_URL}`); }
    }
    const onSignal = () => { void shutdown().catch(error => { console.error(error); process.exitCode = 1; }); };
    process.once('SIGINT', onSignal);
    process.once('SIGTERM', onSignal);
    await stopped;
    process.removeListener('SIGINT', onSignal);
    process.removeListener('SIGTERM', onSignal);
    console.log('\nСервер Flow остановлен.');
  } finally { await shutdown(); }
}

console.log('\nFlow — ваши задачи в порядке\n');
try {
  if (action === 'start') await start();
  else if (action === 'stop') await stop();
  else throw new Error('Используйте Start Flow.bat или Stop Flow.bat.');
} catch (error) {
  console.error(`\nОшибка: ${error.message}`);
  process.exitCode = 1;
}

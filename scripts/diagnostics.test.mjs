import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
  .map(match => match[1])
  .find(source => source.includes('Flow diagnostics'));

function diagnosticPage(copySucceeds = true, debug = true) {
  const elements = new Map();
  const listeners = new Map();
  for (const id of ['flow-diagnostics', 'flow-diagnostic-status', 'flow-diagnostic-error', 'flow-diagnostic-report', 'flow-diagnostic-copy-status', 'flow-diagnostic-copy']) {
    elements.set(id, {
      hidden: true, dataset: {}, textContent: '', value: '',
      addEventListener(name, callback) { listeners.set(`button:${name}`, callback); },
      focus() {}, select() { this.selected = true; },
    });
  }
  const window = {
    isSecureContext: false,
    crypto: { getRandomValues() {} },
    localStorage: { getItem() { return 'PRIVATE_SAVED_TASK'; } },
    addEventListener(name, callback) { listeners.set(name, callback); },
    setTimeout() {},
  };
  const document = {
    getElementById(id) { return elements.get(id); },
    execCommand(command) { expect(command).toBe('copy'); return copySucceeds; },
  };
  runInNewContext(script, {
    window, document, navigator: {}, crypto: window.crypto,
    location: { search: debug ? '?debug=1' : '' }, performance: { getEntriesByType: () => [] },
    URL, URLSearchParams,
  });
  return { elements, emit: (name, event) => listeners.get(name)(event), clickCopy: () => listeners.get('button:click')() };
}

describe('Диагностика до запуска React', () => {
  it('показывает текст ошибки на странице, но исключает его и данные хранилища из отчёта', () => {
    const page = diagnosticPage();
    page.emit('flow:failure', { detail: { stage: 'startup', name: 'TypeError', message: 'PRIVATE_TASK_TITLE' } });
    expect(page.elements.get('flow-diagnostics').hidden).toBe(false);
    expect(page.elements.get('flow-diagnostic-error').textContent).toContain('PRIVATE_TASK_TITLE');
    const report = page.elements.get('flow-diagnostic-report').value;
    expect(report).toContain('Stage: startup');
    expect(report).not.toContain('PRIVATE_TASK_TITLE');
    expect(report).not.toContain('PRIVATE_SAVED_TASK');
  });

  it('выделяет отчёт для ручного копирования, если браузер заблокировал Clipboard API', async () => {
    const page = diagnosticPage(false);
    await page.clickCopy();
    expect(page.elements.get('flow-diagnostic-report').selected).toBe(true);
    expect(page.elements.get('flow-diagnostic-copy-status').textContent).toContain('вручную');
  });

  it('показывает ошибку загрузки ресурса и без параметра debug', () => {
    const page = diagnosticPage(true, false);
    expect(page.elements.get('flow-diagnostics').hidden).toBe(true);
    page.emit('error', { target: {} });
    expect(page.elements.get('flow-diagnostics').hidden).toBe(false);
    expect(page.elements.get('flow-diagnostic-error').textContent).toContain('Не загрузился ресурс');
  });
});

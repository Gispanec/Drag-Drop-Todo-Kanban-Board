import { describe, expect, it } from 'vitest';
import { initialData, reduce } from '../domain/board';
import { isAppData, LocalRepository, STORAGE_KEY, validDeadline } from './repository';
import { BoardStore } from '../state/store';

function memoryStorage() {
  const entries = new Map<string, string>();
  return { entries, getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => { entries.set(key, value); } };
}

describe('Локальное хранилище', () => {
  it('начинает с валидной пустой доски', () => {
    const result = new LocalRepository(memoryStorage()).load();
    expect(result.warning).toBeNull();
    expect(isAppData(result.data)).toBe(true);
  });
  it('сохраняет и загружает все поля, порядок и настройки', () => {
    const storage = memoryStorage();
    let data = initialData();
    data = reduce(data, { type: 'task.save', draft: { boardId: data.settings.activeBoardId, columnId: data.columns[0]!.id, title: 'A', description: 'Описание', priority: 'high', deadline: '2026-12-01', tags: [{ id: 'tag', name: 'Важное' }], checklist: [{ id: 'item', text: 'Шаг', completed: true }] } });
    const repository = new LocalRepository(storage);
    repository.save(data);
    expect(new LocalRepository(storage).load().data).toEqual(data);
  });
  it.each(['{bad json', JSON.stringify({ version: 1, boards: [] })])('сохраняет повреждённый оригинал перед восстановлением', raw => {
    const storage = memoryStorage();
    storage.setItem(STORAGE_KEY, raw);
    const result = new LocalRepository(storage).load();
    expect(result.warning).toContain('повреждены');
    expect(Array.from(storage.entries).find(([key]) => key.startsWith(`${STORAGE_KEY}:recovery:`))?.[1]).toBe(raw);
    expect(storage.getItem(STORAGE_KEY)).toBe(raw);
    expect(isAppData(result.data)).toBe(true);
  });
  it('не перезаписывает повреждённые данные, если резервная копия невозможна', () => {
    const storage = { getItem: () => '{bad', setItem: () => { throw new Error('QuotaExceededError'); } };
    const repository = new LocalRepository(storage);
    expect(repository.load().warning).toContain('недоступно');
    expect(() => repository.save(initialData())).toThrow('заблокировано');
  });
  it('не перезаписывает данные более новой версии', () => {
    const storage = memoryStorage();
    const raw = JSON.stringify({ version: 99, secretFutureData: 'keep' });
    storage.setItem(STORAGE_KEY, raw);
    const repository = new LocalRepository(storage);
    expect(repository.load().warning).toContain('новой версией');
    expect(() => repository.save(initialData())).toThrow('заблокировано');
    expect(storage.getItem(STORAGE_KEY)).toBe(raw);
  });
  it('обрабатывает запрет чтения localStorage', () => {
    const repository = new LocalRepository({ getItem: () => { throw new Error('SecurityError'); }, setItem: () => {} });
    expect(repository.load().warning).toContain('недоступно');
  });
  it('отклоняет потерянные связи и повторяющиеся ID', () => {
    const data = initialData();
    expect(isAppData({ ...data, settings: { ...data.settings, activeBoardId: 'missing' } })).toBe(false);
    expect(isAppData({ ...data, columns: [...data.columns, data.columns[0]] })).toBe(false);
    expect(isAppData({ ...data, columns: data.columns.map(column => ({ ...column, boardId: 'missing' })) })).toBe(false);
  });
  it.each(['2026-02-30', 'bad', '2026-13-01', '2026-2-1'])('отклоняет несуществующий дедлайн %s', deadline => expect(validDeadline(deadline)).toBe(false));
  it.each(['', '2028-02-29', '2026-10-25'])('принимает корректный дедлайн %s', deadline => expect(validDeadline(deadline)).toBe(true));
});

describe('Состояние приложения', () => {
  it('сохраняет изменение сразу, до уведомления интерфейса', () => {
    const storage = memoryStorage();
    const store = new BoardStore(new LocalRepository(storage));
    const stop = store.subscribe(() => expect(JSON.parse(storage.getItem(STORAGE_KEY)!)).toEqual(store.getSnapshot().data));
    store.dispatch({ type: 'board.create', name: 'Работа' });
    expect(new BoardStore(new LocalRepository(storage)).getSnapshot().data).toEqual(store.getSnapshot().data);
    stop();
  });
  it('сохраняет изменения в памяти при ошибке и позволяет повторить запись', () => {
    const data = initialData();
    let fail = true;
    const store = new BoardStore({ load: () => ({ data, warning: null }), save: () => { if (fail) throw new Error('QuotaExceededError'); } });
    store.dispatch({ type: 'board.create', name: 'Работа' });
    expect(store.getSnapshot().data.boards).toHaveLength(2);
    expect(store.getSnapshot().error).toContain('Не удалось сохранить');
    fail = false;
    store.retry();
    expect(store.getSnapshot().error).toBeNull();
  });
});

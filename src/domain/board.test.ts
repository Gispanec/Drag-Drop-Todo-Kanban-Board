import { describe, expect, it } from 'vitest';
import { columnTasks, initialData, moveTask, reduce } from './board';
import type { AppData, TaskDraft } from '../models';
import { isAppData } from '../storage/repository';

function add(data: AppData, title = 'Задача', columnId = data.columns.find(column => column.boardId === data.settings.activeBoardId)!.id): AppData {
  const draft: TaskDraft = { boardId: data.settings.activeBoardId, columnId, title, description: '', priority: 'medium', deadline: '', tags: [], checklist: [] };
  return reduce(data, { type: 'task.save', draft });
}
function fixture() { return add(add(add(initialData(), 'A'), 'B'), 'C'); }
const titles = (data: AppData, columnId: string) => columnTasks(data, columnId).map(task => task.title);

describe('Доски и задачи', () => {
  it('создаёт пустую доску Мои задачи с тремя колонками', () => {
    const data = initialData();
    expect(data.boards[0]?.name).toBe('Мои задачи');
    expect(data.columns.map(column => column.name)).toEqual(['Запланировано', 'В работе', 'Готово']);
    expect(isAppData(data)).toBe(true);
  });
  it('отклоняет пустое название задачи и удаляет пробелы по краям', () => {
    const data = initialData();
    expect(add(data, '  ')).toBe(data);
    expect(add(data, '  A  ').tasks[0]?.title).toBe('A');
  });
  it('редактирует содержимое, сохраняя ID, дату создания и порядок', () => {
    const data = fixture();
    const task = data.tasks[1]!;
    const result = reduce(data, { type: 'task.save', id: task.id, draft: { ...task, title: 'Обновлено', deadline: '2026-12-01', tags: [{ id: 'tag', name: 'Работа' }], checklist: [{ id: 'step', text: 'Проверить', completed: true }] } });
    expect(result.tasks[1]).toMatchObject({ ...task, title: 'Обновлено', deadline: '2026-12-01', tags: [{ id: 'tag', name: 'Работа' }], checklist: [{ id: 'step', text: 'Проверить', completed: true }], updatedAt: expect.any(String) });
    expect(isAppData(result)).toBe(true);
  });
  it('переносит задачу через редактор в конец выбранной колонки', () => {
    let data = fixture();
    data = add(data, 'D', data.columns[1]!.id);
    const task = data.tasks[0]!;
    const result = reduce(data, { type: 'task.save', id: task.id, draft: { ...task, title: 'A+', columnId: data.columns[1]!.id } });
    expect(titles(result, data.columns[0]!.id)).toEqual(['B', 'C']);
    expect(titles(result, data.columns[1]!.id)).toEqual(['D', 'A+']);
    expect(isAppData(result)).toBe(true);
  });
  it('удаляет задачу и нормализует позиции', () => {
    const data = fixture();
    const result = reduce(data, { type: 'task.delete', id: data.tasks[1]!.id });
    expect(titles(result, data.columns[0]!.id)).toEqual(['A', 'C']);
    expect(isAppData(result)).toBe(true);
  });
  it('создаёт независимую доску и переключается между досками', () => {
    const original = fixture();
    const created = reduce(original, { type: 'board.create', name: ' Работа ' });
    expect(created.boards[1]?.name).toBe('Работа');
    expect(created.tasks).toEqual(original.tasks);
    const result = add(created, 'Рабочая задача');
    expect(result.tasks.filter(task => task.boardId === created.settings.activeBoardId)).toHaveLength(1);
    expect(reduce(result, { type: 'board.select', id: original.settings.activeBoardId }).settings.activeBoardId).toBe(original.settings.activeBoardId);
    expect(isAppData(result)).toBe(true);
  });
  it('переименовывает доску, не меняя задачи', () => {
    const data = fixture();
    const result = reduce(data, { type: 'board.rename', id: data.settings.activeBoardId, name: 'Личное' });
    expect(result.boards[0]?.name).toBe('Личное');
    expect(result.tasks).toBe(data.tasks);
  });
  it('удаляет только данные выбранной доски', () => {
    const original = fixture();
    const data = add(reduce(original, { type: 'board.create', name: 'Работа' }), 'Рабочая задача');
    const result = reduce(data, { type: 'board.delete', id: data.settings.activeBoardId });
    expect(result.tasks).toEqual(original.tasks);
    expect(result.boards).toEqual(original.boards);
    expect(isAppData(result)).toBe(true);
  });
  it('после удаления последней доски создаёт пустую и сохраняет тему', () => {
    const base = fixture();
    const data = { ...base, settings: { ...base.settings, theme: 'dark' as const } };
    const result = reduce(data, { type: 'board.delete', id: data.boards[0]!.id });
    expect(result.tasks).toEqual([]);
    expect(result.settings.theme).toBe('dark');
    expect(isAppData(result)).toBe(true);
  });
  it('отклоняет несуществующие ID и пустые названия досок', () => {
    const data = fixture();
    expect(reduce(data, { type: 'board.create', name: ' ' })).toBe(data);
    expect(reduce(data, { type: 'board.select', id: 'missing' })).toBe(data);
    expect(reduce(data, { type: 'task.delete', id: 'missing' })).toBe(data);
  });
});

describe('Порядок карточек', () => {
  it.each([[0, 2, ['B', 'C', 'A']], [2, 0, ['C', 'A', 'B']], [1, 0, ['B', 'A', 'C']], [1, 2, ['A', 'C', 'B']]])('переносит карточку %i в позицию %i', (from, to, expected) => {
    const data = fixture();
    const columnId = data.columns[0]!.id;
    const result = moveTask(data, data.tasks[from as number]!.id, columnId, to as number);
    expect(titles(result, columnId)).toEqual(expected);
    expect(isAppData(result)).toBe(true);
    expect(titles(data, columnId)).toEqual(['A', 'B', 'C']);
  });
  it('переносит в пустую колонку и обратно', () => {
    const data = fixture();
    const task = data.tasks[0]!;
    const target = data.columns[1]!.id;
    const result = moveTask(data, task.id, target, 0);
    expect(titles(result, target)).toEqual(['A']);
    expect(titles(result, task.columnId)).toEqual(['B', 'C']);
    expect(isAppData(moveTask(result, task.id, task.columnId, 0))).toBe(true);
  });
  it('вставляет карточку между существующими карточками другой колонки', () => {
    let data = fixture();
    const target = data.columns[1]!.id;
    data = add(add(data, 'D', target), 'E', target);
    const result = moveTask(data, data.tasks[0]!.id, target, 1);
    expect(titles(result, target)).toEqual(['D', 'A', 'E']);
    expect(isAppData(result)).toBe(true);
  });
  it('ограничивает позицию началом и концом списка', () => {
    const data = fixture();
    expect(titles(moveTask(data, data.tasks[0]!.id, data.columns[0]!.id, 999), data.columns[0]!.id)).toEqual(['B', 'C', 'A']);
    expect(titles(moveTask(data, data.tasks[2]!.id, data.columns[0]!.id, -1), data.columns[0]!.id)).toEqual(['C', 'A', 'B']);
  });
  it('не допускает перемещения между независимыми досками', () => {
    const data = reduce(fixture(), { type: 'board.create', name: 'Другая' });
    expect(moveTask(data, data.tasks[0]!.id, data.columns[3]!.id, 0)).toBe(data);
  });
  it('сохраняет все карточки и последовательные позиции после 300 перемещений', () => {
    let data = fixture();
    const ids = data.tasks.map(task => task.id).sort();
    for (let index = 0; index < 300; index++) {
      data = moveTask(data, data.tasks[index % data.tasks.length]!.id, data.columns[index % 3]!.id, index % 4);
      expect(isAppData(data)).toBe(true);
    }
    expect(data.tasks.map(task => task.id).sort()).toEqual(ids);
  });
});

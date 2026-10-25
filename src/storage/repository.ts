import type { AppData } from '../models';
import { initialData } from '../domain/board';

export const STORAGE_KEY = 'flow-kanban:v1';
export interface LoadResult { data: AppData; warning: string | null }
export interface Repository { load(): LoadResult; save(data: AppData): void }

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string';
const id = (value: unknown): value is string => text(value) && value.length > 0;
const timestamp = (value: unknown) => text(value) && Number.isFinite(Date.parse(value));
const position = (value: unknown) => Number.isInteger(value) && Number(value) >= 0;
const uniqueIds = (items: { id: string }[]) => new Set(items.map(item => item.id)).size === items.length;

export function validDeadline(value: unknown): value is string {
  if (value === '') return true;
  if (!text(value) || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function isAppData(value: unknown): value is AppData {
  if (!record(value) || value.version !== 1 || !Array.isArray(value.boards) || !value.boards.length || !Array.isArray(value.columns) || !Array.isArray(value.tasks) || !record(value.settings)) return false;
  if (!value.boards.every((b: unknown) => record(b) && id(b.id) && id(b.name) && timestamp(b.createdAt))) return false;
  if (!value.columns.every((c: unknown) => record(c) && id(c.id) && id(c.boardId) && id(c.name) && ['planned', 'progress', 'done'].includes(String(c.kind)) && position(c.position))) return false;
  if (!value.tasks.every((t: unknown) => record(t) && id(t.id) && id(t.boardId) && id(t.columnId) && position(t.position) && id(t.title) && text(t.description) && ['low', 'medium', 'high'].includes(String(t.priority)) && validDeadline(t.deadline) && timestamp(t.createdAt) && timestamp(t.updatedAt) && Array.isArray(t.tags) && t.tags.every((tag: unknown) => record(tag) && id(tag.id) && id(tag.name)) && Array.isArray(t.checklist) && t.checklist.every((item: unknown) => record(item) && id(item.id) && id(item.text) && typeof item.completed === 'boolean'))) return false;
  if (!id(value.settings.activeBoardId) || !['system', 'light', 'dark'].includes(String(value.settings.theme))) return false;
  // После проверки полей проверяем связи и порядок, чтобы не скрыть потерянные карточки.
  const data = value as unknown as AppData;
  if (!uniqueIds([...data.boards, ...data.columns, ...data.tasks]) || !data.boards.some(b => b.id === data.settings.activeBoardId)) return false;
  if (!data.columns.every(c => data.boards.some(b => b.id === c.boardId))) return false;
  if (!data.boards.every(b => {
    const columns = data.columns.filter(c => c.boardId === b.id);
    return columns.length === 3 && new Set(columns.map(c => c.kind)).size === 3 && columns.every(c => c.position === ['planned', 'progress', 'done'].indexOf(c.kind));
  })) return false;
  return data.tasks.every(t => data.columns.some(c => c.id === t.columnId && c.boardId === t.boardId) && uniqueIds(t.tags) && uniqueIds(t.checklist)) && data.columns.every(c => {
    const tasks = data.tasks.filter(t => t.columnId === c.id).sort((a, b) => a.position - b.position);
    return tasks.every((t, index) => t.position === index);
  });
}

export class LocalRepository implements Repository {
  private blocked = false;
  constructor(private readonly storage: Pick<Storage, 'getItem' | 'setItem'>) {}

  load(): LoadResult {
    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      if (raw === null) return { data: initialData(), warning: null };
      let parsed: unknown;
      try { parsed = JSON.parse(raw); } catch { parsed = null; }
      if (isAppData(parsed)) return { data: parsed, warning: null };
      if (record(parsed) && typeof parsed.version === 'number' && parsed.version > 1) {
        this.blocked = true;
        return { data: initialData(), warning: 'Данные созданы более новой версией Flow. Обновите приложение. Сохранение отключено, чтобы сохранить исходные данные.' };
      }
      this.storage.setItem(`${STORAGE_KEY}:recovery:${Date.now()}`, raw);
      return { data: initialData(), warning: 'Сохранённые данные повреждены. Исходная копия сохранена в localStorage с префиксом flow-kanban:v1:recovery:. Создана новая доска.' };
    } catch {
      this.blocked = true;
      return { data: initialData(), warning: 'Хранилище недоступно или не удалось сохранить копию повреждённых данных. Изменения остаются в памяти до закрытия страницы.' };
    }
  }

  save(data: AppData): void {
    if (this.blocked) throw new Error('Сохранение заблокировано: исходные данные защищены. Экспортируйте изменения перед закрытием страницы.');
    this.storage.setItem(STORAGE_KEY, JSON.stringify(data));
  }
}

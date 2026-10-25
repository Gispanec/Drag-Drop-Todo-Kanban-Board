import { COLUMN_NAMES } from '../models';
import type { AppData, Board, Column, ColumnKind, Task, TaskDraft, Theme } from '../models';

export const uid = () => crypto.randomUUID();

export function createBoard(name: string): { board: Board; columns: Column[] } {
  const board: Board = { id: uid(), name: name.trim(), createdAt: new Date().toISOString() };
  const columns = (['planned', 'progress', 'done'] as ColumnKind[]).map((kind, position) => ({
    id: uid(), boardId: board.id, name: COLUMN_NAMES[kind], kind, position,
  }));
  return { board, columns };
}

export function initialData(): AppData {
  const { board, columns } = createBoard('Мои задачи');
  return { version: 1, boards: [board], columns, tasks: [], settings: { activeBoardId: board.id, theme: 'system' } };
}

export const columnTasks = (data: AppData, columnId: string): Task[] =>
  data.tasks.filter(task => task.columnId === columnId).sort((a, b) => a.position - b.position);

function normalize(tasks: Task[], columnId: string): Task[] {
  return tasks.map((task, position) => ({ ...task, columnId, position }));
}

export function moveTask(data: AppData, taskId: string, columnId: string, index: number): AppData {
  const task = data.tasks.find(item => item.id === taskId);
  const column = data.columns.find(item => item.id === columnId);
  if (!task || !column || task.boardId !== column.boardId) return data;
  const target = columnTasks(data, columnId).filter(item => item.id !== taskId);
  const position = Math.max(0, Math.min(Number.isFinite(index) ? Math.trunc(index) : target.length, target.length));
  if (task.columnId === columnId && task.position === position) return data;
  target.splice(position, 0, { ...task, updatedAt: new Date().toISOString() });
  const affected = new Set([task.columnId, columnId]);
  return {
    ...data,
    tasks: [
      ...data.tasks.filter(item => !affected.has(item.columnId)),
      ...(task.columnId === columnId ? [] : normalize(columnTasks(data, task.columnId).filter(item => item.id !== taskId), task.columnId)),
      ...normalize(target, columnId),
    ],
  };
}

export type Action =
  | { type: 'board.create'; name: string }
  | { type: 'board.rename'; id: string; name: string }
  | { type: 'board.delete'; id: string }
  | { type: 'board.select'; id: string }
  | { type: 'task.save'; id?: string; draft: TaskDraft }
  | { type: 'task.delete'; id: string }
  | { type: 'task.move'; id: string; columnId: string; index: number }
  | { type: 'theme'; theme: Theme };

export function reduce(data: AppData, action: Action): AppData {
  switch (action.type) {
    case 'board.create': {
      if (!action.name.trim()) return data;
      const { board, columns } = createBoard(action.name);
      return { ...data, boards: [...data.boards, board], columns: [...data.columns, ...columns], settings: { ...data.settings, activeBoardId: board.id } };
    }
    case 'board.rename':
      return action.name.trim() ? { ...data, boards: data.boards.map(board => board.id === action.id ? { ...board, name: action.name.trim() } : board) } : data;
    case 'board.select':
      return data.boards.some(board => board.id === action.id) ? { ...data, settings: { ...data.settings, activeBoardId: action.id } } : data;
    case 'board.delete': {
      if (!data.boards.some(board => board.id === action.id)) return data;
      const boards = data.boards.filter(board => board.id !== action.id);
      if (!boards.length) {
        const fresh = initialData();
        return { ...fresh, settings: { ...fresh.settings, theme: data.settings.theme } };
      }
      return { ...data, boards, columns: data.columns.filter(column => column.boardId !== action.id), tasks: data.tasks.filter(task => task.boardId !== action.id), settings: { ...data.settings, activeBoardId: data.settings.activeBoardId === action.id ? boards[0]!.id : data.settings.activeBoardId } };
    }
    case 'task.save': {
      const title = action.draft.title.trim();
      const column = data.columns.find(item => item.id === action.draft.columnId && item.boardId === action.draft.boardId);
      if (!title || !column) return data;
      const existing = data.tasks.find(task => task.id === action.id);
      if (action.id && (!existing || existing.boardId !== action.draft.boardId)) return data;
      const now = new Date().toISOString();
      const task: Task = { ...action.draft, title, id: existing?.id ?? uid(), position: existing?.position ?? columnTasks(data, column.id).length, createdAt: existing?.createdAt ?? now, updatedAt: now };
      if (existing && existing.columnId !== column.id) {
        const updated = { ...data, tasks: data.tasks.map(item => item.id === task.id ? { ...task, columnId: existing.columnId } : item) };
        return moveTask(updated, task.id, column.id, columnTasks(data, column.id).length);
      }
      return { ...data, tasks: existing ? data.tasks.map(item => item.id === task.id ? task : item) : [...data.tasks, task] };
    }
    case 'task.delete': {
      const task = data.tasks.find(item => item.id === action.id);
      if (!task) return data;
      return { ...data, tasks: [...data.tasks.filter(item => item.columnId !== task.columnId), ...normalize(columnTasks(data, task.columnId).filter(item => item.id !== action.id), task.columnId)] };
    }
    case 'task.move': return moveTask(data, action.id, action.columnId, action.index);
    case 'theme': return { ...data, settings: { ...data.settings, theme: action.theme } };
  }
}

export type Priority = 'low' | 'medium' | 'high';
export type Theme = 'system' | 'light' | 'dark';
export type ColumnKind = 'planned' | 'progress' | 'done';

export interface Board { id: string; name: string; createdAt: string }
export interface Column { id: string; boardId: string; kind: ColumnKind; name: string; position: number }
export interface Tag { id: string; name: string }
export interface ChecklistItem { id: string; text: string; completed: boolean }
export interface Task {
  id: string;
  boardId: string;
  columnId: string;
  position: number;
  title: string;
  description: string;
  priority: Priority;
  deadline: string;
  tags: Tag[];
  checklist: ChecklistItem[];
  createdAt: string;
  updatedAt: string;
}
export interface Settings { activeBoardId: string; theme: Theme }
export interface AppData { version: 1; boards: Board[]; columns: Column[]; tasks: Task[]; settings: Settings }
export type TaskDraft = Omit<Task, 'id' | 'position' | 'createdAt' | 'updatedAt'>;

export const PRIORITIES: Record<Priority, string> = { low: 'Низкий', medium: 'Средний', high: 'Высокий' };
export const COLUMN_NAMES: Record<ColumnKind, string> = { planned: 'Запланировано', progress: 'В работе', done: 'Готово' };

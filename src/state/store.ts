import { reduce } from '../domain/board';
import type { Action } from '../domain/board';
import type { AppData } from '../models';
import type { Repository } from '../storage/repository';

export interface Snapshot { data: AppData; error: string | null; warning: string | null }

export class BoardStore {
  private snapshot: Snapshot;
  private listeners = new Set<() => void>();
  constructor(private readonly repository: Repository) {
    const { data, warning } = repository.load();
    this.snapshot = { data, warning, error: null };
  }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  dispatch = (action: Action) => {
    const next = reduce(this.snapshot.data, action);
    if (next === this.snapshot.data) return;
    this.persist(next);
  };
  retry = () => this.persist(this.snapshot.data);
  private persist(data: AppData) {
    let error: string | null = null;
    try { this.repository.save(data); }
    catch (cause) {
      error = cause instanceof Error && cause.message.startsWith('Сохранение заблокировано') ? cause.message : 'Не удалось сохранить изменения в браузере: хранилище заполнено или недоступно. Экспортируйте данные или повторите сохранение.';
    }
    this.snapshot = { ...this.snapshot, data, error };
    this.listeners.forEach(listener => listener());
  }
}

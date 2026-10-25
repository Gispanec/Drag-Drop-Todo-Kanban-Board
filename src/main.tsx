import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Startup from './Startup';
import { LocalRepository } from './storage/repository';
import { BoardStore } from './state/store';
import '@fontsource-variable/manrope';
import './styles.css';

// Доступ к localStorage тоже может выбросить SecurityError в приватном окружении.
const storage = {
  getItem: (key: string) => window.localStorage.getItem(key),
  setItem: (key: string, value: string) => window.localStorage.setItem(key, value),
};
function reportFailure(error: unknown) {
  window.dispatchEvent(new CustomEvent('flow:failure', {
    detail: { stage: 'startup', name: error instanceof Error ? error.name : 'Error', message: error instanceof Error ? error.message : String(error) },
  }));
}

try {
  const store = new BoardStore(new LocalRepository(storage));
  const root = document.getElementById('root');
  if (!root) throw new Error('Не найден корневой элемент приложения.');
  createRoot(root).render(<StrictMode><Startup store={store} /></StrictMode>);
} catch (error) {
  reportFailure(error);
}

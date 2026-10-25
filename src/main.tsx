import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { LocalRepository } from './storage/repository';
import { BoardStore } from './state/store';
import '@fontsource-variable/manrope';
import './styles.css';

// Доступ к localStorage тоже может выбросить SecurityError в приватном окружении.
const storage = {
  getItem: (key: string) => window.localStorage.getItem(key),
  setItem: (key: string, value: string) => window.localStorage.setItem(key, value),
};
const store = new BoardStore(new LocalRepository(storage));

createRoot(document.getElementById('root')!).render(<StrictMode><App store={store} /></StrictMode>);

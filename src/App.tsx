import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AlertCircle, ArrowDownToLine, Check, ChevronRight, Columns3, LayoutDashboard, Menu, Monitor, Moon, Plus, Search, Settings2, SlidersHorizontal, Sun, X } from 'lucide-react';
import type { Board, Column, Task, Theme } from './models';
import type { BoardStore } from './state/store';
import { exportData, pluralTasks } from './utils';
import { Sidebar } from './components/Sidebar';
import { KanbanBoard } from './components/KanbanBoard';
import { TaskEditor } from './components/TaskEditor';
import { BoardDialog } from './components/BoardDialog';

type Editor = { task?: Task; column: Column };

export default function App({ store }: { store: BoardStore }) {
  const { data, error, warning } = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [boardDialog, setBoardDialog] = useState<Board | 'new' | null>(null);
  const [query, setQuery] = useState('');
  const [priority, setPriority] = useState('all');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDialogElement>(null);
  const board = data.boards.find(item => item.id === data.settings.activeBoardId)!;
  const columns = data.columns.filter(column => column.boardId === board.id).sort((a, b) => a.position - b.position);
  const tasks = data.tasks.filter(task => task.boardId === board.id);
  const completed = tasks.filter(task => columns.find(column => column.id === task.columnId)?.kind === 'done').length;
  const percent = tasks.length ? Math.round(completed / tasks.length * 100) : 0;

  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const update = () => { document.documentElement.dataset.theme = data.settings.theme === 'system' ? media.matches ? 'dark' : 'light' : data.settings.theme; };
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [data.settings.theme]);
  useEffect(() => {
    if (menuOpen) menuRef.current?.showModal();
    else menuRef.current?.close();
  }, [menuOpen]);
  function selectBoard(id: string) { store.dispatch({ type: 'board.select', id }); setQuery(''); setPriority('all'); setMenuOpen(false); }
  function newTask(column = columns[0]!) { setEditor({ column }); }
  function openTask(task: Task) { const column = columns.find(item => item.id === task.columnId); if (column) setEditor({ task, column }); }
  const sidebarProps = { data, onSelect: selectBoard, onCreate: () => { setMenuOpen(false); setBoardDialog('new'); }, onSettings: (item: Board) => { setMenuOpen(false); setBoardDialog(item); }, onExport: () => exportData(data) };
  const themes: { id: Theme; label: string; icon: typeof Sun }[] = [{ id: 'light', label: 'Светлая тема', icon: Sun }, { id: 'dark', label: 'Тёмная тема', icon: Moon }, { id: 'system', label: 'Системная тема', icon: Monitor }];
  return <div className="app-shell">
    <a href="#board-content" className="skip-link">Перейти к доске</a>
    <aside className="sidebar"><Sidebar {...sidebarProps} /></aside>
    <dialog ref={menuRef} className="mobile-sidebar" aria-label="Список досок" onCancel={event => { event.preventDefault(); setMenuOpen(false); }}><Sidebar {...sidebarProps} onClose={() => setMenuOpen(false)} /></dialog>
    <div className="workspace"><header className="topbar"><div className="breadcrumbs"><button className="icon-button mobile-menu-button" aria-label="Открыть список досок" onClick={() => setMenuOpen(true)}><Menu size={21} /></button><LayoutDashboard size={16} /><span>Личное пространство</span><ChevronRight size={14} /><strong>Доска</strong></div><div className="topbar-right"><span className={`save-indicator ${error ? 'save-error' : ''}`}><span className="tiny-dot" />{error ? 'Не сохранено' : 'Локальное хранение'}</span><div className="theme-switch" aria-label="Оформление">{themes.map(({ id, label, icon: Icon }) => <button key={id} className={data.settings.theme === id ? 'active' : ''} aria-label={label} title={label} aria-pressed={data.settings.theme === id} onClick={() => store.dispatch({ type: 'theme', theme: id })}><Icon size={15} /></button>)}</div></div></header>
      <main id="board-content" tabIndex={-1}>
        {(error || warning) && <div className="storage-warning" role="alert"><AlertCircle size={20} /><div>{error || warning}</div><button className="text-button" onClick={() => exportData(data)}><ArrowDownToLine size={16} />Экспорт</button>{error && <button className="text-button" onClick={store.retry}>Повторить</button>}</div>}
        <div className="board-intro"><div><div className="board-eyebrow"><span className="board-heading-icon"><Columns3 size={19} /></span>ДОСКА ЗАДАЧ</div><div className="board-title-line"><h1>{board.name}</h1><button className="icon-button board-settings" aria-label="Настройки текущей доски" onClick={() => setBoardDialog(board)}><Settings2 size={19} /></button></div><p className="board-description">Меньше шума. Больше сделанного.</p></div><button className="primary-button add-task-button" onClick={() => newTask()}><Plus size={18} />Добавить задачу</button></div>
        <div className="board-toolbar"><div className="view-tab"><Columns3 size={16} /><span>Доска</span><span className="total-task-count">{tasks.length}</span></div><div className="board-filters"><div className="search-field"><Search size={16} /><input aria-label="Поиск задач" placeholder="Найти задачу…" value={query} onChange={event => setQuery(event.target.value)} />{query && <button className="icon-button" aria-label="Очистить поиск" onClick={() => setQuery('')}><X size={14} /></button>}</div><label className="priority-filter"><SlidersHorizontal size={15} /><span className="sr-only">Фильтр по приоритету</span><select aria-label="Фильтр по приоритету" value={priority} onChange={event => setPriority(event.target.value)}><option value="all">Все приоритеты</option><option value="high">Высокий</option><option value="medium">Средний</option><option value="low">Низкий</option></select></label></div></div>
        <div className="board-summary"><span><span className="summary-dot" />{pluralTasks(tasks.length)}<span className="summary-divider">/</span>{completed} выполнено</span><div className="board-progress"><span>Прогресс доски</span><div className="progress-track" role="progressbar" aria-label="Прогресс доски" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${percent}%` }} /></div><strong>{percent}%</strong></div></div>
        {(query.trim() || priority !== 'all') && <div className="filter-note">Показаны результаты фильтра. Сбросьте его, чтобы перетаскивать задачи.<button className="text-button" onClick={() => { setQuery(''); setPriority('all'); }}>Сбросить</button></div>}
        <KanbanBoard key={board.id} data={data} columns={columns} query={query} priority={priority} dispatch={store.dispatch} onAdd={newTask} onOpen={openTask} />
        <footer className="board-bottom-note"><span><Check size={14} />{error ? 'Есть несохранённые изменения' : 'Изменения сохраняются в этом браузере'}</span><span>Тяните карточку или её ручку <span className="keyboard-hint">⠿</span></span></footer>
      </main>
    </div>
    {editor && <TaskEditor key={editor.task?.id ?? editor.column.id} task={editor.task} column={editor.column} columns={columns} dispatch={store.dispatch} onClose={() => setEditor(null)} />}
    {boardDialog && <BoardDialog key={boardDialog === 'new' ? 'new' : boardDialog.id} board={boardDialog === 'new' ? undefined : boardDialog} taskCount={boardDialog === 'new' ? 0 : data.tasks.filter(task => task.boardId === boardDialog.id).length} dispatch={action => { store.dispatch(action); setQuery(''); setPriority('all'); }} onClose={() => setBoardDialog(null)} />}
  </div>;
}

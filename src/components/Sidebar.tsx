import { ArrowDownToLine, ArrowUpRight, Columns3, HardDrive, MoreHorizontal, Plus, X } from 'lucide-react';
import type { AppData, Board } from '../models';
import { pluralTasks } from '../utils';

interface Props { data: AppData; onSelect: (id: string) => void; onCreate: () => void; onSettings: (board: Board) => void; onExport: () => void; onClose?: () => void }

export function Sidebar({ data, onSelect, onCreate, onSettings, onExport, onClose }: Props) {
  return <>
    <div className="brand"><span className="brand-mark"><i /><i /><i /></span><span>flow<span className="brand-period">.</span></span>{onClose && <button className="icon-button sidebar-close" aria-label="Закрыть список досок" onClick={onClose}><X size={21} /></button>}</div>
    <div className="workspace-label"><span className="workspace-avatar">Л</span><div><strong>Личное пространство</strong><span>Всё важное — под рукой</span></div></div>
    <div className="sidebar-section-heading"><span>МОИ ДОСКИ</span><button className="icon-button" aria-label="Создать доску" onClick={onCreate}><Plus size={17} /></button></div>
    <nav aria-label="Доски" className="board-navigation">{data.boards.map((board, index) => <div key={board.id} className={`board-nav-item ${board.id === data.settings.activeBoardId ? 'active' : ''}`}><button className="board-select" aria-current={board.id === data.settings.activeBoardId ? 'page' : undefined} onClick={() => onSelect(board.id)}><span className={`board-nav-icon color-${index % 4}`}><Columns3 size={17} /></span><span className="board-nav-name">{board.name}</span><span className="board-nav-count">{data.tasks.filter(task => task.boardId === board.id).length}</span></button><button className="icon-button board-options" aria-label={`Настройки доски: ${board.name}`} onClick={() => onSettings(board)}><MoreHorizontal size={17} /></button></div>)}</nav>
    <button className="new-board-button" onClick={onCreate}><Plus size={17} />Новая доска</button>
    <div className="sidebar-bottom"><div className="local-note"><span className="local-note-icon"><HardDrive size={18} /></span><strong>Ваши задачи. Ваши данные.</strong><p>Хранятся только в этом браузере.<br />Без аккаунта и лишних отвлечений.</p><span className="local-note-count">{pluralTasks(data.tasks.length)} в вашем пространстве</span></div><button className="export-button" onClick={onExport}><ArrowDownToLine size={15} />Экспортировать данные<ArrowUpRight size={14} /></button><div className="sidebar-signoff"><span className="tiny-dot" />Пространство для ясности<span>v1.0</span></div></div>
  </>;
}

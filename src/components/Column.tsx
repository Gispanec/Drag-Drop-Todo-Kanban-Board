import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Check, CircleDashed, Plus } from 'lucide-react';
import type { Column as ColumnModel, Task } from '../models';
import { TaskCard } from './TaskCard';

interface Props { column: ColumnModel; tasks: Task[]; onAdd: (column: ColumnModel) => void; onOpen: (task: Task) => void; dragging: boolean; disabled: boolean; suppressClick: () => boolean }

export function Column({ column, tasks, onAdd, onOpen, dragging, disabled, suppressClick }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id, data: { type: 'column' } });
  return <section className={`kanban-column column-${column.kind} ${isOver && dragging ? 'column-over' : ''}`} aria-label={column.name} data-column-kind={column.kind}>
    <div className="column-header"><h2><span className="status-icon">{column.kind === 'done' ? <Check size={12} /> : column.kind === 'planned' ? <CircleDashed size={16} /> : <span className="progress-status" />}</span>{column.name}<span className="column-count">{tasks.length}</span></h2><button type="button" className="icon-button" aria-label={`Добавить задачу: ${column.name}`} onClick={() => onAdd(column)}><Plus size={18} /></button></div>
    <div ref={setNodeRef} className={`column-body ${dragging ? 'accepting-drop' : ''}`}>
      <SortableContext items={tasks.map(task => task.id)} strategy={verticalListSortingStrategy}>
        {tasks.map(task => <TaskCard key={task.id} task={task} done={column.kind === 'done'} onOpen={onOpen} disabled={disabled} suppressClick={suppressClick} />)}
      </SortableContext>
      {!tasks.length && <div className="empty-column"><div className="empty-column-icon">{column.kind === 'done' ? <Check size={22} /> : <Plus size={22} />}</div><p>{dragging ? 'Отпустите карточку здесь' : column.kind === 'done' ? 'Здесь будут ваши победы' : column.kind === 'progress' ? 'Всё начинается с первого шага' : 'Место для новых планов'}</p><span>{dragging ? 'Задача займёт своё место' : 'Перетащите задачу в эту колонку'}</span></div>}
    </div>
    <button type="button" className="column-add" onClick={() => onAdd(column)}><Plus size={16} />Добавить задачу</button>
  </section>;
}

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CalendarDays, CheckCheck, GripVertical, ListChecks } from 'lucide-react';
import type { Task } from '../models';
import { PRIORITIES } from '../models';
import { formatDeadline, tagColor, today } from '../utils';

export function CardContent({ task, done = false }: { task: Task; done?: boolean }) {
  const completed = task.checklist.filter(item => item.completed).length;
  const overdue = task.deadline && task.deadline < today() && !done;
  return <>
    <div className="card-top"><span className={`priority-label ${task.priority}`}><span className="priority-dot" />{PRIORITIES[task.priority]}</span><span className="card-grip-visual"><GripVertical size={16} /></span></div>
    <h3 className={done ? 'done-title' : ''}>{task.title}</h3>
    {task.tags.length > 0 && <div className="card-tags">{task.tags.map(tag => <span key={tag.id} className={`tag tag-${tagColor(tag.name)}`}>{tag.name}</span>)}</div>}
    {(task.deadline || task.checklist.length > 0 || done) && <div className="card-footer">{task.deadline && <span className={overdue ? 'overdue' : ''}><CalendarDays size={13} />{formatDeadline(task.deadline)}{overdue && <span className="sr-only">, просрочено</span>}</span>}{task.checklist.length > 0 && <span className={completed === task.checklist.length ? 'all-completed' : ''}><ListChecks size={14} />{completed} / {task.checklist.length}<span className="sr-only"> выполнено</span></span>}{done && <CheckCheck size={16} className="done-icon" />}</div>}
  </>;
}

interface Props { task: Task; done: boolean; disabled: boolean; onOpen: (task: Task) => void; suppressClick: () => boolean }

export function TaskCard({ task, done, disabled, onOpen, suppressClick }: Props) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, disabled, data: { columnId: task.columnId, type: 'task' } });
  return <article ref={setNodeRef} className={`task-card ${isDragging ? 'is-dragging' : ''}`} data-task-id={task.id} style={{ transform: CSS.Transform.toString(transform), transition }}
    onMouseDown={event => {
      if (!(event.target instanceof Element && event.target.closest('.task-title-button'))) listeners?.onMouseDown?.(event);
    }}
    onClick={() => {
      if (isDragging || suppressClick()) return;
      onOpen(task);
    }}>
    <CardContent task={task} done={done} />
    <button className="task-title-button" aria-label={`Открыть задачу: ${task.title}`} type="button" onMouseDown={event => listeners?.onMouseDown?.(event)}><span className="sr-only">{task.title}</span></button>
    <button ref={setActivatorNodeRef} type="button" className="drag-handle" {...attributes} onTouchStart={event => listeners?.onTouchStart?.(event)} onKeyDown={event => listeners?.onKeyDown?.(event)} aria-label={`Перетащить задачу: ${task.title}`} disabled={disabled} onClick={event => event.stopPropagation()}><GripVertical size={17} /></button>
  </article>;
}

import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor, closestCenter, closestCorners, getFirstCollision, pointerWithin, rectIntersection, useSensor, useSensors, MeasuringStrategy } from '@dnd-kit/core';
import type { CollisionDetection, DragEndEvent, DragOverEvent, KeyboardCoordinateGetter } from '@dnd-kit/core';
import type { AppData, Column as ColumnModel, Task } from '../models';
import type { Action } from '../domain/board';
import { columnTasks, moveTask } from '../domain/board';
import { Column } from './Column';
import { CardContent } from './TaskCard';

interface Props { data: AppData; columns: ColumnModel[]; query: string; priority: string; dispatch: (action: Action) => void; onAdd: (column: ColumnModel) => void; onOpen: (task: Task) => void }

export function KanbanBoard({ data, columns, query, priority, dispatch, onAdd, onOpen }: Props) {
  const [preview, setPreview] = useState<AppData | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const working = useRef(data);
  const suppressUntil = useRef(0);
  const lastOver = useRef<string | null>(null);
  const insertionTarget = useRef<string | null>(null);
  const filtered = !!query.trim() || priority !== 'all';
  // Влево/вправо всегда означают соседнюю колонку, даже если высоты карточек различаются.
  const keyboardCoordinates: KeyboardCoordinateGetter = (event, { context }) => {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) return;
    event.preventDefault();
    const current = working.current;
    const task = current.tasks.find(item => item.id === context.active?.id);
    if (!task) return;
    const overTask = current.tasks.find(item => item.id === context.over?.id);
    const columnIndex = columns.findIndex(column => column.id === task.columnId);
    const horizontal = event.code === 'ArrowLeft' || event.code === 'ArrowRight';
    const column = horizontal ? columns[columnIndex + (event.code === 'ArrowRight' ? 1 : -1)] : columns[columnIndex];
    if (!column) return;
    const items = columnTasks(current, column.id).filter(item => horizontal ? item.id !== task.id : true);
    const currentIndex = overTask?.columnId === column.id ? overTask.position : task.position;
    const index = horizontal ? Math.min(task.position, items.length - 1) : currentIndex + (event.code === 'ArrowDown' ? 1 : -1);
    if (!horizontal && (index < 0 || index >= items.length)) return;
    const targetId = items[index]?.id ?? column.id;
    const rect = context.droppableRects.get(targetId);
    if (!rect) return;
    return { x: rect.left, y: rect.top + (!horizontal && event.code === 'ArrowDown' ? rect.height - (context.collisionRect?.height ?? rect.height) : 0) };
  };
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: keyboardCoordinates }),
  );
  const shown = preview ?? data;
  const collisionDetection: CollisionDetection = args => {
    const pointer = pointerWithin(args);
    const collisions = args.pointerCoordinates ? pointer.length ? pointer : rectIntersection(args) : closestCorners(args);
    let overId = getFirstCollision(collisions, 'id');
    if (overId) {
      const column = columns.find(item => item.id === overId);
      if (column) {
        const ids = columnTasks(working.current, column.id).filter(task => task.id !== args.active.id).map(task => task.id);
        if (ids.length) overId = closestCenter({ ...args, droppableContainers: args.droppableContainers.filter(container => ids.includes(String(container.id))) })[0]?.id ?? overId;
      }
      lastOver.current = String(overId);
      return [{ id: overId }];
    }
    return lastOver.current ? [{ id: lastOver.current }] : [];
  };
  function over({ active, over }: DragOverEvent) {
    if (!over) return;
    const current = working.current;
    const activeItem = current.tasks.find(task => task.id === active.id);
    const overItem = current.tasks.find(task => task.id === over.id);
    const targetColumn = columns.find(column => column.id === over.id)?.id ?? overItem?.columnId;
    if (!activeItem || !targetColumn || activeItem.columnId === targetColumn) return;
    const items = columnTasks(current, targetColumn);
    const after = active.rect.current.translated && active.rect.current.translated.top + active.rect.current.translated.height / 2 > over.rect.top + over.rect.height / 2;
    const index = overItem ? items.findIndex(task => task.id === overItem.id) + (after ? 1 : 0) : items.length;
    working.current = moveTask(current, activeItem.id, targetColumn, index);
    insertionTarget.current = String(over.id);
    setPreview(working.current);
  }
  function finish({ active, over }: DragEndEvent) {
    const current = working.current;
    const task = current.tasks.find(item => item.id === active.id);
    if (over && task) {
      const overTask = current.tasks.find(item => item.id === over.id);
      const columnId = columns.find(column => column.id === over.id)?.id ?? overTask?.columnId;
      if (columnId) {
        const items = columnTasks(current, columnId);
        const index = insertionTarget.current === String(over.id) && task.columnId === columnId ? task.position : overTask ? items.findIndex(item => item.id === overTask.id) : items.filter(item => item.id !== task.id).length;
        dispatch({ type: 'task.move', id: task.id, columnId, index });
      }
    }
    suppressUntil.current = Date.now() + 350;
    setActiveTask(null);
    setPreview(null);
    lastOver.current = null;
    insertionTarget.current = null;
  }
  return <DndContext sensors={sensors} collisionDetection={collisionDetection} measuring={{ droppable: { strategy: MeasuringStrategy.Always } }} autoScroll={{ threshold: { x: 0.15, y: 0.15 } }}
    accessibility={{ screenReaderInstructions: { draggable: 'Нажмите пробел, чтобы поднять задачу. Стрелками переместите её, в том числе между колонками. Пробел — положить, Escape — отменить.' }, announcements: {
      onDragStart: ({ active }) => `Поднята задача ${data.tasks.find(task => task.id === active.id)?.title ?? ''}.`,
      onDragOver: ({ over }) => over ? `Место вставки: ${data.tasks.find(task => task.id === over.id)?.title ?? columns.find(column => column.id === over.id)?.name ?? ''}` : 'За пределами доски.',
      onDragEnd: () => 'Перемещение завершено.', onDragCancel: () => 'Перемещение отменено.',
    } }}
    onDragStart={({ active }) => { working.current = data; lastOver.current = null; insertionTarget.current = null; setPreview(data); setActiveTask(data.tasks.find(task => task.id === active.id) ?? null); }}
    onDragOver={over} onDragEnd={finish} onDragCancel={() => { suppressUntil.current = Date.now() + 350; setActiveTask(null); setPreview(null); lastOver.current = null; }}>
    <div className={`kanban-board ${activeTask ? 'is-sorting' : ''}`}>{columns.map(column => <Column key={column.id} column={column} tasks={columnTasks(shown, column.id).filter(task => (priority === 'all' || task.priority === priority) && (!query.trim() || [task.title, task.description, ...task.tags.map(tag => tag.name)].join(' ').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())))} onAdd={onAdd} onOpen={onOpen} dragging={!!activeTask} disabled={filtered} suppressClick={() => Date.now() < suppressUntil.current} />)}</div>
    {createPortal(<DragOverlay dropAnimation={{ duration: 220, easing: 'cubic-bezier(0.2, 0, 0, 1)' }}>{activeTask ? <div className="task-card drag-overlay"><CardContent task={activeTask} done={columns.some(column => column.id === activeTask.columnId && column.kind === 'done')} /></div> : null}</DragOverlay>, document.body)}
  </DndContext>;
}

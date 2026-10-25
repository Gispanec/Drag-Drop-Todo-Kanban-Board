import { useState } from 'react';
import { CalendarDays, Check, ListChecks, Plus, Tag as TagIcon, Trash2, X } from 'lucide-react';
import type { Column, Priority, Task, TaskDraft } from '../models';
import { PRIORITIES } from '../models';
import { uid } from '../domain/board';
import type { Action } from '../domain/board';
import { validDeadline } from '../storage/repository';
import { tagColor } from '../utils';
import { Modal } from './Modal';

interface Props { task?: Task; column: Column; columns: Column[]; dispatch: (action: Action) => void; onClose: () => void }

export function TaskEditor({ task, column, columns, dispatch, onClose }: Props) {
  const [draft, setDraft] = useState<TaskDraft>(task ? { ...task } : { boardId: column.boardId, columnId: column.id, title: '', description: '', priority: 'medium', deadline: '', tags: [], checklist: [] });
  const [newTag, setNewTag] = useState('');
  const [newItem, setNewItem] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const completed = draft.checklist.filter(item => item.completed).length;
  function update<K extends keyof TaskDraft>(key: K, value: TaskDraft[K]) { setDraft(previous => ({ ...previous, [key]: value })); }
  function addTag() {
    const name = newTag.trim().replace(/^#/, '');
    if (name && !draft.tags.some(tag => tag.name.toLocaleLowerCase() === name.toLocaleLowerCase())) update('tags', [...draft.tags, { id: uid(), name }]);
    setNewTag('');
  }
  function addItem() {
    if (!newItem.trim()) return;
    update('checklist', [...draft.checklist, { id: uid(), text: newItem.trim(), completed: false }]);
    setNewItem('');
  }
  return <Modal title={task ? 'Детали задачи' : 'Новая задача'} subtitle={task ? 'Большие дела складываются из маленьких шагов.' : 'Освободите голову. Запишите следующий шаг.'} onClose={onClose}>
    <form onSubmit={event => {
      event.preventDefault();
      if (!draft.title.trim() || !validDeadline(draft.deadline)) return;
      let finalDraft = draft;
      const pendingTag = newTag.trim().replace(/^#/, '');
      if (pendingTag && !draft.tags.some(tag => tag.name.toLocaleLowerCase() === pendingTag.toLocaleLowerCase())) finalDraft = { ...finalDraft, tags: [...finalDraft.tags, { id: uid(), name: pendingTag }] };
      if (newItem.trim()) finalDraft = { ...finalDraft, checklist: [...finalDraft.checklist, { id: uid(), text: newItem.trim(), completed: false }] };
      dispatch({ type: 'task.save', id: task?.id, draft: finalDraft });
      onClose();
    }}>
      <div className="editor-body">
        <label className="field">Название <span className="required">*</span><input autoFocus required maxLength={300} value={draft.title} onChange={event => update('title', event.target.value)} placeholder="Что нужно сделать?" className="title-input" /></label>
        <label className="field">Описание<textarea rows={3} maxLength={10000} value={draft.description} onChange={event => update('description', event.target.value)} placeholder="Контекст, идеи или полезные ссылки…" /></label>
        <div className="field-grid"><label className="field">Статус<select value={draft.columnId} onChange={event => update('columnId', event.target.value)}>{columns.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="field"><span><CalendarDays size={15} /> Срок выполнения</span><input type="date" max="9999-12-31" value={draft.deadline} onChange={event => update('deadline', event.target.value)} /></label></div>
        <fieldset className="priority-field"><legend>Приоритет</legend><div className="priority-options">{(Object.keys(PRIORITIES) as Priority[]).map(priority => <label key={priority} className={`priority-option ${priority} ${draft.priority === priority ? 'selected' : ''}`}><input type="radio" name="priority" value={priority} checked={draft.priority === priority} onChange={() => update('priority', priority)} /><span className="priority-dot" />{PRIORITIES[priority]}{draft.priority === priority && <Check size={13} />}</label>)}</div></fieldset>
        <section className="editor-section"><h3><TagIcon size={16} />Теги</h3><div className="editor-tags">{draft.tags.map(tag => <span key={tag.id} className={`tag tag-${tagColor(tag.name)}`}>{tag.name}<button type="button" aria-label={`Удалить тег ${tag.name}`} onClick={() => update('tags', draft.tags.filter(item => item.id !== tag.id))}><X size={13} /></button></span>)}</div><div className="inline-input"><input aria-label="Новый тег" maxLength={30} value={newTag} placeholder="Добавить тег" onChange={event => setNewTag(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ',') { event.preventDefault(); addTag(); } }} /><button type="button" className="icon-button" aria-label="Добавить тег" disabled={!newTag.trim()} onClick={addTag}><Plus size={18} /></button></div></section>
        <section className="editor-section"><h3><ListChecks size={17} />Чек-лист <span className="muted">{completed} / {draft.checklist.length}</span></h3>{draft.checklist.length > 0 && <div className="check-progress"><span style={{ width: `${completed / draft.checklist.length * 100}%` }} /></div>}<div className="checklist">{draft.checklist.map(item => <div className="checklist-item" key={item.id}><input type="checkbox" aria-label={`Выполнено: ${item.text}`} checked={item.completed} onChange={event => update('checklist', draft.checklist.map(entry => entry.id === item.id ? { ...entry, completed: event.target.checked } : entry))} /><input aria-label="Текст пункта" className={item.completed ? 'completed' : ''} maxLength={300} value={item.text} onChange={event => update('checklist', draft.checklist.map(entry => entry.id === item.id ? { ...entry, text: event.target.value } : entry))} onBlur={() => update('checklist', draft.checklist.filter(entry => entry.text.trim()))} /><button type="button" className="icon-button" aria-label={`Удалить пункт ${item.text}`} onClick={() => update('checklist', draft.checklist.filter(entry => entry.id !== item.id))}><X size={16} /></button></div>)}</div><div className="inline-input"><input aria-label="Новый пункт чек-листа" maxLength={300} value={newItem} placeholder="Добавить небольшой шаг" onChange={event => setNewItem(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addItem(); } }} /><button type="button" className="icon-button" aria-label="Добавить пункт" disabled={!newItem.trim()} onClick={addItem}><Plus size={18} /></button></div></section>
        {task && <div className="task-timestamps">Создана {new Date(task.createdAt).toLocaleString('ru-RU')}<br />Изменена {new Date(task.updatedAt).toLocaleString('ru-RU')}</div>}
        {confirmDelete && <div className="delete-confirm" role="alert"><strong>Удалить эту задачу?</strong><p>Восстановить её после удаления не получится.</p><div className="button-row"><button type="button" className="danger-button" onClick={() => { if (task) dispatch({ type: 'task.delete', id: task.id }); onClose(); }}>Да, удалить</button><button type="button" className="secondary-button" onClick={() => setConfirmDelete(false)}>Оставить</button></div></div>}
      </div>
      <footer className="modal-footer">{task && <button type="button" className="icon-button danger-text delete-task" aria-label="Удалить задачу" onClick={() => setConfirmDelete(true)}><Trash2 size={18} /></button>}<button type="button" className="secondary-button" onClick={onClose}>Отмена</button><button type="submit" className="primary-button" disabled={!draft.title.trim()}>{task ? 'Сохранить изменения' : 'Создать задачу'}</button></footer>
    </form>
  </Modal>;
}

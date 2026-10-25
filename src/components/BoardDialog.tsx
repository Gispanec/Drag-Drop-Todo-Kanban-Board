import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { Board } from '../models';
import type { Action } from '../domain/board';
import { Modal } from './Modal';

interface Props { board?: Board; taskCount: number; dispatch: (action: Action) => void; onClose: () => void }

export function BoardDialog({ board, taskCount, dispatch, onClose }: Props) {
  const [name, setName] = useState(board?.name ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  return <Modal title={board ? 'Настройки доски' : 'Новая доска'} subtitle={board ? 'Пусть у каждого проекта будет своё место.' : 'Отдельное место для нового проекта или идеи.'} onClose={onClose} className="board-dialog">
    <form onSubmit={event => {
      event.preventDefault();
      if (!name.trim()) return;
      dispatch(board ? { type: 'board.rename', id: board.id, name } : { type: 'board.create', name });
      onClose();
    }}>
      <label className="field">Название доски<input autoFocus required maxLength={100} value={name} onChange={event => setName(event.target.value)} placeholder="Например, Работа или Личное" /></label>
      {board && <div className="danger-zone">
        {confirmDelete ? <div role="alert"><strong>Удалить «{board.name}»?</strong><p>Все задачи этой доски ({taskCount}) будут удалены. Это действие нельзя отменить.</p><div className="button-row"><button type="button" className="danger-button" onClick={() => { dispatch({ type: 'board.delete', id: board.id }); onClose(); }}>Удалить доску</button><button type="button" className="secondary-button" onClick={() => setConfirmDelete(false)}>Оставить доску</button></div></div>
          : <button type="button" className="text-button danger-text" onClick={() => setConfirmDelete(true)}><Trash2 size={16} />Удалить доску</button>}
      </div>}
      <footer className="modal-footer"><button type="button" className="secondary-button" onClick={onClose}>Отмена</button><button type="submit" className="primary-button" disabled={!name.trim()}>{board ? 'Сохранить' : 'Создать доску'}</button></footer>
    </form>
  </Modal>;
}

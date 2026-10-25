import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';

interface Props { title: string; subtitle?: string; children: ReactNode; onClose: () => void; className?: string }

export function Modal({ title, subtitle, children, onClose, className = '' }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    const previousFocus = document.activeElement;
    dialog.showModal();
    dialog.querySelector<HTMLInputElement>('input')?.focus();
    return () => {
      dialog.close();
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, []);
  return <dialog ref={ref} className={`modal ${className}`} aria-labelledby="modal-title" onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className="modal-heading">
      <div><p className="eyebrow">ВАШЕ ПРОСТРАНСТВО</p><h2 id="modal-title">{title}</h2>{subtitle && <p className="muted">{subtitle}</p>}</div>
      <button type="button" className="icon-button" aria-label="Закрыть окно" onClick={onClose}><X size={20} /></button>
    </div>
    {children}
  </dialog>;
}

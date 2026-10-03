import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** A bottom sheet: details and choices that would crowd the screen. Tap outside to close. */
export function Sheet({ title, children, onClose }: { title?: ReactNode; children: ReactNode; onClose?: () => void }) {
  return createPortal(
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet duel-sheet" role="dialog" onClick={(event) => event.stopPropagation()}>
        {title && <h3 className="sheet-title">{title}</h3>}
        {children}
      </div>
    </div>,
    document.body,
  );
}

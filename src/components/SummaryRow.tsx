import { useState, type ReactNode } from 'react';
import { Sheet } from './Sheet';

const Chevron = () => (
  <svg className="chevron" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
    <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/**
 * One line that stands for something bigger: a label and a few figures, opening a sheet
 * with the rest. Keeps the screen to what's needed now, with everything else one tap away.
 */
export function SummaryRow({ label, figures, title, children, mine }: { label: ReactNode; figures?: ReactNode; title?: ReactNode; children: ReactNode; mine?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className={mine ? 'summary-row mine' : 'summary-row'} onClick={() => setOpen(true)}>
        <span className="summary-label">{label}</span>
        {figures && <span className="summary-figures">{figures}</span>}
        <Chevron />
      </button>
      {open && (
        <Sheet title={title ?? label} onClose={() => setOpen(false)}>
          {children}
          <button className="button" onClick={() => setOpen(false)}>
            Close
          </button>
        </Sheet>
      )}
    </>
  );
}

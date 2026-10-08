import type { ReactNode } from 'react';
import { Link } from 'react-router';

/** A plain page: a way back (none on a tab page, where the tabs are the way round), a title, and its content. */
export function Page({ title, back = '/', children }: { title: string; back?: string | null; children: ReactNode }) {
  return (
    <main className="screen">
      <header className="bar">
        {back === null ? (
          <span className="icon-button" aria-hidden="true" />
        ) : (
          <Link className="icon-button" to={back} aria-label="Back">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        )}
        <h1 className="bar-title">{title}</h1>
        <span className="icon-button" aria-hidden="true" />
      </header>
      {children}
    </main>
  );
}

export function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button className="row" role="switch" aria-checked={on} onClick={() => onChange(!on)}>
      <span>{label}</span>
      <span className={on ? 'switch on' : 'switch'} aria-hidden="true">
        <span />
      </span>
    </button>
  );
}

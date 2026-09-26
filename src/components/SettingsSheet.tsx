import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useNonogramStore } from '../nonogramStore';
import { reloadFresh } from '../reload';

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button className="setting-row" role="switch" aria-checked={on} onClick={() => onChange(!on)}>
      <span>{label}</span>
      <span className={on ? 'switch on' : 'switch'} aria-hidden="true">
        <span />
      </span>
    </button>
  );
}

/** A gear button that opens the settings and any extra actions the screen passes in. */
export function SettingsButton({ children }: { children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const haptics = useNonogramStore((s) => s.haptics);
  const setHaptics = useNonogramStore((s) => s.setHaptics);
  const canVibrate = typeof navigator !== 'undefined' && 'vibrate' in navigator;
  return (
    <>
      <button className="icon-button" aria-label="Settings" onClick={() => setOpen(true)}>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path
            d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 13a7.6 7.6 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.4 7.4 0 0 0-1.7-1L15 3.5h-4l-.4 2.5a7.4 7.4 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7.6 7.6 0 0 0 0 2l-2 1.6 2 3.4 2.4-1c.5.4 1.1.8 1.7 1l.4 2.5h4l.4-2.5c.6-.2 1.2-.6 1.7-1l2.4 1 2-3.4z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {/* On body, so the sheet covers the tab bar instead of sitting in the screen's stacking context. */}
      {open &&
        createPortal(
          <div className="sheet-backdrop" onClick={() => setOpen(false)}>
            <div className="sheet settings" role="dialog" aria-label="Settings" onClick={(event) => event.stopPropagation()}>
              <p className="micro">Settings</p>
              {canVibrate && (
                <div className="setting-list">
                  <Toggle label="Vibrate when solved" on={haptics} onChange={setHaptics} />
                </div>
              )}
              <div className="setting-actions" onClick={() => setOpen(false)}>
                {children}
                <button className="button ghost" onClick={() => void reloadFresh()}>
                  Reload the latest version
                </button>
              </div>
              <button className="button" onClick={() => setOpen(false)}>
                Done
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

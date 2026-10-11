import type { ReactNode } from 'react';
import { PlayerBar } from './PlayerBar';

/** The frame around Home and the profile: who you are along the top, the page below. */
export function WorldShell({ children }: { children: ReactNode }) {
  return (
    <div className="world">
      <PlayerBar />
      <div className="world-body">{children}</div>
    </div>
  );
}

import type { ReactNode } from 'react';
import { PlayerBar } from './PlayerBar';
import { TabBar } from './TabBar';

/** The frame around the four tab pages: who you are along the top, the tabs along the bottom. */
export function WorldShell({ children }: { children: ReactNode }) {
  return (
    <div className="world">
      <PlayerBar />
      <div className="world-body">{children}</div>
      <TabBar />
    </div>
  );
}

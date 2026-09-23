import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { useRunStore } from './runStore';
import './index.css';

// The service worker serves the build it cached, so a deploy would otherwise show the
// previous version once. Reload as soon as a new one is ready, but never mid-fight.
const updateSW = registerSW({
  onNeedRefresh() {
    const idle = () => useRunStore.getState().battle === null && location.pathname !== '/run';
    if (idle()) return void updateSW(true);
    const timer = setInterval(() => {
      if (!idle()) return;
      clearInterval(timer);
      void updateSW(true);
    }, 2000);
  },
});

// No <StrictMode>: its dev-only double mount creates and destroys each Phaser game back to back,
// which can leave a stray canvas behind.
createRoot(document.getElementById('root')!).render(<App />);

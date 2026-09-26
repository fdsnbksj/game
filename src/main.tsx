import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App, PLAY_PATHS } from './App';
import './index.css';

// The service worker serves the build it cached, so a deploy would otherwise show the
// previous version once. Swap in a new one as soon as it's ready, but not under a thumb
// mid-puzzle: wait until the player is off the grid or the app is in the background.
// (Nothing would be lost either way; every tap is already saved.)
const updateSW = registerSW({
  onNeedRefresh() {
    const idle = () => !PLAY_PATHS.includes(location.pathname) || document.visibilityState === 'hidden';
    if (idle()) return void updateSW(true);
    const timer = setInterval(() => {
      if (!idle()) return;
      clearInterval(timer);
      void updateSW(true);
    }, 2000);
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

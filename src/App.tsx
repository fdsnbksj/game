import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router';
import { Backdrop } from './components/Backdrop';
import { TabBar } from './components/TabBar';
import { Wordmark } from './components/Wordmark';
import { Home } from './screens/Home';
import { HowToPlay } from './screens/HowToPlay';
import { Profile } from './screens/Profile';
import { Rankings } from './screens/Rankings';
import { Run } from './screens/Run';
import { sfx, unlockAudio } from './game/audio';
import { startSession } from './services/auth';
import { useGameStore } from './store';

/**
 * An installed copy of an older version can fail against the current rules, and the
 * offline cache keeps serving it. Throw the cache away and start over.
 */
async function reloadFresh() {
  try {
    const registrations = (await navigator.serviceWorker?.getRegistrations()) ?? [];
    await Promise.all(registrations.map((registration) => registration.unregister()));
    if (typeof caches !== 'undefined') {
      const names = await caches.keys();
      await Promise.all(names.map((name) => caches.delete(name)));
    }
  } catch {
    // Reloading is still worth a try.
  }
  location.reload();
}

export function App() {
  const ready = useGameStore((s) => s.player !== null);
  const [error, setError] = useState<string | null>(null);

  // Audio can only start inside a gesture, so every tap is a chance to unlock it.
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      unlockAudio();
      if (event.target instanceof Element && event.target.closest('.button:not(:disabled), .item:not(:disabled)')) sfx.tick();
    };
    document.addEventListener('pointerdown', onPointerDown, { capture: true });
    return () => document.removeEventListener('pointerdown', onPointerDown, { capture: true });
  }, []);

  useEffect(
    () =>
      startSession((cause) => {
        console.error(cause);
        setError('Could not connect. Check your connection and reload.');
      }),
    [],
  );

  if (error) {
    return (
      <>
        <Backdrop />
        <main className="screen center">
          <div className="glass splash-card">
            <Wordmark />
            <p className="error">{error}</p>
            <button className="button primary" onClick={() => void reloadFresh()}>
              Reload
            </button>
          </div>
        </main>
      </>
    );
  }

  if (!ready) {
    return (
      <>
        <Backdrop />
        <main className="screen center" aria-busy="true">
          <div className="glass splash-card">
            <Wordmark />
            <div className="spinner large" aria-label="Loading" />
          </div>
        </main>
      </>
    );
  }

  return (
    <BrowserRouter>
      <Backdrop />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/run" element={<Run />} />
        <Route path="/how" element={<HowToPlay />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/ranks" element={<Rankings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Navigation />
    </BrowserRouter>
  );
}

/** The tab bar, everywhere but the battle, which needs the whole screen. */
function Navigation() {
  const { pathname } = useLocation();
  return pathname === '/run' ? null : <TabBar />;
}

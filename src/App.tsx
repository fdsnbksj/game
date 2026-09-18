import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { Wordmark } from './components/Wordmark';
import { Customize } from './screens/Customize';
import { Home } from './screens/Home';
import { Leaderboard } from './screens/Leaderboard';
import { Play } from './screens/Play';
import { Profile } from './screens/Profile';
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
  const ready = useGameStore((s) => s.profile !== null);
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
      <main className="screen center">
        <Wordmark />
        <p className="error">{error}</p>
        <button className="button primary" onClick={() => void reloadFresh()}>
          Reload
        </button>
      </main>
    );
  }

  if (!ready) {
    return (
      <main className="screen center" aria-busy="true">
        <div className="brand-splash">
          <Wordmark />
          <div className="spinner large" aria-label="Loading" />
        </div>
      </main>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/play" element={<Play />} />
        <Route path="/customize" element={<Customize />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

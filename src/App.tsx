import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { Customize } from './screens/Customize';
import { Home } from './screens/Home';
import { Leaderboard } from './screens/Leaderboard';
import { Play } from './screens/Play';
import { startSession } from './services/auth';
import { useGameStore } from './store';

export function App() {
  const ready = useGameStore((s) => s.profile !== null);
  const [error, setError] = useState<string | null>(null);

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
        <p className="error">{error}</p>
      </main>
    );
  }

  if (!ready) {
    return (
      <main className="screen center">
        <p className="muted">Loading…</p>
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

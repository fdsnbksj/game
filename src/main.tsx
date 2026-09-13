import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';

// No <StrictMode>: its dev-only double mount creates and destroys each Phaser game back to back,
// which can leave a stray canvas behind.
createRoot(document.getElementById('root')!).render(<App />);

import { useSyncExternalStore } from 'react';
import { getAudioPrefs, setAudioPrefs, subscribeAudioPrefs } from '../game/audio';

/** Sound effects and music on/off. Saved on this device. */
export function SoundToggle() {
  const prefs = useSyncExternalStore(subscribeAudioPrefs, getAudioPrefs);
  return (
    <div className="sound-toggle">
      <button
        className="button small icon"
        aria-label="Sound effects"
        aria-pressed={prefs.sound}
        onClick={() => setAudioPrefs({ sound: !prefs.sound })}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
          {prefs.sound ? (
            <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          ) : (
            <path d="M16 9l6 6M22 9l-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          )}
        </svg>
      </button>
      <button
        className="button small icon"
        aria-label="Music"
        aria-pressed={prefs.music}
        onClick={() => setAudioPrefs({ music: !prefs.music })}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path d="M9 18V6l11-2v12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="6.5" cy="18" r="2.5" fill="currentColor" />
          <circle cx="17.5" cy="16" r="2.5" fill="currentColor" />
          {!prefs.music && <path d="M3 3l18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}
        </svg>
      </button>
    </div>
  );
}

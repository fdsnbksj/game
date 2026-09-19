// Every sound in the game, synthesized with Web Audio: no files to download or cache.
// Browsers only start audio from a user gesture, so nothing plays until unlockAudio()
// has run inside one (App wires it to every pointerdown).

export interface AudioPrefs {
  sound: boolean;
  /** Off by default: music that starts on its own is the fastest way to get muted. */
  music: boolean;
}

// Named for the game's old title; kept so players' sound settings carry over.
const PREFS_KEY = 'neon-flap:audio';
const DEFAULT_PREFS: AudioPrefs = { sound: true, music: false };

const MUSIC_VOLUME = 0.32;

// ---------- Preferences ----------

function loadPrefs(): AudioPrefs {
  try {
    const saved = localStorage.getItem(PREFS_KEY);
    if (saved) return { ...DEFAULT_PREFS, ...(JSON.parse(saved) as Partial<AudioPrefs>) };
  } catch {
    // Private mode or blocked storage: fall back to the defaults.
  }
  return DEFAULT_PREFS;
}

let prefs = loadPrefs();
const prefListeners = new Set<() => void>();

export function getAudioPrefs(): AudioPrefs {
  return prefs;
}

/** For useSyncExternalStore. */
export function subscribeAudioPrefs(listener: () => void) {
  prefListeners.add(listener);
  return () => {
    prefListeners.delete(listener);
  };
}

export function setAudioPrefs(change: Partial<AudioPrefs>) {
  prefs = { ...prefs, ...change };
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Still applies for this visit.
  }
  prefListeners.forEach((listener) => listener());
  applyVolumes();
  updateMusic();
}

// ---------- Audio graph ----------

let ctx: AudioContext | null = null;
let sfxBus: GainNode;
let musicBus: GainNode;
let noise: AudioBuffer;

/** Call from a user gesture. Safe to call on every one. */
export function unlockAudio() {
  if (!ctx) {
    const Context = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return;
    // iOS: mix with the player's own music instead of stopping it, and respect the silent switch.
    const session = (navigator as { audioSession?: { type: string } }).audioSession;
    if (session) session.type = 'ambient';

    ctx = new Context();
    sfxBus = ctx.createGain();
    sfxBus.connect(ctx.destination);
    const musicFilter = ctx.createBiquadFilter();
    musicFilter.type = 'lowpass';
    musicFilter.frequency.value = 2600;
    musicBus = ctx.createGain();
    musicBus.connect(musicFilter).connect(ctx.destination);
    applyVolumes();

    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const samples = noise.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) void ctx?.suspend();
      else void ctx?.resume();
    });
  }
  if (ctx.state === 'suspended' && !document.hidden) void ctx.resume();
  updateMusic();
}

function applyVolumes() {
  if (!ctx) return;
  sfxBus.gain.value = prefs.sound ? 1 : 0;
  musicBus.gain.value = prefs.music ? MUSIC_VOLUME : 0;
}

function ready(): AudioContext | null {
  return ctx && ctx.state === 'running' ? ctx : null;
}

const midi = (note: number) => 440 * 2 ** ((note - 69) / 12);

/** One oscillator note with a click-free attack and an exponential tail. */
function tone(
  bus: AudioNode,
  type: OscillatorType,
  from: number,
  to: number,
  start: number,
  duration: number,
  peak: number,
) {
  const audio = ctx!;
  const osc = audio.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(from, start);
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, start + duration);
  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(bus);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

/** A burst of filtered noise: swishes, hats and crashes. */
function hiss(bus: AudioNode, filter: BiquadFilterType, frequency: number, start: number, duration: number, peak: number) {
  const audio = ctx!;
  const source = audio.createBufferSource();
  source.buffer = noise;
  const shape = audio.createBiquadFilter();
  shape.type = filter;
  shape.frequency.value = frequency;
  const gain = audio.createGain();
  gain.gain.setValueAtTime(peak, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(shape).connect(gain).connect(bus);
  source.start(start, Math.random() * 0.5);
  source.stop(start + duration + 0.02);
}

// ---------- Sound effects ----------

function play(effect: (now: number) => void) {
  const audio = ready();
  if (audio && prefs.sound) effect(audio.currentTime);
}

export const sfx = {
  /** Victories and big moments. */
  reward: () =>
    play((t) => {
      [72, 76, 79, 84].forEach((note, i) => tone(sfxBus, 'triangle', midi(note), midi(note), t + i * 0.075, 0.28, 0.12));
      tone(sfxBus, 'sine', midi(96), midi(96), t + 0.3, 0.5, 0.05);
    }),
  tick: () => play((t) => tone(sfxBus, 'sine', 1500, 1200, t, 0.035, 0.05)),
  buy: () =>
    play((t) => {
      tone(sfxBus, 'triangle', 660, 990, t, 0.09, 0.1);
      tone(sfxBus, 'sine', 1320, 1320, t + 0.06, 0.1, 0.05);
    }),
  sell: () =>
    play((t) => {
      tone(sfxBus, 'square', 1760, 1760, t, 0.05, 0.04);
      tone(sfxBus, 'square', 2350, 2350, t + 0.05, 0.08, 0.04);
    }),
  combine: () =>
    play((t) => {
      [67, 71, 74, 79].forEach((note, i) => tone(sfxBus, 'square', midi(note), midi(note), t + i * 0.05, 0.14, 0.05));
      hiss(sfxBus, 'highpass', 5000, t + 0.2, 0.25, 0.06);
    }),
  levelUp: () => play((t) => [60, 64, 67, 72].forEach((note, i) => tone(sfxBus, 'triangle', midi(note), midi(note), t + i * 0.06, 0.2, 0.1))),
  hit: () => play((t) => hiss(sfxBus, 'bandpass', 900 + Math.random() * 600, t, 0.05, 0.08)),
  cast: () =>
    play((t) => {
      tone(sfxBus, 'sawtooth', 300, 1200, t, 0.18, 0.05);
      hiss(sfxBus, 'bandpass', 3000, t, 0.2, 0.06);
    }),
  faint: () => play((t) => tone(sfxBus, 'triangle', 420, 120, t, 0.22, 0.08)),
  defeat: () => play((t) => [64, 60, 55].forEach((note, i) => tone(sfxBus, 'triangle', midi(note), midi(note), t + i * 0.12, 0.3, 0.1))),
};

// ---------- Haptics ----------

/** Android only; iOS Safari has no vibration API. */
export function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Some browsers throw instead of ignoring it.
  }
}

// ---------- Music ----------

const BPM = 112;
const SIXTEENTH = 60 / BPM / 4;
/** Am, F, C, G as MIDI triads, one bar each. */
const CHORDS = [
  [57, 60, 64],
  [53, 57, 60],
  [48, 52, 55],
  [55, 59, 62],
];
const ARPEGGIO = [0, 1, 2, 1];

let wantMusic = false;
/** 0 bass only, 1 adds the arpeggio, 2 hats, 3 kick. */
let level = 0;
let timer: ReturnType<typeof setInterval> | undefined;
let nextStepAt = 0;
let step = 0;

function scheduleStep(index: number, t: number) {
  const chord = CHORDS[Math.floor(index / 16) % CHORDS.length];
  const beat = index % 16;
  if (beat === 0) tone(musicBus, 'triangle', midi(chord[0] - 12), midi(chord[0] - 12), t, SIXTEENTH * 7, 0.3);
  if (beat === 8) tone(musicBus, 'triangle', midi(chord[0] - 12), midi(chord[0] - 12), t, SIXTEENTH * 6, 0.22);
  if (level >= 1) {
    const note = chord[ARPEGGIO[beat % 4]] + 12 + (beat >= 8 ? 12 : 0);
    tone(musicBus, 'square', midi(note), midi(note), t, SIXTEENTH * 0.9, 0.05);
  }
  if (level >= 2 && beat % 4 === 2) hiss(musicBus, 'highpass', 7000, t, 0.05, 0.12);
  if (level >= 3 && beat % 8 === 0) tone(musicBus, 'sine', 150, 45, t, 0.18, 0.5);
}

function tick() {
  const audio = ready();
  if (!audio) return;
  // After a stall (a background tab), start fresh rather than playing the backlog at once.
  if (nextStepAt < audio.currentTime) nextStepAt = audio.currentTime + 0.05;
  while (nextStepAt < audio.currentTime + 0.12) {
    scheduleStep(step, nextStepAt);
    nextStepAt += SIXTEENTH;
    step += 1;
  }
}

function updateMusic() {
  const shouldPlay = ctx !== null && wantMusic && prefs.music;
  if (shouldPlay && timer === undefined) {
    step = 0;
    nextStepAt = 0;
    timer = setInterval(tick, 25);
  } else if (!shouldPlay && timer !== undefined) {
    clearInterval(timer);
    timer = undefined;
  }
}

/** The Play screen holds the music; it only sounds if the player turned it on. */
export function startMusic() {
  wantMusic = true;
  updateMusic();
}

export function stopMusic() {
  wantMusic = false;
  level = 0;
  updateMusic();
}

export function setMusicLevel(next: number) {
  level = next;
}

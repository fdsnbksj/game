// Every sound effect in the game, synthesized with Web Audio, and the soundtrack: a file
// or a tune from songs.ts, played the same way.
// Browsers only start audio from a user gesture, so nothing plays until unlockAudio()
// has run inside one (App wires it to every pointerdown).

import { renderSong, SONGS, type Song } from './songs';

export interface AudioPrefs {
  sound: boolean;
  /** Off by default: music that starts on its own is the fastest way to get muted. */
  music: boolean;
}

// Named for the game's old title; kept so players' sound settings carry over.
// A historical name, kept so players don't lose the preference they already set.
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
//
// Everything runs through one gentle compressor, so stacked hits glue together, then a
// limiter, so they never clip. Effects have a dry path and a send into a short reverb; the
// soundtrack goes straight in. Each sits behind the player's on/off gain, so muting silences
// the tails too.

interface Bus {
  dry: AudioNode;
  wet: AudioNode;
}

let ctx: AudioContext | null = null;
let sfxGain: GainNode;
let musicGain: GainNode;
let sfxBus: Bus;
let noise: AudioBuffer;

/** A small room: 1.6 s of stereo noise, fading out and darkening as it goes. */
function makeImpulse(audio: AudioContext): AudioBuffer {
  const length = Math.floor(audio.sampleRate * 1.6);
  const impulse = audio.createBuffer(2, length, audio.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    let smooth = 0;
    for (let i = 0; i < length; i++) {
      const progress = i / length;
      // A one-pole lowpass that closes over the tail, so the reverb isn't hissy.
      const damping = 0.35 + progress * 0.55;
      smooth = smooth * damping + (Math.random() * 2 - 1) * (1 - damping);
      data[i] = smooth * (1 - progress) ** 2.5;
    }
  }
  return impulse;
}

function makeBus(audio: AudioContext, output: GainNode, impulse: AudioBuffer): Bus {
  const dry = audio.createGain();
  dry.connect(output);
  const wet = audio.createGain();
  const reverb = audio.createConvolver();
  reverb.buffer = impulse;
  wet.connect(reverb).connect(output);
  return { dry, wet };
}

/** Call from a user gesture. Safe to call on every one. */
export function unlockAudio() {
  if (!ctx) {
    const Context = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return;
    // iOS: mix with the player's own music instead of stopping it, and respect the silent switch.
    const session = (navigator as { audioSession?: { type: string } }).audioSession;
    if (session) session.type = 'ambient';

    ctx = new Context();
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 12;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;
    const master = ctx.createGain();
    // Voices are mixed quietly and the compressor holds the peaks; this brings it up to level.
    master.gain.value = 1.7;
    // A fast, hard limiter last, for the rare pile-up (several creatures falling at once).
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.1;
    compressor.connect(master).connect(limiter).connect(ctx.destination);

    sfxGain = ctx.createGain();
    sfxGain.connect(compressor);
    musicGain = ctx.createGain();
    musicGain.connect(compressor);
    applyVolumes();

    const impulse = makeImpulse(ctx);
    sfxBus = makeBus(ctx, sfxGain, impulse);

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
  sfxGain.gain.value = prefs.sound ? 1 : 0;
  musicGain.gain.value = prefs.music ? MUSIC_VOLUME : 0;
}

function ready(): AudioContext | null {
  return ctx && ctx.state === 'running' ? ctx : null;
}

const midi = (note: number) => 440 * 2 ** ((note - 69) / 12);

/** A little randomness, so the fiftieth hit doesn't sound like the first forty-nine. */
const vary = (value: number, amount: number) => value * (1 + (Math.random() * 2 - 1) * amount);

// ---------- Voices ----------

interface Mix {
  /** Peak gain of the dry signal. */
  level: number;
  /** How much of it goes to the reverb, relative to the dry level. */
  wet?: number;
  /** -1 (left) to 1 (right). */
  pan?: number;
}

/** Where a voice plugs in: a gain for its envelope, then pan, then the dry and wet sends. */
function output(bus: Bus, { level, wet = 0, pan = 0 }: Mix): GainNode {
  const audio = ctx!;
  const envelope = audio.createGain();
  envelope.gain.value = 0;
  let node: AudioNode = envelope;
  if (pan !== 0 && audio.createStereoPanner) {
    const panner = audio.createStereoPanner();
    panner.pan.value = pan;
    node = node.connect(panner);
  }
  const dry = audio.createGain();
  dry.gain.value = level;
  node.connect(dry).connect(bus.dry);
  if (wet > 0) {
    const send = audio.createGain();
    send.gain.value = level * wet;
    node.connect(send).connect(bus.wet);
  }
  return envelope;
}

/** A click-free rise to 1, then an exponential fall to silence. */
function shape(gain: AudioParam, start: number, attack: number, duration: number) {
  gain.setValueAtTime(0.0001, start);
  gain.exponentialRampToValueAtTime(1, start + attack);
  gain.exponentialRampToValueAtTime(0.0001, start + Math.max(duration, attack + 0.01));
}

/** A soft plucked string: a triangle through a lowpass that closes quickly. */
function pluck(bus: Bus, frequency: number, start: number, mix: Mix, duration = 0.28, brightness = 4000) {
  const audio = ctx!;
  const out = output(bus, mix);
  const osc = audio.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = frequency;
  const filter = audio.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = 0.7;
  filter.frequency.setValueAtTime(brightness, start);
  filter.frequency.exponentialRampToValueAtTime(Math.max(frequency * 1.2, 200), start + duration * 0.6);
  osc.connect(filter).connect(out);
  shape(out.gain, start, 0.003, duration);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

/** A bell or coin: two-operator FM whose shimmer fades faster than its body. */
function bell(bus: Bus, frequency: number, start: number, mix: Mix, duration = 0.8, ratio = 3.5, index = 1.6) {
  const audio = ctx!;
  const out = output(bus, mix);
  const carrier = audio.createOscillator();
  carrier.type = 'sine';
  carrier.frequency.value = frequency;
  const modulator = audio.createOscillator();
  modulator.type = 'sine';
  modulator.frequency.value = frequency * ratio;
  const depth = audio.createGain();
  depth.gain.setValueAtTime(frequency * index, start);
  depth.gain.exponentialRampToValueAtTime(frequency * 0.01, start + duration * 0.5);
  modulator.connect(depth).connect(carrier.frequency);
  carrier.connect(out);
  shape(out.gain, start, 0.002, duration);
  carrier.start(start);
  modulator.start(start);
  carrier.stop(start + duration + 0.05);
  modulator.stop(start + duration + 0.05);
}

/**
 * Weight: a sine that drops in pitch, like a soft drum. Phone speakers barely play
 * anything under 200 Hz, so a short knock three times higher carries it on a phone.
 */
function thump(bus: Bus, start: number, mix: Mix, from = 160, to = 50, duration = 0.14) {
  const audio = ctx!;
  const out = output(bus, mix);
  const osc = audio.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(from, start);
  osc.frequency.exponentialRampToValueAtTime(to, start + duration * 0.7);
  osc.connect(out);
  shape(out.gain, start, 0.002, duration);
  osc.start(start);
  osc.stop(start + duration + 0.05);

  const knock = output(bus, { ...mix, level: mix.level * 0.45 });
  const upper = audio.createOscillator();
  upper.type = 'triangle';
  upper.frequency.setValueAtTime(from * 3, start);
  upper.frequency.exponentialRampToValueAtTime(to * 3, start + 0.04);
  upper.connect(knock);
  shape(knock.gain, start, 0.001, Math.min(0.05, duration));
  upper.start(start);
  upper.stop(start + 0.1);
}

/** Air: filtered noise whose band sweeps, for whooshes, swipes and transients. */
function whoosh(bus: Bus, start: number, mix: Mix, from: number, to: number, duration: number, attack = 0.01, q = 1) {
  const audio = ctx!;
  const out = output(bus, mix);
  const source = audio.createBufferSource();
  source.buffer = noise;
  const filter = audio.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = q;
  filter.frequency.setValueAtTime(from, start);
  filter.frequency.exponentialRampToValueAtTime(to, start + duration);
  source.connect(filter).connect(out);
  shape(out.gain, start, attack, duration);
  source.start(start, Math.random() * 0.5);
  source.stop(start + duration + 0.05);
}

/** Warmth: detuned triangles under a lowpass, swelling in and dying away slowly. */
function pad(bus: Bus, notes: number[], start: number, mix: Mix, duration = 1.2, attack = 0.08, cutoff = 1800) {
  const audio = ctx!;
  const out = output(bus, mix);
  const filter = audio.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = cutoff;
  filter.connect(out);
  const voices = notes.length * 2;
  for (const note of notes) {
    for (const cents of [-7, 7]) {
      const osc = audio.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = midi(note);
      osc.detune.value = cents;
      const level = audio.createGain();
      level.gain.value = 1 / voices;
      osc.connect(level).connect(filter);
      osc.start(start);
      osc.stop(start + duration + 0.1);
    }
  }
  out.gain.setValueAtTime(0.0001, start);
  out.gain.exponentialRampToValueAtTime(1, start + attack);
  out.gain.setValueAtTime(1, start + attack + 0.02);
  out.gain.exponentialRampToValueAtTime(0.0001, start + duration);
}

// ---------- Sound effects ----------
//
// All in C major pentatonic (A minor for losing), so sounds that overlap stay in tune
// with each other. Combat sits about 6 dB under the interface and the big moments.

const COMBAT = 0.5;
const side = () => (Math.random() * 2 - 1) * 0.35;

function play(effect: (now: number) => void) {
  const audio = ready();
  if (audio && prefs.sound) effect(audio.currentTime + 0.005);
}

/** Rotates the hit transient's colour so rapid hits don't blur into one tone. */
let hitVariant = 0;
const HIT_BANDS = [1200, 1800, 2600];

export const sfx = {
  /** Every button: a small glassy tap. */
  tick: () =>
    play((t) => {
      pluck(sfxBus, vary(midi(96), 0.01), t, { level: 0.08, wet: 0.08 }, 0.07, 7000);
    }),
  /** Coins in: two bright bells and a glint. */
  buy: () =>
    play((t) => {
      bell(sfxBus, vary(midi(88), 0.005), t, { level: 0.1, wet: 0.2, pan: -0.1 }, 0.5, 3.5, 1.4);
      bell(sfxBus, vary(midi(91), 0.005), t + 0.07, { level: 0.09, wet: 0.2, pan: 0.1 }, 0.6, 3.5, 1.4);
      bell(sfxBus, midi(108), t + 0.1, { level: 0.02, wet: 0.4 }, 0.3, 2, 0.8);
    }),
  /** Coins out: a quick spill of small coins. */
  sell: () =>
    play((t) => {
      [100, 96, 93, 96].forEach((note, i) =>
        bell(sfxBus, vary(midi(note), 0.01), t + i * 0.05, { level: 0.065 - i * 0.01, wet: 0.2, pan: side() }, 0.35, 5.1, 1.2),
      );
      whoosh(sfxBus, t, { level: 0.03 }, 6000, 4000, 0.06, 0.003, 2);
    }),
  /** A fresh hand: a card swipe that lands on a soft note. */
  reroll: () =>
    play((t) => {
      whoosh(sfxBus, t, { level: 0.14, wet: 0.1 }, 700, 3200, 0.2, 0.05, 0.8);
      pluck(sfxBus, midi(79), t + 0.13, { level: 0.06, wet: 0.2 }, 0.3);
    }),
  /** Experience bought, not yet a level. */
  xp: () =>
    play((t) => {
      pluck(sfxBus, midi(72), t, { level: 0.06, wet: 0.15 }, 0.2);
      pluck(sfxBus, midi(79), t + 0.06, { level: 0.06, wet: 0.15 }, 0.3);
    }),
  levelUp: () =>
    play((t) => {
      pad(sfxBus, [60, 64, 67, 72], t, { level: 0.07, wet: 0.35 }, 1.3, 0.06, 2400);
      [84, 88, 91, 96].forEach((note, i) => bell(sfxBus, midi(note), t + i * 0.06, { level: 0.06, wet: 0.3, pan: (i - 1.5) * 0.15 }, 0.7));
    }),
  /** A creature or item lifted. */
  pickUp: () =>
    play((t) => {
      pluck(sfxBus, vary(midi(84), 0.01), t, { level: 0.07, wet: 0.05 }, 0.08, 3000);
      whoosh(sfxBus, t, { level: 0.05 }, 1500, 3200, 0.07, 0.02, 1.5);
    }),
  /** Set down on a hex or bench slot. */
  drop: () =>
    play((t) => {
      thump(sfxBus, t, { level: 0.2 }, vary(140, 0.04), 70, 0.1);
      whoosh(sfxBus, t, { level: 0.03 }, 2000, 1400, 0.03, 0.002, 2);
    }),
  /** An item clicks onto a creature: small, metallic, bright. */
  equip: () =>
    play((t) => {
      bell(sfxBus, midi(100), t, { level: 0.07, wet: 0.25 }, 0.45, 7.1, 2.4);
      bell(sfxBus, midi(107), t + 0.03, { level: 0.035, wet: 0.3 }, 0.35, 7.1, 2);
      whoosh(sfxBus, t, { level: 0.05 }, 5000, 5000, 0.025, 0.001, 3);
      thump(sfxBus, t, { level: 0.08 }, 220, 110, 0.06);
    }),
  /** Three copies became a star: a rising shimmer. */
  combine: () =>
    play((t) => {
      [84, 88, 91, 96, 100].forEach((note, i) => bell(sfxBus, midi(note), t + i * 0.055, { level: 0.06, wet: 0.4, pan: (i - 2) * 0.12 }, 0.8, 3.5, 1.2));
      pad(sfxBus, [72, 76, 79], t, { level: 0.04, wet: 0.4 }, 1, 0.1, 3000);
      whoosh(sfxBus, t + 0.2, { level: 0.035, wet: 0.6 }, 4000, 9000, 0.5, 0.15, 1.5);
    }),
  /** The board opens up: a swell of air and one deep beat. */
  fightStart: () =>
    play((t) => {
      whoosh(sfxBus, t, { level: 0.1, wet: 0.3 }, 200, 1400, 0.45, 0.3, 0.9);
      pad(sfxBus, [36, 43], t, { level: 0.06, wet: 0.2 }, 1, 0.25, 500);
      thump(sfxBus, t + 0.38, { level: 0.16, wet: 0.15 }, 110, 38, 0.4);
    }),
  /** A blow landing; ability hits are heavier and brighter. */
  hit: (heavy = false) =>
    play((t) => {
      const band = HIT_BANDS[hitVariant++ % HIT_BANDS.length];
      thump(sfxBus, t, { level: (heavy ? 0.3 : 0.2) * COMBAT, pan: side() }, vary(heavy ? 130 : 170, 0.06), 55, heavy ? 0.14 : 0.09);
      whoosh(sfxBus, t, { level: (heavy ? 0.16 : 0.1) * COMBAT, wet: heavy ? 0.2 : 0.05, pan: side() }, vary(band, 0.05), band * 0.6, heavy ? 0.09 : 0.045, 0.002, 1.4);
      if (heavy) bell(sfxBus, midi(91), t, { level: 0.05 * COMBAT, wet: 0.3 }, 0.3, 1.4, 3);
    }),
  /** An ability: air rushing up into a bright note. */
  cast: () =>
    play((t) => {
      whoosh(sfxBus, t, { level: 0.14 * COMBAT, wet: 0.3, pan: side() }, 500, 4000, 0.3, 0.12, 1.2);
      bell(sfxBus, midi(96), t + 0.16, { level: 0.08 * COMBAT, wet: 0.5 }, 0.6, 3.5, 1);
    }),
  /** A creature falls: a soft puff and a sinking note. */
  faint: () =>
    play((t) => {
      whoosh(sfxBus, t, { level: 0.14 * COMBAT, wet: 0.2, pan: side() }, 2500, 300, 0.3, 0.01, 0.9);
      thump(sfxBus, t, { level: 0.24 * COMBAT }, 220, 60, 0.26);
    }),
  /** A won round: bells ringing over a warm chord. */
  reward: () =>
    play((t) => {
      pad(sfxBus, [60, 64, 67, 72, 76], t, { level: 0.06, wet: 0.45 }, 1.9, 0.08, 2600);
      [84, 88, 91, 96].forEach((note, i) => bell(sfxBus, midi(note), t + i * 0.08, { level: 0.07, wet: 0.35, pan: (i - 1.5) * 0.15 }, 1));
      bell(sfxBus, midi(103), t + 0.4, { level: 0.03, wet: 0.6 }, 1.2, 2, 0.8);
    }),
  /** A lost round: a soft minor chord sinking, never harsh. */
  defeat: () =>
    play((t) => {
      pad(sfxBus, [57, 60, 64], t, { level: 0.06, wet: 0.35 }, 1, 0.05, 1400);
      pad(sfxBus, [50, 53, 57], t + 0.45, { level: 0.055, wet: 0.4 }, 1.4, 0.08, 1100);
      thump(sfxBus, t, { level: 0.12 }, 90, 45, 0.3);
    }),
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

/**
 * The soundtracks: files in public/audio, and the tunes in songs.ts, which are played into
 * a buffer here. Each run picks one at random (never the last one twice running); each is
 * loaded the first time it's picked, then kept. Add a file or a song here to add it.
 */
type Track = { url: string } | { song: Song };
const TRACKS: readonly Track[] = [{ url: '/audio/bgm.mp3' }, ...SONGS.map((song) => ({ song }))];
/** Held back while planning, so the fight's arrival is felt. */
const PLANNING_LEVEL = 0.55;
/** How much the low end is lifted once a fight starts, in dB. */
const FIGHT_BASS_DB = 7;

let wantMusic = false;
/** 0 while planning; above 0 once a fight is on. */
let level = 0;
/** Chosen when the first run starts, so any track can be first. */
let current: Track = TRACKS[Math.floor(Math.random() * TRACKS.length)];
let picked = false;
const tracks = new Map<Track, AudioBuffer>();
const loading = new Set<Track>();
let source: AudioBufferSourceNode | null = null;
let trackGain: GainNode | null = null;
let bass: BiquadFilterNode | null = null;

function loadTrack(audio: AudioContext, track: Track) {
  if (loading.has(track)) return;
  loading.add(track);
  const buffer =
    'song' in track
      ? renderSong(track.song)
      : fetch(track.url)
          .then((response) => response.arrayBuffer())
          .then((data) => audio.decodeAudioData(data));
  buffer
    .then((loaded) => {
      tracks.set(track, loaded);
      updateMusic();
    })
    .catch(() => {
      // No soundtrack is better than a broken game; try again next time it's wanted.
    })
    .finally(() => loading.delete(track));
}

/** A different track from the one just played, when there's more than one. */
function pickTrack() {
  if (!picked) {
    picked = true;
    return;
  }
  const others = TRACKS.filter((track) => track !== current);
  current = others.length > 0 ? others[Math.floor(Math.random() * others.length)] : current;
}

/** Planning or fighting: the volume and the bass glide over half a second. */
function applyLevel() {
  if (!ctx || !trackGain || !bass) return;
  const now = ctx.currentTime;
  trackGain.gain.cancelScheduledValues(now);
  trackGain.gain.setTargetAtTime(level > 0 ? 1 : PLANNING_LEVEL, now, 0.15);
  bass.gain.cancelScheduledValues(now);
  bass.gain.setTargetAtTime(level > 0 ? FIGHT_BASS_DB : 0, now, 0.15);
}

function updateMusic() {
  const shouldPlay = ctx !== null && wantMusic && prefs.music;
  if (shouldPlay && !source) {
    const track = tracks.get(current);
    if (!track) {
      loadTrack(ctx!, current);
      return;
    }
    const audio = ctx!;
    trackGain = audio.createGain();
    trackGain.gain.value = level > 0 ? 1 : PLANNING_LEVEL;
    bass = audio.createBiquadFilter();
    bass.type = 'lowshelf';
    bass.frequency.value = 110;
    bass.gain.value = level > 0 ? FIGHT_BASS_DB : 0;
    source = audio.createBufferSource();
    source.buffer = track;
    source.loop = true;
    source.connect(bass).connect(trackGain).connect(musicGain);
    source.start();
  } else if (!shouldPlay && source) {
    source.stop();
    source.disconnect();
    source = null;
    trackGain = null;
    bass = null;
  }
}

/** The run screen holds the music; it only sounds if the player turned it on. Each call
    starts a freshly picked track. */
export function startMusic() {
  wantMusic = false;
  updateMusic();
  pickTrack();
  wantMusic = true;
  updateMusic();
}

export function stopMusic() {
  wantMusic = false;
  level = 0;
  updateMusic();
}

/** 0 while planning; anything higher once a fight starts, which brings the bass in. */
export function setMusicLevel(next: number) {
  level = next;
  applyLevel();
}

// Meme-famous tunes that are long out of copyright, written out as notes here and played
// by a small synth band, so there's no recording to license. Each is rendered once into
// an AudioBuffer and looped like any other soundtrack.

/** A note as [MIDI note or null for a rest, length in steps]. */
type Note = [number | null, number];

export interface Song {
  name: string;
  bpm: number;
  /** Steps in a beat: 2 for eighth notes, 4 for sixteenths. */
  stepsPerBeat: number;
  lead: Note[];
  bass: Note[];
  /** One entry per time through: how far to shift it, in semitones, and how much faster. */
  passes: { shift: number; tempo: number }[];
}

// Grieg, In the Hall of the Mountain King (1875): each time round a little faster.
const MOUNTAIN_KING: Song = {
  name: 'Mountain King',
  bpm: 132,
  stepsPerBeat: 2,
  lead: [
    [59, 1], [61, 1], [62, 1], [64, 1], [66, 1], [62, 1], [66, 2],
    [65, 1], [61, 1], [65, 2], [64, 1], [60, 1], [64, 2],
    [59, 1], [61, 1], [62, 1], [64, 1], [66, 1], [62, 1], [66, 1], [71, 1],
    [69, 1], [66, 1], [62, 1], [66, 1], [69, 4],
  ],
  bass: [
    [35, 2], [35, 2], [35, 2], [35, 2],
    [42, 2], [42, 2], [42, 2], [42, 2],
    [35, 2], [35, 2], [35, 2], [35, 2],
    [42, 2], [42, 2], [42, 2], [42, 2],
  ],
  passes: [
    { shift: 0, tempo: 1 },
    { shift: 0, tempo: 1.08 },
    { shift: 7, tempo: 1.16 },
    { shift: 7, tempo: 1.26 },
    { shift: 12, tempo: 1.38 },
    { shift: 12, tempo: 1.52 },
  ],
};

// Offenbach, the galop from Orpheus in the Underworld (1858): the Can-can.
const CAN_CAN: Song = {
  name: 'Can-can',
  bpm: 150,
  stepsPerBeat: 2,
  lead: [
    [62, 1], [65, 1], [64, 1], [62, 1],
    [67, 2], [67, 2],
    [67, 1], [69, 1], [64, 1], [65, 1],
    [62, 2], [62, 2],
    [62, 1], [65, 1], [64, 1], [62, 1],
    [60, 1], [72, 1], [71, 1], [69, 1],
    [67, 1], [65, 1], [64, 1], [62, 1],
    [60, 2], [null, 2],
  ],
  // Oom-pah: the root, then the fifth, a bar of 2/4 at a time.
  bass: [
    [43, 1], [null, 1], [50, 1], [null, 1],
    [36, 1], [null, 1], [43, 1], [null, 1],
    [36, 1], [null, 1], [43, 1], [null, 1],
    [43, 1], [null, 1], [50, 1], [null, 1],
    [43, 1], [null, 1], [50, 1], [null, 1],
    [36, 1], [null, 1], [43, 1], [null, 1],
    [43, 1], [null, 1], [50, 1], [null, 1],
    [36, 1], [null, 1], [43, 1], [null, 1],
  ],
  passes: [
    { shift: 0, tempo: 1 },
    { shift: 0, tempo: 1 },
    { shift: 12, tempo: 1.05 },
    { shift: 0, tempo: 1.05 },
    { shift: 5, tempo: 1.1 },
    { shift: 12, tempo: 1.1 },
  ],
};

// Mozart, Rondo alla Turca (1783): the Turkish March.
const TURKISH_MARCH: Song = {
  name: 'Turkish March',
  bpm: 120,
  stepsPerBeat: 4,
  lead: [
    [71, 1], [69, 1], [68, 1], [69, 1], [72, 4],
    [74, 1], [72, 1], [71, 1], [72, 1], [76, 4],
    [77, 1], [76, 1], [75, 1], [76, 1], [83, 1], [81, 1], [80, 1], [81, 1],
    [83, 1], [81, 1], [80, 1], [81, 1], [84, 4],
    [81, 2], [83, 2], [84, 2], [83, 2], [81, 2], [80, 2], [81, 4],
  ].map(([note, steps]) => [note === null ? null : note - 12, steps] as Note),
  bass: [
    [45, 2], [57, 2], [45, 2], [57, 2],
    [45, 2], [57, 2], [45, 2], [57, 2],
    [45, 2], [57, 2], [45, 2], [57, 2],
    [45, 2], [57, 2], [45, 2], [57, 2],
    [40, 2], [52, 2], [40, 2], [52, 2],
    [45, 2], [57, 2], [45, 2], [57, 2],
  ],
  passes: [
    { shift: 0, tempo: 1 },
    { shift: 0, tempo: 1 },
    { shift: 12, tempo: 1.06 },
    { shift: 0, tempo: 1.06 },
    { shift: 12, tempo: 1.12 },
  ],
};

// Rimsky-Korsakov, Flight of the Bumblebee (1900).
const BUMBLEBEE: Song = {
  name: 'Bumblebee',
  bpm: 108,
  stepsPerBeat: 4,
  lead: [
    ...[88, 87, 86, 85, 84, 89, 88, 87, 88, 87, 86, 85, 84, 85, 86, 87],
    ...[88, 87, 86, 85, 84, 89, 88, 87, 88, 87, 86, 85, 84, 85, 86, 87],
    ...[88, 87, 86, 85, 84, 83, 82, 81, 80, 79, 78, 77, 76, 77, 78, 79],
    ...[80, 81, 82, 83, 84, 85, 86, 87, 88, 87, 86, 85, 84, 85, 86, 87],
  ].map((note) => [note - 12, 1] as Note),
  bass: [
    [40, 2], [null, 2], [40, 2], [null, 2], [40, 2], [null, 2], [40, 2], [null, 2],
    [40, 2], [null, 2], [40, 2], [null, 2], [40, 2], [null, 2], [40, 2], [null, 2],
    [45, 2], [null, 2], [45, 2], [null, 2], [44, 2], [null, 2], [44, 2], [null, 2],
    [40, 2], [null, 2], [40, 2], [null, 2], [47, 2], [null, 2], [47, 2], [null, 2],
  ],
  passes: [
    { shift: 0, tempo: 1 },
    { shift: 0, tempo: 1 },
    { shift: 5, tempo: 1.05 },
    { shift: 0, tempo: 1.1 },
  ],
};

export const SONGS: readonly Song[] = [MOUNTAIN_KING, CAN_CAN, TURKISH_MARCH, BUMBLEBEE];

const SAMPLE_RATE = 44100;
const midi = (note: number) => 440 * 2 ** ((note - 69) / 12);
const length = (notes: Note[]) => notes.reduce((sum, [, steps]) => sum + steps, 0);

/** Plays the whole song, every pass, into a buffer. */
export async function renderSong(song: Song): Promise<AudioBuffer> {
  const stepsPerPass = length(song.lead);
  const passSeconds = song.passes.map(({ tempo }) => (stepsPerPass * 60) / (song.bpm * tempo * song.stepsPerBeat));
  const total = passSeconds.reduce((a, b) => a + b, 0);
  const audio = new OfflineAudioContext(2, Math.ceil((total + 0.05) * SAMPLE_RATE), SAMPLE_RATE);

  const out = audio.createGain();
  out.gain.value = 0.7;
  out.connect(audio.destination);
  const noise = audio.createBuffer(1, SAMPLE_RATE, SAMPLE_RATE);
  const samples = noise.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;

  const tone = (frequency: number, start: number, duration: number, type: OscillatorType, level: number, cutoff: number) => {
    const osc = audio.createOscillator();
    osc.type = type;
    osc.frequency.value = frequency;
    const filter = audio.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = audio.createGain();
    const end = start + Math.max(0.04, duration * 0.92);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(level, start + 0.006);
    gain.gain.exponentialRampToValueAtTime(level * 0.55, Math.min(end, start + 0.12));
    gain.gain.exponentialRampToValueAtTime(0.0001, end + 0.03);
    osc.connect(filter).connect(gain).connect(out);
    osc.start(start);
    osc.stop(end + 0.05);
  };
  const kick = (start: number) => {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.frequency.setValueAtTime(150, start);
    osc.frequency.exponentialRampToValueAtTime(42, start + 0.16);
    gain.gain.setValueAtTime(0.9, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.24);
    osc.connect(gain).connect(out);
    osc.start(start);
    osc.stop(start + 0.26);
  };
  const hiss = (start: number, duration: number, level: number, type: BiquadFilterType, frequency: number) => {
    const source = audio.createBufferSource();
    source.buffer = noise;
    const filter = audio.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    const gain = audio.createGain();
    gain.gain.setValueAtTime(level, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter).connect(gain).connect(out);
    source.start(start, Math.random() * 0.5);
    source.stop(start + duration + 0.02);
  };

  let t = 0;
  song.passes.forEach(({ shift, tempo }, pass) => {
    const step = 60 / (song.bpm * tempo * song.stepsPerBeat);
    let at = t;
    for (const [note, steps] of song.lead) {
      if (note !== null) tone(midi(note + shift), at, steps * step, 'square', 0.12, 3200);
      at += steps * step;
    }
    at = t;
    for (const [note, steps] of song.bass) {
      if (note !== null) tone(midi(note + (shift % 12 === 0 ? 0 : shift)), at, steps * step, 'sawtooth', 0.3, 520);
      at += steps * step;
    }
    // Four on the floor, a snare on the backbeat and hats between; the first pass eases in.
    for (let i = 0; i < stepsPerPass; i++) {
      const start = t + i * step;
      const beat = i / song.stepsPerBeat;
      if (Number.isInteger(beat)) {
        kick(start);
        if (pass > 0 && beat % 2 === 1) hiss(start, 0.14, 0.28, 'bandpass', 1900);
      } else if (i % (song.stepsPerBeat / 2) === 0 && pass > 0) {
        hiss(start, 0.05, 0.1, 'highpass', 7000);
      }
    }
    t += passSeconds[pass];
  });

  return audio.startRendering();
}

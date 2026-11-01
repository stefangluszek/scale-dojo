/**
 * Deterministic PCM fixtures for pitch detection. Everything is generated
 * from seeds, so tests, the benchmark and the browser's fake microphone all
 * hear exactly the same signals.
 */

/** Harmonic amplitudes, from the fundamental upwards. */
export const TIMBRES = {
  /** A pure tone: a sanity check, not a realistic bass. */
  sine: [1],
  /** Roughly a bass pickup: strong fundamental, falling harmonics. */
  bass: [1, 0.7, 0.45, 0.3, 0.2, 0.12, 0.08, 0.05],
  /**
   * A small phone or laptop microphone that barely picks up the low
   * fundamental, so the second harmonic is louder than the note itself.
   */
  phone: [0.08, 1, 0.7, 0.5, 0.3, 0.2, 0.1],
  /**
   * Strong even and weak odd harmonics: the signal nearly repeats every half
   * period, inviting an octave-up error.
   */
  octaveTrap: [0.3, 1, 0.1, 0.6, 0.05, 0.3],
} as const satisfies Record<string, readonly number[]>;

export type Timbre = keyof typeof TIMBRES;

/** Small, fast, seeded PRNG (mulberry32) returning values in [0, 1). */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface ToneOptions {
  frequency: number;
  sampleRate: number;
  /** Length in samples. */
  length: number;
  timbre?: Timbre;
  /** Peak amplitude before noise is added. */
  amplitude?: number;
  /** Exponential decay rate per second, like a plucked string fading. */
  decay?: number;
  /** String stiffness: harmonic n sits at n·f·√(1 + B·n²). */
  inharmonicity?: number;
  /** Peak amplitude of added white noise. */
  noise?: number;
  seed?: number;
}

/** A harmonic tone with seeded random phases, decay, stiffness and noise. */
export function tone({
  frequency,
  sampleRate,
  length,
  timbre = 'bass',
  amplitude = 0.5,
  decay = 0,
  inharmonicity = 0,
  noise = 0,
  seed = 1,
}: ToneOptions): Float32Array {
  const random = seededRandom(seed);
  const harmonics: readonly number[] = TIMBRES[timbre];
  const total = harmonics.reduce((sum, value) => sum + value, 0);
  const partials = harmonics.map((weight, index) => {
    const n = index + 1;
    return {
      weight: (weight / total) * amplitude,
      step:
        (2 * Math.PI * n * frequency * Math.sqrt(1 + inharmonicity * n * n)) /
        sampleRate,
      phase: random() * 2 * Math.PI,
    };
  });
  const samples = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    let value = 0;
    for (const partial of partials) {
      // Partials above Nyquist would alias; a real converter filters them.
      if (partial.step < Math.PI) {
        value += partial.weight * Math.sin(partial.step * i + partial.phase);
      }
    }
    const envelope = decay ? Math.exp((-decay * i) / sampleRate) : 1;
    samples[i] = value * envelope + (noise ? (random() * 2 - 1) * noise : 0);
  }
  return samples;
}

export function silence(length: number): Float32Array {
  return new Float32Array(length);
}

export function whiteNoise(
  length: number,
  amplitude: number,
  seed = 7,
): Float32Array {
  const random = seededRandom(seed);
  return Float32Array.from({ length }, () => (random() * 2 - 1) * amplitude);
}

export function concat(...parts: readonly Float32Array[]): Float32Array {
  const result = new Float32Array(
    parts.reduce((sum, part) => sum + part.length, 0),
  );
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

/** A short linear fade in and out, like a note's attack and release. */
export function fade(samples: Float32Array, sampleRate: number, ms = 10) {
  const length = Math.min(
    Math.floor((sampleRate * ms) / 1000),
    samples.length / 2,
  );
  for (let i = 0; i < length; i += 1) {
    const gain = i / length;
    samples[i]! *= gain;
    samples[samples.length - 1 - i]! *= gain;
  }
  return samples;
}

/** Equal temperament, A4 = 440 Hz. */
export function midiFrequency(midiNote: number, cents = 0): number {
  return 440 * 2 ** ((midiNote - 69 + cents / 100) / 12);
}

/** Encodes mono samples as a 16-bit PCM WAV file. */
export function encodeWav(samples: Float32Array, sampleRate: number) {
  const bytes = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, value: string) =>
    [...value].forEach((char, index) =>
      view.setUint8(offset + index, char.charCodeAt(0)),
    );
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((sample, index) => {
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(44 + index * 2, Math.round(clamped * 32767), true);
  });
  return bytes;
}

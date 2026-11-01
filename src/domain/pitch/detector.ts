/** One analysis window's pitch: a frequency and how periodic the signal is. */
export interface PitchEstimate {
  /** Fundamental frequency in hertz. */
  frequency: number;
  /** Periodicity from 0 (noise) to 1 (perfectly repeating). */
  clarity: number;
}

export interface PitchRange {
  minFrequency: number;
  maxFrequency: number;
}

/**
 * Four-string bass, E1 (41.2 Hz) to G4 (392 Hz, fret 24 on the G string),
 * with room for notes played up to about a semitone out of tune.
 */
export const BASS_RANGE: PitchRange = { minFrequency: 38, maxFrequency: 420 };

/**
 * A key maximum this close to the highest one is the period. Lower values
 * prefer shorter periods; McLeod & Wyvill recommend 0.8–1.0.
 */
const PEAK_RATIO = 0.9;

/** Window length, in seconds: over three periods of E1. */
const WINDOW_SECONDS = 0.075;

/**
 * Samples per analysis window for a sample rate: the power of two (required
 * by the Web Audio analyser) of at least 75 ms, so 4096 at 44.1 or 48 kHz.
 */
export function analysisWindowSize(sampleRate: number): number {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new RangeError('A sample rate must be a positive number.');
  }
  const wanted = sampleRate * WINDOW_SECONDS;
  return Math.min(32768, Math.max(2048, 2 ** Math.ceil(Math.log2(wanted))));
}

/** Root mean square level, from 0 (silence) to 1 (full scale). */
export function rootMeanSquare(samples: ArrayLike<number>): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i += 1) {
    sum += samples[i]! * samples[i]!;
  }
  return Math.sqrt(sum / samples.length);
}

/**
 * Estimates the fundamental of a monophonic window with the McLeod Pitch
 * Method (McLeod & Wyvill, 2005): a normalized square difference function,
 * the first key maximum close to the highest, and parabolic interpolation.
 *
 * Returns null when the window is silent or has no repeating shape. Otherwise
 * it returns a frequency, which may fall outside the bass range, and a
 * clarity that callers gate on. `lowestFrequency` sets the longest period
 * searched; the window must hold at least 1.5 of those periods.
 */
export function detectPitch(
  samples: ArrayLike<number>,
  sampleRate: number,
  lowestFrequency = BASS_RANGE.minFrequency,
): PitchEstimate | null {
  if (!(sampleRate > 0 && lowestFrequency > 0)) {
    throw new RangeError('Sample rate and lowest frequency must be positive.');
  }
  const size = samples.length;
  const maxLag = Math.ceil(sampleRate / lowestFrequency);
  if (size < maxLag * 1.5) {
    throw new RangeError(
      'The window is too short for the lowest frequency searched.',
    );
  }

  // Remove any DC offset so it can't masquerade as a very long period.
  let mean = 0;
  for (let i = 0; i < size; i += 1) mean += samples[i]!;
  mean /= size;
  const signal = new Float64Array(size);
  let energy = 0;
  for (let i = 0; i < size; i += 1) {
    signal[i] = samples[i]! - mean;
    energy += 2 * signal[i]! * signal[i]!;
  }
  if (energy === 0) return null;

  // n(τ) = 2·Σ x[j]x[j+τ] / Σ (x[j]² + x[j+τ]²) over the overlapping part.
  // One extra lag lets a peak at maxLag be interpolated.
  const nsdf = new Float64Array(maxLag + 2);
  for (let lag = 0; lag <= maxLag + 1; lag += 1) {
    if (lag > 0) {
      const first = signal[lag - 1]!;
      const last = signal[size - lag]!;
      energy -= first * first + last * last;
    }
    let correlation = 0;
    for (let j = 0; j < size - lag; j += 1) {
      correlation += signal[j]! * signal[j + lag]!;
    }
    nsdf[lag] = energy > 0 ? (2 * correlation) / energy : 0;
  }

  // Key maxima: the highest point of each positive region after the first
  // time the function goes negative. A region still rising at maxLag has no
  // peak yet.
  const peaks: number[] = [];
  let lag = 1;
  while (lag <= maxLag && nsdf[lag]! > 0) lag += 1;
  while (lag <= maxLag) {
    while (lag <= maxLag && nsdf[lag]! <= 0) lag += 1;
    let peak = lag;
    while (lag <= maxLag && nsdf[lag]! > 0) {
      if (nsdf[lag]! > nsdf[peak]!) peak = lag;
      lag += 1;
    }
    if (peak <= maxLag && (lag <= maxLag || nsdf[peak]! > nsdf[peak + 1]!)) {
      peaks.push(peak);
    }
  }
  if (peaks.length === 0) return null;

  const highest = Math.max(...peaks.map((peak) => nsdf[peak]!));
  const best = peaks.find((peak) => nsdf[peak]! >= PEAK_RATIO * highest)!;
  const before = nsdf[best - 1]!;
  const at = nsdf[best]!;
  const after = nsdf[best + 1]!;
  const curvature = before - 2 * at + after;
  const shift =
    curvature < 0
      ? Math.max(-0.5, Math.min(0.5, (before - after) / (2 * curvature)))
      : 0;
  const height = at - ((before - after) * shift) / 4;
  return {
    frequency: sampleRate / (best + shift),
    clarity: Math.max(0, Math.min(1, height)),
  };
}

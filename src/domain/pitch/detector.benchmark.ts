/**
 * Pitch detector benchmark: `npm run bench:pitch`.
 *
 * Compares the McLeod Pitch Method (shipped in detector.ts) with YIN on the
 * deterministic fixtures, across window sizes and common sample rates, and
 * times one analysis window. Results are recorded in
 * docs/implementation-plan.md (stage 2). Synthetic fixtures are not a
 * substitute for a real bass and microphone, and timings depend on the
 * machine running the benchmark.
 */
import { expect, test } from 'vitest';
import {
  midiFrequency,
  tone,
  whiteNoise,
  type Timbre,
} from '../../test/audioFixtures';
import {
  BASS_RANGE,
  detectPitch,
  rootMeanSquare,
  type PitchEstimate,
} from './detector';

type Detector = (
  samples: Float32Array,
  sampleRate: number,
  lowestFrequency: number,
) => PitchEstimate | null;

/**
 * YIN (de Cheveigné & Kawahara, 2002): cumulative-mean-normalized
 * difference, absolute threshold 0.15, parabolic interpolation.
 */
function yin(
  samples: Float32Array,
  sampleRate: number,
  lowestFrequency: number,
): PitchEstimate | null {
  const tauMin = Math.max(2, Math.floor(sampleRate / BASS_RANGE.maxFrequency));
  const tauMax = Math.ceil(sampleRate / lowestFrequency);
  const width = samples.length - tauMax - 1;
  let baseEnergy = 0;
  for (let j = 0; j < width; j += 1) baseEnergy += samples[j]! * samples[j]!;
  if (baseEnergy === 0) return null;
  const normalized = new Float64Array(tauMax + 2);
  normalized[0] = 1;
  let shiftedEnergy = baseEnergy;
  let runningSum = 0;
  for (let tau = 1; tau <= tauMax + 1; tau += 1) {
    shiftedEnergy += samples[tau + width - 1]! ** 2 - samples[tau - 1]! ** 2;
    let correlation = 0;
    for (let j = 0; j < width; j += 1) {
      correlation += samples[j]! * samples[j + tau]!;
    }
    const difference = Math.max(
      0,
      baseEnergy + shiftedEnergy - 2 * correlation,
    );
    runningSum += difference;
    normalized[tau] = runningSum > 0 ? (difference * tau) / runningSum : 1;
  }
  let best = -1;
  for (let tau = tauMin; tau <= tauMax; tau += 1) {
    if (normalized[tau]! < 0.15) {
      while (tau < tauMax && normalized[tau + 1]! < normalized[tau]!) tau += 1;
      best = tau;
      break;
    }
  }
  if (best < 0) {
    best = tauMin;
    for (let tau = tauMin + 1; tau <= tauMax; tau += 1) {
      if (normalized[tau]! < normalized[best]!) best = tau;
    }
  }
  const before = normalized[best - 1]!;
  const at = normalized[best]!;
  const after = normalized[best + 1]!;
  const curvature = before - 2 * at + after;
  const shift = curvature > 0 ? (before - after) / (2 * curvature) : 0;
  return {
    frequency: sampleRate / (best + shift),
    clarity: Math.max(0, 1 - at),
  };
}

const DETECTORS: Record<string, Detector> = {
  McLeod: detectPitch,
  YIN: yin,
};
const SAMPLE_RATES = [44100, 48000];
const WINDOWS = [2048, 4096, 8192];
/** E1 to G4, every semitone. */
const NOTES = Array.from({ length: 40 }, (_, index) => 28 + index);
const DETUNE = [0, 23, -37];
/** Clarity needed to report a note; mirrors the stabilizer's default. */
const MIN_CLARITY = 0.8;

interface Condition {
  name: string;
  timbre: Timbre;
  /** Signal-to-noise ratio in dB, when white noise is added. */
  snr?: number;
  pluck?: boolean;
}
const CONDITIONS: Condition[] = [
  { name: 'sine', timbre: 'sine' },
  { name: 'bass', timbre: 'bass' },
  { name: 'bass, 20 dB SNR', timbre: 'bass', snr: 20 },
  { name: 'bass, 10 dB SNR', timbre: 'bass', snr: 10 },
  { name: 'plucked, stiff string', timbre: 'bass', pluck: true },
  { name: 'phone mic', timbre: 'phone' },
  { name: 'phone mic, 20 dB SNR', timbre: 'phone', snr: 20 },
  { name: 'octave trap', timbre: 'octaveTrap' },
];

function fixture(
  condition: Condition,
  midi: number,
  cents: number,
  sampleRate: number,
  size: number,
  seed: number,
) {
  const offset = 1500 + (seed % 7) * 97;
  const clean = tone({
    frequency: midiFrequency(midi, cents),
    sampleRate,
    length: offset + size,
    timbre: condition.timbre,
    seed,
    ...(condition.pluck ? { decay: 3, inharmonicity: 0.0003 } : {}),
  }).subarray(offset);
  if (condition.snr === undefined) return clean;
  // Uniform white noise with RMS = peak/√3, scaled to the requested SNR.
  const noiseRms = rootMeanSquare(clean) / 10 ** (condition.snr / 20);
  const noise = whiteNoise(size, Math.sqrt(3) * noiseRms, seed);
  return clean.map((sample, index) => sample + noise[index]!);
}

function percentile(values: number[], fraction: number) {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.floor(fraction * sorted.length),
  );
  return Number(sorted[index]!.toFixed(2));
}

function evaluate(detector: Detector, condition: Condition, size: number) {
  let total = 0;
  let correct = 0;
  let octave = 0;
  let unsure = 0;
  const centsErrors: number[] = [];
  let seed = 1;
  for (const sampleRate of SAMPLE_RATES) {
    for (const midi of NOTES) {
      for (const cents of DETUNE) {
        seed += 1;
        total += 1;
        const samples = fixture(condition, midi, cents, sampleRate, size, seed);
        const estimate = detector(samples, sampleRate, BASS_RANGE.minFrequency);
        if (!estimate || estimate.clarity < MIN_CLARITY) {
          unsure += 1;
          continue;
        }
        const heard = 69 + 12 * Math.log2(estimate.frequency / 440);
        const error = heard - (midi + cents / 100);
        if (Math.round(heard) === midi) {
          correct += 1;
          centsErrors.push(Math.abs(error * 100));
        } else if (Math.abs(Math.round(error)) % 12 === 0) {
          octave += 1;
        }
      }
    }
  }
  return {
    'correct %': Number(((100 * correct) / total).toFixed(1)),
    'octave errors': octave,
    'other errors': total - correct - octave - unsure,
    'not sure': unsure,
    'median ¢': percentile(centsErrors, 0.5),
    'p95 ¢': percentile(centsErrors, 0.95),
  };
}

test('pitch detector benchmark', () => {
  const accuracy = Object.entries(DETECTORS).flatMap(([name, detector]) =>
    WINDOWS.flatMap((size) =>
      CONDITIONS.map((condition) => ({
        detector: name,
        window: size,
        condition: condition.name,
        ...evaluate(detector, condition, size),
      })),
    ),
  );

  const noise = Object.entries(DETECTORS).flatMap(([name, detector]) =>
    WINDOWS.map((size) => {
      let reported = 0;
      for (let seed = 1; seed <= 50; seed += 1) {
        const estimate = detector(whiteNoise(size, 0.3, seed), 48000, 38);
        if (estimate && estimate.clarity >= MIN_CLARITY) reported += 1;
      }
      return {
        detector: name,
        window: size,
        'white-noise windows reported as notes (of 50)': reported,
      };
    }),
  );

  const timing = Object.entries(DETECTORS).flatMap(([name, detector]) =>
    WINDOWS.map((size) => {
      const samples = fixture(CONDITIONS[1]!, 28, 0, 48000, size, 3);
      for (let i = 0; i < 5; i += 1) detector(samples, 48000, 38);
      const runs = 40;
      const start = performance.now();
      for (let i = 0; i < runs; i += 1) detector(samples, 48000, 38);
      return {
        detector: name,
        window: size,
        'ms per window (48 kHz)': Number(
          ((performance.now() - start) / runs).toFixed(2),
        ),
      };
    }),
  );

  console.table(accuracy);
  console.table(noise);
  console.table(timing);
  expect(accuracy.length).toBeGreaterThan(0);
});

import { describe, expect, it } from 'vitest';
import {
  concat,
  midiFrequency,
  silence,
  tone,
  whiteNoise,
  type Timbre,
} from '../../test/audioFixtures';
import {
  analysisWindowSize,
  BASS_RANGE,
  detectPitch,
  rootMeanSquare,
} from './detector';

const E1 = 28;
const A1 = 33;
const E2 = 40;
const G4 = 67;

function centsBetween(frequency: number, expected: number) {
  return 1200 * Math.log2(frequency / expected);
}

function analyse(
  midi: number,
  {
    cents = 0,
    sampleRate = 48000,
    timbre = 'bass' as Timbre,
    noise = 0,
    pluck = false,
    seed = 3,
  } = {},
) {
  const size = analysisWindowSize(sampleRate);
  const offset = 1234;
  const samples = tone({
    frequency: midiFrequency(midi, cents),
    sampleRate,
    length: offset + size,
    timbre,
    noise,
    seed,
    ...(pluck ? { decay: 3, inharmonicity: 0.0003 } : {}),
  }).subarray(offset);
  return detectPitch(samples, sampleRate);
}

describe('analysis window size', () => {
  it('uses a power of two of at least 75 ms', () => {
    expect(analysisWindowSize(44100)).toBe(4096);
    expect(analysisWindowSize(48000)).toBe(4096);
    expect(analysisWindowSize(96000)).toBe(8192);
    expect(analysisWindowSize(16000)).toBe(2048);
    expect(analysisWindowSize(8000)).toBe(2048);
    expect(analysisWindowSize(1_000_000)).toBe(32768);
  });

  it('rejects impossible sample rates', () => {
    expect(() => analysisWindowSize(0)).toThrow(RangeError);
    expect(() => analysisWindowSize(Number.NaN)).toThrow(RangeError);
  });
});

describe('root mean square level', () => {
  it('measures silence, constant and sine signals', () => {
    expect(rootMeanSquare([])).toBe(0);
    expect(rootMeanSquare(silence(64))).toBe(0);
    expect(rootMeanSquare([0.5, -0.5, 0.5, -0.5])).toBeCloseTo(0.5);
    const sine = tone({
      frequency: 100,
      sampleRate: 48000,
      length: 4800,
      timbre: 'sine',
      amplitude: 1,
    });
    expect(rootMeanSquare(sine)).toBeCloseTo(Math.SQRT1_2, 3);
  });
});

// The sweeps run the detector dozens of times, which coverage
// instrumentation slows several times over; give slower CI runners room.
describe('McLeod pitch detection', { timeout: 20_000 }, () => {
  it.each([44100, 48000])(
    'finds every bass note from E1 to G4 at %i Hz within a cent',
    (sampleRate) => {
      for (let midi = E1; midi <= G4; midi += 1) {
        const estimate = analyse(midi, { sampleRate, seed: midi });
        expect(estimate, `MIDI ${midi}`).not.toBeNull();
        expect(
          Math.abs(centsBetween(estimate!.frequency, midiFrequency(midi))),
          `MIDI ${midi}`,
        ).toBeLessThan(1);
        expect(estimate!.clarity).toBeGreaterThan(0.95);
      }
    },
  );

  it('measures detuning on low E1 rather than rounding it away', () => {
    for (const cents of [-40, -15, 12, 45]) {
      const estimate = analyse(E1, { cents });
      expect(
        centsBetween(estimate!.frequency, midiFrequency(E1, cents)),
      ).toBeCloseTo(0, 0);
    }
  });

  it.each<[string, Timbre]>([
    ['a weak fundamental (phone microphone)', 'phone'],
    ['strong even harmonics (octave trap)', 'octaveTrap'],
  ])('keeps the octave with %s', (_, timbre) => {
    for (const midi of [E1, A1, E2, 45, 52]) {
      const estimate = analyse(midi, { timbre, seed: midi });
      expect(
        Math.abs(centsBetween(estimate!.frequency, midiFrequency(midi))),
        `MIDI ${midi}`,
      ).toBeLessThan(5);
    }
  });

  it('handles a decaying, slightly inharmonic plucked string', () => {
    for (const midi of [E1, A1, 38, 43]) {
      const estimate = analyse(midi, { pluck: true, seed: midi });
      // String stiffness raises the partials, so allow a few cents of bias.
      expect(
        Math.abs(centsBetween(estimate!.frequency, midiFrequency(midi))),
      ).toBeLessThan(8);
    }
  });

  it('stays on the right note with background noise', () => {
    for (const midi of [E1, A1, E2]) {
      const estimate = analyse(midi, { noise: 0.03, seed: midi });
      expect(
        Math.abs(centsBetween(estimate!.frequency, midiFrequency(midi))),
      ).toBeLessThan(10);
      expect(estimate!.clarity).toBeGreaterThan(0.8);
    }
  });

  it('reports notes above the bass range at their own pitch, not an octave down', () => {
    const estimate = analyse(69); // A4, 440 Hz
    expect(estimate!.frequency).toBeCloseTo(440, 0);
    expect(estimate!.frequency).toBeGreaterThan(BASS_RANGE.maxFrequency);
  });

  it('finds a note that starts partway through the window', () => {
    const sampleRate = 48000;
    const size = analysisWindowSize(sampleRate);
    const samples = concat(
      silence(size / 2),
      tone({
        frequency: midiFrequency(A1),
        sampleRate,
        length: size / 2,
      }),
    );
    const estimate = detectPitch(samples, sampleRate);
    // The abrupt start skews the estimate by a few cents, not a semitone.
    expect(
      Math.abs(centsBetween(estimate!.frequency, midiFrequency(A1))),
    ).toBeLessThan(10);
  });

  it('returns nothing for silence or a constant offset, and low clarity for noise', () => {
    expect(detectPitch(silence(4096), 48000)).toBeNull();
    expect(detectPitch(new Float32Array(4096).fill(0.2), 48000)).toBeNull();
    for (let seed = 1; seed <= 10; seed += 1) {
      const estimate = detectPitch(whiteNoise(4096, 0.3, seed), 48000);
      expect(estimate?.clarity ?? 0).toBeLessThan(0.6);
    }
  });

  it('returns nothing when the signal never repeats within the searched periods', () => {
    // A slow ramp only falls in correlation, with no key maximum.
    const ramp = Float32Array.from({ length: 4096 }, (_, i) => i / 4096);
    expect(detectPitch(ramp, 48000)).toBeNull();
  });

  it('rejects windows too short for the lowest frequency and invalid settings', () => {
    expect(() => detectPitch(silence(1024), 48000)).toThrow(RangeError);
    expect(() => detectPitch(silence(4096), 0)).toThrow(RangeError);
    expect(() => detectPitch(silence(4096), 48000, -1)).toThrow(RangeError);
    // A higher lowest frequency allows a shorter window.
    const samples = tone({
      frequency: 220,
      sampleRate: 48000,
      length: 1024,
    });
    expect(detectPitch(samples, 48000, 100)!.frequency).toBeCloseTo(220, 0);
  });
});

import { assertMidiNote } from '../music/scales';

/** The nearest equal-tempered note to a frequency and the distance from it. */
export interface NearestNote {
  midi: number;
  /** From −50 (flat) to +50 (sharp). */
  cents: number;
}

/** Fractional MIDI pitch, A4 = 440 Hz = 69. */
export function frequencyToMidi(frequency: number): number {
  if (!Number.isFinite(frequency) || frequency <= 0) {
    throw new RangeError('A frequency must be a positive number of hertz.');
  }
  return 69 + 12 * Math.log2(frequency / 440);
}

export function nearestNote(frequency: number): NearestNote {
  const pitch = frequencyToMidi(frequency);
  const midi = Math.round(pitch);
  assertMidiNote(midi);
  // `|| 0` turns −0 into 0.
  return { midi, cents: Math.round((pitch - midi) * 100) || 0 };
}

/** Deviations this small read as in tune. */
export const IN_TUNE_CENTS = 5;

export type TuningDirection = 'in tune' | 'sharp' | 'flat';

export function tuningDirection(cents: number): TuningDirection {
  if (Math.abs(cents) <= IN_TUNE_CENTS) return 'in tune';
  return cents > 0 ? 'sharp' : 'flat';
}

/** "In tune", "12 cents sharp" or "8 cents flat". */
export function describeTuning(cents: number): string {
  const direction = tuningDirection(cents);
  if (direction === 'in tune') return 'In tune';
  return `${Math.abs(Math.round(cents))} cents ${direction}`;
}

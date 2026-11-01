import { describe, expect, it } from 'vitest';
import {
  describeTuning,
  frequencyToMidi,
  nearestNote,
  tuningDirection,
} from './notes';

describe('frequency to note', () => {
  it('maps standard pitches, including low E1, to MIDI notes', () => {
    expect(frequencyToMidi(440)).toBe(69);
    expect(frequencyToMidi(41.2034)).toBeCloseTo(28, 4);
    expect(nearestNote(41.2034)).toEqual({ midi: 28, cents: 0 });
    expect(nearestNote(110)).toEqual({ midi: 45, cents: 0 });
  });

  it('keeps tuning deviation separate from the note', () => {
    expect(nearestNote(440 * 2 ** (12 / 1200))).toEqual({
      midi: 69,
      cents: 12,
    });
    expect(nearestNote(55 * 2 ** (-30 / 1200))).toEqual({
      midi: 33,
      cents: -30,
    });
    // Past the halfway point, the next note up is nearer.
    expect(nearestNote(55 * 2 ** (60 / 1200))).toEqual({
      midi: 34,
      cents: -40,
    });
  });

  it('rejects frequencies that are not positive or are beyond MIDI', () => {
    expect(() => frequencyToMidi(0)).toThrow(RangeError);
    expect(() => frequencyToMidi(Number.NaN)).toThrow(RangeError);
    expect(() => nearestNote(1)).toThrow(RangeError);
  });
});

describe('tuning description', () => {
  it('reads small deviations as in tune and names the direction otherwise', () => {
    expect(tuningDirection(0)).toBe('in tune');
    expect(tuningDirection(-5)).toBe('in tune');
    expect(tuningDirection(6)).toBe('sharp');
    expect(tuningDirection(-6)).toBe('flat');
    expect(describeTuning(4)).toBe('In tune');
    expect(describeTuning(12)).toBe('12 cents sharp');
    expect(describeTuning(-23)).toBe('23 cents flat');
  });
});

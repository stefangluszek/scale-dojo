import { describe, expect, it } from 'vitest';
import {
  getScaleNotes,
  isNoteInScale,
  midiToPitchClass,
  normalizePitchClass,
  noteName,
  type PitchClass,
  type ScaleId,
} from './scales';

describe('scale notes', () => {
  it.each([
    ['major-pentatonic', ['C', 'D', 'E', 'G', 'A']],
    ['minor-pentatonic', ['C', 'D#', 'F', 'G', 'A#']],
    ['major', ['C', 'D', 'E', 'F', 'G', 'A', 'B']],
    ['natural-minor', ['C', 'D', 'D#', 'F', 'G', 'G#', 'A#']],
  ] as const)('builds C %s in scale-degree order', (id, names) => {
    expect(getScaleNotes(0, id).map(noteName)).toEqual(names);
  });

  it('transposes through the octave boundary while keeping the root first', () => {
    expect(getScaleNotes(11, 'major-pentatonic').map(noteName)).toEqual([
      'B',
      'C#',
      'D#',
      'F#',
      'G#',
    ]);
    expect(getScaleNotes(9, 'natural-minor').map(noteName)).toEqual([
      'A',
      'B',
      'C',
      'D',
      'E',
      'F',
      'G',
    ]);
  });

  it.each([-1, 12, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid pitch class %s',
    (root) => {
      expect(() => getScaleNotes(root as PitchClass, 'major')).toThrow(
        RangeError,
      );
      expect(() => noteName(root as PitchClass)).toThrow(RangeError);
    },
  );

  it('rejects an unknown scale instead of silently selecting a default', () => {
    expect(() => getScaleNotes(0, 'unknown' as ScaleId)).toThrow(
      'Unknown scale',
    );
  });
});

describe('pitch classes and scale membership', () => {
  it.each([
    [0, 0],
    [12, 0],
    [25, 1],
    [-1, 11],
    [-24, 0],
  ])('normalizes %s semitones to pitch class %s', (semitones, expected) => {
    expect(normalizePitchClass(semitones)).toBe(expected);
  });

  it.each([
    0.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.MAX_SAFE_INTEGER + 1,
  ])('rejects an invalid semitone count %s', (value) =>
    expect(() => normalizePitchClass(value)).toThrow(RangeError),
  );

  it('classifies the same pitch class consistently across bass and piano octaves', () => {
    for (const midiNote of [24, 36, 60, 84]) {
      expect(isNoteInScale(midiNote, 0, 'major-pentatonic')).toBe(true);
    }
    for (const midiNote of [25, 37, 61, 85]) {
      expect(isNoteInScale(midiNote, 0, 'major-pentatonic')).toBe(false);
    }
  });

  it('respects the selected root and scale quality', () => {
    expect(isNoteInScale(63, 0, 'minor-pentatonic')).toBe(true);
    expect(isNoteInScale(63, 0, 'major-pentatonic')).toBe(false);
    expect(isNoteInScale(61, 11, 'major')).toBe(true);
    expect(isNoteInScale(60, 11, 'major')).toBe(false);
  });

  it('accepts MIDI range boundaries', () => {
    expect(midiToPitchClass(0)).toBe(0);
    expect(midiToPitchClass(127)).toBe(7);
  });

  it.each([-1, 128, 60.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid MIDI note %s',
    (midiNote) => {
      expect(() => midiToPitchClass(midiNote)).toThrow(RangeError);
      expect(() => isNoteInScale(midiNote, 0, 'major')).toThrow(RangeError);
    },
  );
});

import { describe, expect, it } from 'vitest';
import {
  noteAtFret,
  positionsOfNote,
  STANDARD_BASS,
  type FrettedInstrument,
} from './fretted';

describe('fretted instrument mapping', () => {
  it('maps standard bass open strings from E1 through G2', () => {
    expect(
      [0, 1, 2, 3].map((string) => noteAtFret(STANDARD_BASS, string, 0)),
    ).toEqual([28, 33, 38, 43]);
  });

  it('moves by one semitone per fret, including the highest fret', () => {
    expect(noteAtFret(STANDARD_BASS, 0, 1)).toBe(29);
    expect(noteAtFret(STANDARD_BASS, 0, 8)).toBe(36); // C2
    expect(noteAtFret(STANDARD_BASS, 3, 24)).toBe(67); // G4
  });

  it('places each string one octave above its open pitch at fret 12', () => {
    for (const [string, openNote] of STANDARD_BASS.tuning.entries()) {
      expect(noteAtFret(STANDARD_BASS, string, 12)).toBe(openNote + 12);
    }
  });

  it('accepts a different tuning without changing the mapper', () => {
    const guitar: FrettedInstrument = {
      id: 'guitar-standard',
      name: 'Guitar',
      tuning: [40, 45, 50, 55, 59, 64],
      fretCount: 22,
    };
    expect(noteAtFret(guitar, 5, 12)).toBe(76);
    expect(
      noteAtFret({ ...STANDARD_BASS, tuning: [26, 33, 38, 43] }, 0, 0),
    ).toBe(26);
  });

  it.each([-1, 4, 0.5, Number.NaN])(
    'rejects invalid string index %s',
    (stringIndex) => {
      expect(() => noteAtFret(STANDARD_BASS, stringIndex, 0)).toThrow(
        RangeError,
      );
    },
  );

  it.each([-1, 25, 0.5, Number.NaN])('rejects invalid fret %s', (fret) => {
    expect(() => noteAtFret(STANDARD_BASS, 0, fret)).toThrow(RangeError);
  });

  it.each([-1, 2.5, Number.NaN])(
    'rejects invalid fret count %s',
    (fretCount) => {
      expect(() => noteAtFret({ ...STANDARD_BASS, fretCount }, 0, 0)).toThrow(
        RangeError,
      );
    },
  );

  it('rejects an empty tuning', () => {
    expect(() => noteAtFret({ ...STANDARD_BASS, tuning: [] }, 0, 0)).toThrow(
      RangeError,
    );
  });

  it.each([-1, 128, 40.5, Number.NaN])(
    'rejects invalid open-string MIDI pitch %s',
    (pitch) => {
      expect(() =>
        noteAtFret({ ...STANDARD_BASS, tuning: [pitch] }, 0, 0),
      ).toThrow(RangeError);
    },
  );

  it('rejects fretted pitches beyond the supported MIDI range', () => {
    expect(() => noteAtFret({ ...STANDARD_BASS, tuning: [127] }, 0, 1)).toThrow(
      RangeError,
    );
  });

  it('lists every position of a pitch, limited to the frets shown', () => {
    expect(positionsOfNote(STANDARD_BASS, 28)).toEqual([
      { stringIndex: 0, fret: 0 },
    ]);
    // C2: E string fret 8 and A string fret 3.
    expect(positionsOfNote(STANDARD_BASS, 36, 12)).toEqual([
      { stringIndex: 0, fret: 8 },
      { stringIndex: 1, fret: 3 },
    ]);
    // G3 is on three strings by fret 24, but only the G string by fret 12.
    expect(positionsOfNote(STANDARD_BASS, 55)).toEqual([
      { stringIndex: 1, fret: 22 },
      { stringIndex: 2, fret: 17 },
      { stringIndex: 3, fret: 12 },
    ]);
    expect(positionsOfNote(STANDARD_BASS, 55, 12)).toEqual([
      { stringIndex: 3, fret: 12 },
    ]);
    expect(positionsOfNote(STANDARD_BASS, 27)).toEqual([]);
    expect(positionsOfNote(STANDARD_BASS, 60, 12)).toEqual([]);
    expect(() => positionsOfNote(STANDARD_BASS, 128)).toThrow(RangeError);
  });
});

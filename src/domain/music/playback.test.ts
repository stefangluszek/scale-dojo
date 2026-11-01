import { describe, expect, it } from 'vitest';
import { midiNoteName, midiToFrequency, scalePlaybackNotes } from './playback';
import { SCALE_DEFINITIONS, type PitchClass } from './scales';

describe('absolute-pitch playback', () => {
  it('names octave boundaries and tunes MIDI notes to A440', () => {
    expect([28, 35, 36, 43, 55].map(midiNoteName)).toEqual([
      'E1',
      'B1',
      'C2',
      'G2',
      'G3',
    ]);
    expect(midiToFrequency(69)).toBe(440);
    expect(midiToFrequency(28)).toBeCloseTo(41.2034, 4);
  });
  it('plays C major across an octave, including the closing root', () => {
    expect(scalePlaybackNotes(0, 'major', 28)).toEqual([
      36, 38, 40, 41, 43, 45, 47, 48,
    ]);
    expect(scalePlaybackNotes(9, 'minor-pentatonic', 28)).toEqual([
      33, 36, 38, 40, 43, 45,
    ]);
    expect(scalePlaybackNotes(4, 'major-pentatonic', 28)).toEqual([
      28, 30, 32, 35, 37, 40,
    ]);
  });
  it('keeps every root and scale ascending and inside the displayed bass range', () => {
    for (let root = 0; root < 12; root++) {
      for (const scale of SCALE_DEFINITIONS) {
        const notes = scalePlaybackNotes(root as PitchClass, scale.id, 28);
        expect(notes[0]! % 12).toBe(root);
        expect(notes[0]).toBeGreaterThanOrEqual(28);
        expect(notes.at(-1)).toBeLessThanOrEqual(55);
        expect(notes.at(-1)! - notes[0]!).toBe(12);
        expect(notes.every((note, i) => i === 0 || note > notes[i - 1]!)).toBe(
          true,
        );
      }
    }
  });
  it('rejects invalid pitches and sequences that exceed MIDI range', () => {
    expect(() => midiToFrequency(-1)).toThrow(RangeError);
    expect(() => midiNoteName(128)).toThrow(RangeError);
    expect(() => scalePlaybackNotes(0, 'major', 127)).toThrow(RangeError);
  });
});

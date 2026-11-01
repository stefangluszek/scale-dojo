import { assertMidiNote } from '../music/scales';

export interface FrettedInstrument {
  readonly id: string;
  readonly name: string;
  /** Open-string MIDI notes, ordered from the lowest-pitched string to the highest. */
  readonly tuning: readonly number[];
  /** Highest available fret; fret zero is the open string. */
  readonly fretCount: number;
}

export const STANDARD_BASS = {
  id: 'bass-standard',
  name: '4-string bass',
  tuning: [28, 33, 38, 43], // E1, A1, D2, G2
  fretCount: 24,
} as const satisfies FrettedInstrument;

/** Returns absolute pitch. String index zero means the lowest-pitched string. */
export function noteAtFret(
  instrument: FrettedInstrument,
  stringIndex: number,
  fret: number,
): number {
  if (!Number.isInteger(instrument.fretCount) || instrument.fretCount < 0) {
    throw new RangeError(
      'An instrument must have a non-negative integer fret count.',
    );
  }
  if (
    !Number.isInteger(stringIndex) ||
    stringIndex < 0 ||
    stringIndex >= instrument.tuning.length
  ) {
    throw new RangeError('String index is outside this instrument’s tuning.');
  }
  if (!Number.isInteger(fret) || fret < 0 || fret > instrument.fretCount) {
    throw new RangeError('Fret is outside this instrument’s playable range.');
  }
  const openNote = instrument.tuning[stringIndex]!;
  assertMidiNote(openNote);
  const midiNote = openNote + fret;
  assertMidiNote(midiNote);
  return midiNote;
}

export interface FretPosition {
  stringIndex: number;
  fret: number;
}

/**
 * Every place an absolute pitch can be played, lowest string first. A pitch
 * alone can't tell which of these was used.
 */
export function positionsOfNote(
  instrument: FrettedInstrument,
  midiNote: number,
  highestFret = instrument.fretCount,
): FretPosition[] {
  assertMidiNote(midiNote);
  const lastFret = Math.min(highestFret, instrument.fretCount);
  return instrument.tuning.flatMap((openNote, stringIndex) => {
    const fret = midiNote - openNote;
    return fret >= 0 && fret <= lastFret ? [{ stringIndex, fret }] : [];
  });
}

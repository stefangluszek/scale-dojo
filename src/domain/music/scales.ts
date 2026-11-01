/** Pitch classes ignore octave: C = 0, C# = 1, …, B = 11. */
export type PitchClass = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

export const NOTE_NAMES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
] as const;

export const SCALE_DEFINITIONS = [
  {
    id: 'major-pentatonic',
    name: 'Major pentatonic',
    intervals: [0, 2, 4, 7, 9],
  },
  {
    id: 'minor-pentatonic',
    name: 'Minor pentatonic',
    intervals: [0, 3, 5, 7, 10],
  },
  { id: 'major', name: 'Major', intervals: [0, 2, 4, 5, 7, 9, 11] },
  {
    id: 'natural-minor',
    name: 'Natural minor',
    intervals: [0, 2, 3, 5, 7, 8, 10],
  },
] as const;

export type ScaleId = (typeof SCALE_DEFINITIONS)[number]['id'];

export function normalizePitchClass(semitones: number): PitchClass {
  if (!Number.isSafeInteger(semitones)) {
    throw new RangeError('A pitch must be an integer number of semitones.');
  }
  return (((semitones % 12) + 12) % 12) as PitchClass;
}

export function assertMidiNote(midiNote: number): void {
  if (!Number.isInteger(midiNote) || midiNote < 0 || midiNote > 127) {
    throw new RangeError('A MIDI note must be an integer from 0 to 127.');
  }
}

export function midiToPitchClass(midiNote: number): PitchClass {
  assertMidiNote(midiNote);
  return normalizePitchClass(midiNote);
}

function assertPitchClass(pitchClass: number): void {
  if (!Number.isInteger(pitchClass) || pitchClass < 0 || pitchClass > 11) {
    throw new RangeError('A pitch class must be an integer from 0 to 11.');
  }
}

/** Bootstrap spelling uses sharps; contextual enharmonic spelling comes later. */
export function noteName(pitchClass: PitchClass): string {
  assertPitchClass(pitchClass);
  return NOTE_NAMES[pitchClass];
}

export function getScaleNotes(
  root: PitchClass,
  scaleId: ScaleId,
): readonly PitchClass[] {
  assertPitchClass(root);
  const definition = SCALE_DEFINITIONS.find((scale) => scale.id === scaleId);
  if (!definition) {
    throw new RangeError(`Unknown scale: ${scaleId}`);
  }
  return definition.intervals.map((interval) =>
    normalizePitchClass(root + interval),
  );
}

/** Scale membership depends on pitch class, independent of the played octave. */
export function isNoteInScale(
  midiNote: number,
  root: PitchClass,
  scaleId: ScaleId,
): boolean {
  const pitchClass = midiToPitchClass(midiNote);
  return getScaleNotes(root, scaleId).includes(pitchClass);
}

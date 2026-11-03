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

/** Major scales have a major third above the root; minor scales a minor third. */
export type ScaleQuality = 'major' | 'minor';

export const SCALE_DEFINITIONS = [
  {
    id: 'major-pentatonic',
    name: 'Major pentatonic',
    quality: 'major',
    intervals: [0, 2, 4, 7, 9],
  },
  {
    id: 'minor-pentatonic',
    name: 'Minor pentatonic',
    quality: 'minor',
    intervals: [0, 3, 5, 7, 10],
  },
  {
    id: 'major',
    name: 'Major',
    quality: 'major',
    intervals: [0, 2, 4, 5, 7, 9, 11],
  },
  {
    id: 'natural-minor',
    name: 'Natural minor',
    quality: 'minor',
    intervals: [0, 2, 3, 5, 7, 8, 10],
  },
] as const satisfies readonly {
  id: string;
  name: string;
  quality: ScaleQuality;
  intervals: readonly number[];
}[];

export type ScaleDefinition = (typeof SCALE_DEFINITIONS)[number];
export type ScaleId = ScaleDefinition['id'];

/** Degree names relative to the major scale on the same root. */
const DEGREE_LABELS = [
  '1',
  '♭2',
  '2',
  '♭3',
  '3',
  '4',
  '♭5',
  '5',
  '♭6',
  '6',
  '♭7',
  '7',
] as const;

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

export function getScaleDefinition(scaleId: ScaleId): ScaleDefinition {
  const definition = SCALE_DEFINITIONS.find((scale) => scale.id === scaleId);
  if (!definition) {
    throw new RangeError(`Unknown scale: ${scaleId}`);
  }
  return definition;
}

export function scaleQuality(scaleId: ScaleId): ScaleQuality {
  return getScaleDefinition(scaleId).quality;
}

/**
 * The scale a number of places away in the scale list, wrapping around at
 * either end: one step past the last scale is the first.
 */
export function cycleScale(scaleId: ScaleId, steps: number): ScaleId {
  if (!Number.isSafeInteger(steps)) {
    throw new RangeError('Scale steps must be an integer.');
  }
  const index = SCALE_DEFINITIONS.indexOf(getScaleDefinition(scaleId));
  const count = SCALE_DEFINITIONS.length;
  return SCALE_DEFINITIONS[(((index + steps) % count) + count) % count]!.id;
}

/** Labels a distance from the root as a scale degree, e.g. 3 semitones → ♭3. */
export function scaleDegreeLabel(semitones: number): string {
  return DEGREE_LABELS[normalizePitchClass(semitones)];
}

/**
 * Semitone steps between consecutive scale notes, ending with the step back
 * up to the root an octave higher. On one bass string, a step is that many frets.
 */
export function getScaleSteps(scaleId: ScaleId): number[] {
  const intervals: readonly number[] = getScaleDefinition(scaleId).intervals;
  return intervals.map(
    (interval, index) => (intervals[index + 1] ?? 12) - interval,
  );
}

export function getScaleNotes(
  root: PitchClass,
  scaleId: ScaleId,
): readonly PitchClass[] {
  assertPitchClass(root);
  return getScaleDefinition(scaleId).intervals.map((interval) =>
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

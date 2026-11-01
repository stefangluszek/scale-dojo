import {
  assertMidiNote,
  getScaleNotes,
  midiToPitchClass,
  normalizePitchClass,
  noteName,
  type PitchClass,
  type ScaleId,
} from './scales';

export function midiNoteName(midiNote: number): string {
  return `${noteName(midiToPitchClass(midiNote))}${Math.floor(midiNote / 12) - 1}`;
}

export function midiToFrequency(midiNote: number): number {
  assertMidiNote(midiNote);
  return 440 * 2 ** ((midiNote - 69) / 12);
}

/** One octave, starting at the first root at or above the instrument's low note. */
export function scalePlaybackNotes(
  root: PitchClass,
  scaleId: ScaleId,
  lowestNote: number,
): number[] {
  assertMidiNote(lowestNote);
  const notes = getScaleNotes(root, scaleId);
  const firstRoot =
    lowestNote + normalizePitchClass(root - midiToPitchClass(lowestNote));
  assertMidiNote(firstRoot + 12);
  return [
    ...notes.map((note) => firstRoot + normalizePitchClass(note - root)),
    firstRoot + 12,
  ];
}

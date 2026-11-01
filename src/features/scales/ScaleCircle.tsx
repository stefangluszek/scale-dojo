import { useRef, useState, type CSSProperties } from 'react';
import { midiNoteName } from '../../domain/music/playback';
import {
  getScaleDefinition,
  midiToPitchClass,
  normalizePitchClass,
  noteName,
  scaleDegreeLabel,
  type PitchClass,
  type ScaleId,
} from '../../domain/music/scales';
import { ScalePicker } from './ScalePicker';

/** Twelve evenly spaced semitones, clockwise from 12 o'clock. */
const POSITIONS = Array.from({ length: 12 }, (_, semitones) => {
  const angle = ((semitones * 30 - 90) * Math.PI) / 180;
  return { x: round(Math.cos(angle)), y: round(Math.sin(angle)) };
});

function round(value: number): number {
  return Number(value.toFixed(4));
}

function positionStyle(semitones: number): CSSProperties {
  const { x, y } = POSITIONS[semitones]!;
  return {
    left: `calc(50% + ${x} * var(--circle-radius))`,
    top: `calc(50% + ${y} * var(--circle-radius))`,
  };
}

/** Screen readers announce "♭3" inconsistently; say "flat 3" instead. */
export function spokenDegree(label: string): string {
  return label.replace('♭', 'flat ');
}

interface ScaleCircleProps {
  root: PitchClass;
  scaleId: ScaleId;
  /** Absolute pitch of the root used for playback; other notes sit above it. */
  lowRoot: number;
  activeNote: number | null;
  onPlayNote: (midiNote: number) => void;
  onRootChange: (root: PitchClass) => void;
  onScaleChange: (scaleId: ScaleId) => void;
}

/**
 * A chromatic circle with the root at the top. Scale notes form a polygon
 * whose shape is the same for every root of a given scale. Its center opens a
 * picker for the root and scale.
 */
export function ScaleCircle({
  root,
  scaleId,
  lowRoot,
  activeNote,
  onPlayNote,
  onRootChange,
  onScaleChange,
}: ScaleCircleProps) {
  const [picking, setPicking] = useState(false);
  const pickerToggle = useRef<HTMLButtonElement>(null);
  const scale = getScaleDefinition(scaleId);
  const intervals: readonly number[] = scale.intervals;
  const outside = POSITIONS.map((_, semitones) => semitones).filter(
    (semitones) => !intervals.includes(semitones),
  );
  // The circle has no octaves, so any octave of a playing pitch lights it up.
  const playingPitch =
    activeNote === null ? null : midiToPitchClass(activeNote);
  const isPlaying = (semitones: number) =>
    playingPitch === normalizePitchClass(root + semitones);
  const points = intervals
    .map((semitones) => `${POSITIONS[semitones]!.x},${POSITIONS[semitones]!.y}`)
    .join(' ');

  return (
    <div className="scale-circle" data-picking={picking || undefined}>
      <svg
        className="circle-shape"
        viewBox="-1 -1 2 2"
        aria-hidden="true"
        focusable="false"
      >
        <circle className="circle-ring" r="1" />
        <polygon className="circle-polygon" points={points} />
      </svg>

      <div className="circle-center" aria-live="polite" aria-atomic="true">
        <h3>
          <button
            ref={pickerToggle}
            type="button"
            className="circle-picker-toggle"
            title="Change root and scale"
            aria-haspopup="dialog"
            aria-expanded={picking}
            aria-controls="scale-picker"
            onClick={() => setPicking((open) => !open)}
          >
            <span className="circle-root-name">{noteName(root)}</span>{' '}
            <span className="circle-scale-name">
              {scale.name.toLowerCase()}
              <svg
                className="picker-chevron"
                viewBox="0 0 10 6"
                aria-hidden="true"
                focusable="false"
              >
                <path d="M1 1l4 4 4-4" />
              </svg>
            </span>
          </button>
        </h3>
        <p>{intervals.length} notes</p>
      </div>

      {picking && (
        <ScalePicker
          id="scale-picker"
          root={root}
          scaleId={scaleId}
          opener={pickerToggle}
          onRootChange={onRootChange}
          onScaleChange={onScaleChange}
          onClose={() => setPicking(false)}
        />
      )}

      <ol className="circle-notes" aria-label="Notes in the selected scale">
        {intervals.map((semitones, index) => {
          const isRoot = semitones === 0;
          const midiNote = lowRoot + semitones;
          const degree = scaleDegreeLabel(semitones);
          return (
            <li
              key={semitones}
              className={`circle-note ${isRoot ? 'circle-root' : 'circle-in-scale'}`}
              style={positionStyle(semitones)}
            >
              <button
                type="button"
                className={isPlaying(semitones) ? 'circle-playing' : undefined}
                aria-label={`Play ${midiNoteName(midiNote)}, ${isRoot ? 'root' : `scale degree ${spokenDegree(degree)}`}`}
                aria-keyshortcuts={String(index + 1)}
                onClick={() => onPlayNote(midiNote)}
              >
                <span className="note-name">
                  {noteName(normalizePitchClass(root + semitones))}
                </span>
                <span className="note-degree" aria-hidden="true">
                  {isRoot ? 'R' : degree}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <ul className="circle-notes" aria-label="Notes outside the scale">
        {outside.map((semitones) => {
          const midiNote = lowRoot + semitones;
          return (
            <li
              key={semitones}
              className="circle-note circle-outside"
              style={positionStyle(semitones)}
            >
              <button
                type="button"
                className={isPlaying(semitones) ? 'circle-playing' : undefined}
                aria-label={`Play ${midiNoteName(midiNote)}, outside scale`}
                onClick={() => onPlayNote(midiNote)}
              >
                {noteName(normalizePitchClass(root + semitones))}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

import { noteAtFret, STANDARD_BASS } from '../../domain/instruments/fretted';
import { midiNoteName } from '../../domain/music/playback';
import {
  isNoteInScale,
  midiToPitchClass,
  noteName,
  type PitchClass,
  type ScaleId,
} from '../../domain/music/scales';

const FRETS = Array.from({ length: 13 }, (_, fret) => fret);
const STRINGS = [...STANDARD_BASS.tuning.keys()].reverse();

interface BassFretboardProps {
  root: PitchClass;
  scaleId: ScaleId;
  activeNote: number | null;
  onPlayNote: (midiNote: number) => void;
}

export function BassFretboard({
  root,
  scaleId,
  activeNote,
  onPlayNote,
}: BassFretboardProps) {
  return (
    <section className="fretboard-section" aria-labelledby="fretboard-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">02 / Find it on the neck</p>
          <h2 id="fretboard-heading">The bass fretboard.</h2>
        </div>
        <span className="instrument-tag">Open strings – fret 12</span>
      </div>
      <p id="fretboard-help" className="explorer-hint">
        Standard tuning E1–A1–D2–G2. Highest string at the top, lowest at the
        bottom. Tap any note to hear it. Scroll sideways to explore all 12
        frets.
      </p>
      <p className="fretboard-legend">
        <span>
          <b>R</b> Root
        </span>
        <span>
          <b>●</b> Scale note
        </span>
        <span>Outline: outside scale</span>
        <span>♪ Playing pitch</span>
      </p>
      <div
        className="fretboard-scroll"
        role="region"
        aria-label="Scrollable bass fretboard"
        aria-describedby="fretboard-help"
        tabIndex={0}
      >
        <table className="fretboard">
          <caption className="sr-only">
            Four-string bass note positions, open through fret 12. Each button
            names its string, fret, pitch and scale membership.
          </caption>
          <thead>
            <tr>
              <th scope="col">String</th>
              {FRETS.map((fret) => (
                <th key={fret} scope="col">
                  {fret === 0 ? 'Open' : fret}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {STRINGS.map((stringIndex) => {
              const stringName = midiNoteName(
                STANDARD_BASS.tuning[stringIndex]!,
              );
              return (
                <tr key={stringIndex}>
                  <th scope="row">{stringName}</th>
                  {FRETS.map((fret) => {
                    const midiNote = noteAtFret(
                      STANDARD_BASS,
                      stringIndex,
                      fret,
                    );
                    const pitch = midiToPitchClass(midiNote);
                    const isRoot = pitch === root;
                    const inScale = isNoteInScale(midiNote, root, scaleId);
                    const playing = midiNote === activeNote;
                    const membership = isRoot
                      ? 'root'
                      : inScale
                        ? 'scale note'
                        : 'outside scale';
                    return (
                      <td key={fret}>
                        <button
                          type="button"
                          className={`fret-note ${isRoot ? 'fret-root' : inScale ? 'fret-in-scale' : ''} ${playing ? 'fret-playing' : ''}`}
                          aria-label={`${stringName} string, ${fret === 0 ? 'open' : `fret ${fret}`}, ${midiNoteName(midiNote)}, ${membership}. Play note`}
                          onClick={() => onPlayNote(midiNote)}
                        >
                          <span>{noteName(pitch)}</span>
                          <span className="fret-cue" aria-hidden="true">
                            {playing ? '♪' : isRoot ? 'R' : inScale ? '●' : '–'}
                          </span>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

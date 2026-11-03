import {
  getScaleDefinition,
  getScaleSteps,
  NOTE_NAMES,
  SCALE_DEFINITIONS,
  scaleDegreeLabel,
  type PitchClass,
  type ScaleId,
} from '../../domain/music/scales';
import { ScaleCircle, spokenDegree } from './ScaleCircle';

interface ScaleExplorerProps {
  /** Show only the scale circle, without controls or the reading guide. */
  minimal?: boolean;
  root: PitchClass;
  scaleId: ScaleId;
  playbackNotes: readonly number[];
  activeNote: number | null;
  heardNote: number | null;
  onRootChange: (root: PitchClass) => void;
  onScaleChange: (scaleId: ScaleId) => void;
  onPlayNote: (note: number) => void;
}

export function ScaleExplorer({
  minimal = false,
  root,
  scaleId,
  playbackNotes,
  activeNote,
  heardNote,
  onRootChange,
  onScaleChange,
  onPlayNote,
}: ScaleExplorerProps) {
  const intervals: readonly number[] = getScaleDefinition(scaleId).intervals;
  const steps = getScaleSteps(scaleId);

  return (
    <section className="explorer" aria-labelledby="explorer-heading">
      {minimal ? (
        <h2 id="explorer-heading" className="sr-only">
          Find your notes.
        </h2>
      ) : (
        <div className="section-heading">
          <div>
            <p className="eyebrow">01 / Explore</p>
            <h2 id="explorer-heading">Find your notes.</h2>
          </div>
          <span className="instrument-tag">4-string bass · E A D G</span>
        </div>
      )}

      {!minimal && (
        <div className="scale-controls">
          <label>
            Root note
            <select
              value={root}
              onChange={(event) =>
                onRootChange(Number(event.target.value) as PitchClass)
              }
            >
              {NOTE_NAMES.map((name, pitchClass) => (
                <option key={name} value={pitchClass}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Scale
            <select
              value={scaleId}
              onChange={(event) => onScaleChange(event.target.value as ScaleId)}
            >
              {SCALE_DEFINITIONS.map((definition) => (
                <option key={definition.id} value={definition.id}>
                  {definition.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <div className="scale-result">
        <ScaleCircle
          root={root}
          scaleId={scaleId}
          lowRoot={playbackNotes[0]!}
          activeNote={activeNote}
          heardNote={heardNote}
          onPlayNote={onPlayNote}
          onRootChange={onRootChange}
          onScaleChange={onScaleChange}
        />
        {!minimal && (
          <div className="scale-guide">
            <p className="guide-title">Read it like a clock.</p>
            <p className="guide-copy">
              The root sits at 12 o&apos;clock. Each tick clockwise is one
              semitone, one fret higher on the same string. The outline is the
              scale&apos;s shape: long edges are jumps, short edges are small
              steps.
            </p>
            <dl className="scale-formula">
              <div>
                <dt>Degrees</dt>
                <dd>
                  <ol className="pill-list">
                    {intervals.map((semitones) => {
                      const degree = scaleDegreeLabel(semitones);
                      return (
                        <li key={semitones}>
                          <span aria-hidden="true">{degree}</span>
                          <span className="sr-only">
                            {spokenDegree(degree)}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                </dd>
              </div>
              <div>
                <dt>Frets between notes</dt>
                <dd>
                  <ol className="pill-list">
                    {steps.map((step, index) => (
                      <li key={index}>{step}</li>
                    ))}
                  </ol>
                  <span className="formula-end">back to the root</span>
                </dd>
              </div>
            </dl>
            <p className="circle-legend">
              <span>
                <i className="swatch swatch-root" aria-hidden="true" />
                Root (R)
              </span>
              <span>
                <i className="swatch swatch-scale" aria-hidden="true" />
                Scale note
              </span>
              <span>
                <i className="swatch swatch-outside" aria-hidden="true" />
                Outside scale
              </span>
              <span>
                <i className="swatch swatch-playing" aria-hidden="true" />
                Playing now
              </span>
              <span>
                <i className="swatch swatch-heard" aria-hidden="true" />
                Heard now
              </span>
            </p>
            <p className="explorer-hint">
              Start on the root. Play slowly, listen closely, and return home.
            </p>
            <p className="shortcut-hint">
              Tap the center of the circle to change the scale. Press{' '}
              <kbd>1</kbd>–<kbd>{playbackNotes.length}</kbd> to play its notes
              in order, ending on the root an octave up, and <kbd>?</kbd> for
              zen mode. In zen mode, <kbd>Space</kbd> plays or stops the scale,{' '}
              <kbd>↑</kbd> <kbd>↓</kbd> move the root a semitone and{' '}
              <kbd>←</kbd> <kbd>→</kbd> change the scale.
            </p>
          </div>
        )}
      </div>
      {!minimal && (
        <p className="notation-note">
          This early preview uses sharp note names. Key-aware spelling is
          planned.
        </p>
      )}
    </section>
  );
}

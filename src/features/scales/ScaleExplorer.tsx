import { useState } from 'react';
import {
  getScaleNotes,
  NOTE_NAMES,
  noteName,
  SCALE_DEFINITIONS,
  type PitchClass,
  type ScaleId,
} from '../../domain/music/scales';

export function ScaleExplorer() {
  const [root, setRoot] = useState<PitchClass>(0);
  const [scaleId, setScaleId] = useState<ScaleId>('major-pentatonic');
  const notes = getScaleNotes(root, scaleId);
  const scale = SCALE_DEFINITIONS.find(
    (definition) => definition.id === scaleId,
  )!;

  return (
    <section className="explorer" aria-labelledby="explorer-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">01 / Explore</p>
          <h2 id="explorer-heading">Find your notes.</h2>
        </div>
        <span className="instrument-tag">4-string bass · E A D G</span>
      </div>

      <div className="scale-controls">
        <label>
          Root note
          <select
            value={root}
            onChange={(event) =>
              setRoot(Number(event.target.value) as PitchClass)
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
            onChange={(event) => setScaleId(event.target.value as ScaleId)}
          >
            {SCALE_DEFINITIONS.map((definition) => (
              <option key={definition.id} value={definition.id}>
                {definition.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="scale-result" aria-live="polite" aria-atomic="true">
        <div className="scale-summary">
          <h3>
            {noteName(root)} {scale.name.toLowerCase()}
          </h3>
          <span>{notes.length} notes</span>
        </div>
        <ol className="note-list" aria-label="Notes in the selected scale">
          {notes.map((note, index) => (
            <li key={note} className={index === 0 ? 'note note-root' : 'note'}>
              <span className="note-name">{noteName(note)}</span>
              <span className="note-caption">
                {index === 0 ? 'Root' : `Note ${index + 1}`}
              </span>
            </li>
          ))}
        </ol>
      </div>
      <p className="explorer-hint">
        Start on the root. Play slowly, listen closely, and return home.
      </p>
      <p className="notation-note">
        This early preview uses sharp note names. Key-aware spelling is planned.
      </p>
    </section>
  );
}

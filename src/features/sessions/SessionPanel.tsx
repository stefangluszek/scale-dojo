import { useState } from 'react';
import { midiNoteName } from '../../domain/music/playback';
import {
  getScaleDefinition,
  isNoteInScale,
  noteName,
  type PitchClass,
  type ScaleId,
} from '../../domain/music/scales';
import { sessionSummary } from '../../domain/practice/session';
import type { PracticeSessions } from './usePracticeSessions';

function scaleName(root: PitchClass, scaleId: ScaleId) {
  return `${noteName(root)} ${getScaleDefinition(scaleId).name.toLowerCase()}`;
}

function seconds(ms: number) {
  return `${(ms / 1000).toFixed(1)}s`;
}

export function SessionPanel({
  sessions,
  root,
  scaleId,
  minimal = false,
  onStart,
  onStop,
}: {
  sessions: PracticeSessions;
  root: PitchClass;
  scaleId: ScaleId;
  minimal?: boolean;
  onStart: () => void;
  onStop: () => void;
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const running = sessions.status !== 'idle';
  const selected = sessions.status === 'waiting' ? null : sessions.selected;
  const summary = selected && sessionSummary(selected);
  const title = selected && scaleName(selected.root, selected.scaleId);
  if (minimal && !running && !sessions.problem) return null;

  return (
    <section
      className={`sessions${minimal ? ' sessions-minimal' : ''}`}
      aria-labelledby="sessions-heading"
    >
      <div className="session-heading">
        <div>
          <h2 id="sessions-heading" tabIndex={-1}>
            Practice sessions
          </h2>
          {!minimal && (
            <p className="notation-note">
              Capture the notes you play, then review where they fit. Notes stay
              on this device; audio is never recorded.
            </p>
          )}
        </div>
        <button
          className="session-primary"
          onClick={running ? onStop : onStart}
        >
          {running ? 'Stop session' : 'Start session'}
        </button>
      </div>
      <p className="session-status" role="status">
        {sessions.status === 'waiting'
          ? 'Waiting for the microphone. Capture starts when listening is ready.'
          : sessions.status === 'recording'
            ? `Capturing ${title} · ${summary!.total} notes · ${seconds(selected!.durationMs)}. Stop to review.`
            : selected
              ? 'Session ready to review.'
              : 'No sessions yet. Start a session and play your bass.'}
      </p>
      {sessions.problem && (
        <div className="storage-warning" role="alert">
          <p>
            {sessions.problem === 'invalid'
              ? 'Saved sessions could not be read. You can start fresh.'
              : 'Sessions could not be saved on this device. Your notes are available here until you leave the page.'}
          </p>
          <button onClick={sessions.retry}>
            {sessions.problem === 'invalid'
              ? 'Reset saved sessions'
              : 'Retry saving sessions'}
          </button>
        </div>
      )}
      {!minimal && (
        <>
          {!running && (
            <p className="notation-note">
              Next session: {scaleName(root, scaleId)} · 4-string bass. Starting
              a new session keeps earlier sessions.
            </p>
          )}
          {selected && summary && (
            <div className="session-review">
              <div className="session-review-heading">
                <div>
                  <h3>{title}</h3>
                  <p className="notation-note">
                    {selected.instrument.name} ·{' '}
                    {new Date(selected.startedAt).toLocaleString()} ·{' '}
                    {seconds(selected.durationMs)}
                  </p>
                </div>
                {!running && (
                  <button
                    className="session-secondary"
                    onClick={() => setConfirmId(selected.id)}
                  >
                    Clear session
                  </button>
                )}
              </div>
              <p className="notation-note">
                Scale fixed at capture start. Changing the explorer does not
                change this session.
              </p>
              {selected.status === 'interrupted' && (
                <p className="session-interrupted">
                  Capture ended when listening was interrupted or the page
                  closed. The captured notes are kept below.
                </p>
              )}
              {confirmId === selected.id && !running && (
                <div className="session-clear">
                  <p>Clear this session from this device?</p>
                  <button
                    onClick={() => {
                      sessions.clear(selected.id);
                      setConfirmId(null);
                    }}
                  >
                    Confirm clear
                  </button>
                  <button onClick={() => setConfirmId(null)}>
                    Keep session
                  </button>
                </div>
              )}
              <dl className="session-summary">
                <div>
                  <dt>Notes</dt>
                  <dd>{summary.total}</dd>
                </div>
                <div>
                  <dt>In scale</dt>
                  <dd>{summary.inScale}</dd>
                </div>
                <div>
                  <dt>Outside scale</dt>
                  <dd>{summary.outside}</dd>
                </div>
                <div>
                  <dt>In-scale rate</dt>
                  <dd>
                    {summary.percent === null ? '—' : `${summary.percent}%`}
                  </dd>
                </div>
              </dl>
              {summary.total ? (
                <>
                  <p className="notation-note">
                    Each note shows its start time and duration.
                  </p>
                  <ol className="session-notes" aria-label="Captured notes">
                    {selected.events.map((event, index) => {
                      const inScale = isNoteInScale(
                        event.midi,
                        selected.root,
                        selected.scaleId,
                      );
                      return (
                        <li
                          key={index}
                          data-membership={inScale ? 'scale' : 'outside'}
                        >
                          <span
                            className="session-note-index"
                            aria-hidden="true"
                          >
                            {index + 1}
                          </span>
                          <strong>{midiNoteName(event.midi)}</strong>
                          <span className="session-note-membership">
                            {inScale ? 'In scale' : 'Outside scale'}
                          </span>
                          <span className="session-note-time">
                            {seconds(event.startMs)} ·{' '}
                            {seconds(event.endMs - event.startMs)} long
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                </>
              ) : (
                <p className="session-empty">
                  {running
                    ? 'Play one note at a time. Silence and unclear sound are not counted.'
                    : 'No notes captured. Start a new session and play one note at a time.'}
                </p>
              )}
              {!sessions.problem && (
                <p className="notation-note">
                  {running
                    ? 'Saving on this device as you play.'
                    : 'Saved on this device.'}
                </p>
              )}
            </div>
          )}
          {sessions.sessions.length > 0 && (
            <div className="session-history">
              <h3>Session history</h3>
              <ul aria-label="Saved sessions">
                {sessions.sessions.map((session) => (
                  <li key={session.id}>
                    <button
                      disabled={running}
                      aria-pressed={selected?.id === session.id}
                      onClick={() => {
                        sessions.select(session.id);
                        setConfirmId(null);
                      }}
                    >
                      <strong>
                        {scaleName(session.root, session.scaleId)}
                      </strong>
                      <span>
                        {new Date(session.startedAt).toLocaleString()} ·{' '}
                        {session.events.length} notes
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}

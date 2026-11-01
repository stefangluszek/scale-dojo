import { midiNoteName } from '../../domain/music/playback';
import {
  isNoteInScale,
  midiToPitchClass,
  scaleDegreeLabel,
  type PitchClass,
  type ScaleId,
} from '../../domain/music/scales';
import { describeTuning, tuningDirection } from '../../domain/pitch/notes';
import { spokenDegree } from '../scales/ScaleCircle';
import type { ListenProblem, LiveListening } from './useLiveNote';

const PROBLEM_MESSAGES: Record<ListenProblem, string> = {
  unsupported:
    'This browser can’t listen to a microphone. Try a current version of Chrome, Edge, Firefox or Safari.',
  insecure:
    'Microphone access needs a secure page. Open Scale Dojo over HTTPS or on localhost.',
  denied:
    'Microphone access is blocked. Allow it in your browser’s site settings, then start again.',
  'no-input': 'No microphone was found. Connect one, then start again.',
  busy: 'The microphone couldn’t start. It may be in use by another app.',
  failed: 'Listening couldn’t start. Please try again.',
  'device-lost':
    'The microphone was disconnected. Reconnect it, then start again.',
};

interface ListenPanelProps {
  /** Zen mode: a compact row with the button and the current note. */
  minimal?: boolean;
  root: PitchClass;
  scaleId: ScaleId;
  listening: LiveListening;
  /** Fretboard positions that match the heard pitch. */
  fretboardMatches: number;
}

function Membership({
  midi,
  root,
  scaleId,
}: {
  midi: number;
  root: PitchClass;
  scaleId: ScaleId;
}) {
  const distance = midiToPitchClass(midi) - root;
  const degree = scaleDegreeLabel(distance);
  if (degree === '1') {
    return (
      <span className="live-membership" data-membership="root">
        <i aria-hidden="true">R</i> Root
      </span>
    );
  }
  if (isNoteInScale(midi, root, scaleId)) {
    return (
      <span className="live-membership" data-membership="scale">
        <i aria-hidden="true">●</i>{' '}
        <span>
          In the scale · degree <span aria-hidden="true">{degree}</span>
          <span className="sr-only">{spokenDegree(degree)}</span>
        </span>
      </span>
    );
  }
  return (
    <span className="live-membership" data-membership="outside">
      <i aria-hidden="true">–</i> Outside the scale
    </span>
  );
}

/** Start/Stop listening and what the microphone hears right now. */
export function ListenPanel({
  minimal = false,
  root,
  scaleId,
  listening,
  fretboardMatches,
}: ListenPanelProps) {
  const { status, reading, level, gate, problem, paused, processing } =
    listening;
  const running = status !== 'idle';
  const note =
    status === 'listening' && reading.kind === 'note' ? reading : null;

  let message = '';
  if (status === 'starting') message = 'Waiting for microphone permission…';
  else if (status === 'listening') {
    message =
      reading.kind === 'unclear'
        ? 'Listening… no clear note yet.'
        : 'Listening. Play a note.';
  } else if (paused) {
    message = 'Listening stopped while the page was in the background.';
  } else if (!minimal && !problem) {
    message = 'Microphone off.';
  }

  return (
    <section
      className="listen"
      aria-labelledby="listen-heading"
      data-status={status}
    >
      {minimal ? (
        <h2 id="listen-heading" className="sr-only">
          Play and listen
        </h2>
      ) : (
        <div className="listen-intro">
          <h3 id="listen-heading">Play &amp; listen</h3>
          <p className="notation-note">
            Play one note at a time near your microphone. Listening happens on
            this device. Sessions save detected notes; audio is never recorded
            or sent.
          </p>
        </div>
      )}

      <button
        type="button"
        className="listen-toggle"
        onClick={running ? listening.stop : listening.start}
      >
        {running ? (
          <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <rect x="4" y="4" width="8" height="8" rx="1.5" />
          </svg>
        ) : (
          <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <rect x="5.5" y="1.5" width="5" height="8.5" rx="2.5" />
            <path d="M3 7.5a5 5 0 0 0 10 0M8 12.5v2.5" />
          </svg>
        )}
        {running ? 'Stop listening' : 'Start listening'}
      </button>

      <div className="live-readout" data-active={running || undefined}>
        {/* Announces the note and its scale membership; tuning changes too
            often to announce. */}
        <p className="live-heard" role="status">
          {note ? (
            <>
              <span className="live-note-name">
                <span className="sr-only">Hearing </span>
                {midiNoteName(note.midi)}
              </span>
              <Membership midi={note.midi} root={root} scaleId={scaleId} />
            </>
          ) : (
            message && <span className="live-message">{message}</span>
          )}
        </p>
        {note && (
          <p
            className="live-tuning"
            data-direction={tuningDirection(note.cents)}
          >
            <span className="tuning-meter" aria-hidden="true">
              <span
                style={{
                  left: `${50 + Math.max(-50, Math.min(50, note.cents))}%`,
                }}
              />
            </span>
            {describeTuning(note.cents)}
          </p>
        )}
        {!minimal && note && (
          <p className="live-positions">
            {fretboardMatches > 0
              ? `Ringed at ${fretboardMatches === 1 ? 'its one position' : `all ${fretboardMatches} matching positions`} on the fretboard. The microphone hears the pitch, not which string you used.`
              : 'Above fret 12, so it isn’t on the fretboard shown.'}
          </p>
        )}
        {!minimal && status === 'listening' && (
          <span
            className="level-meter"
            aria-hidden="true"
            title="Input level. Sound left of the mark counts as silence."
          >
            <span style={{ width: `${level * 100}%` }} />
            <i style={{ left: `${gate * 100}%` }} />
          </span>
        )}
      </div>

      {problem && (
        <p className="audio-error" role="alert">
          {PROBLEM_MESSAGES[problem]}
        </p>
      )}
      {!minimal && processing.length > 0 && (
        <p className="listen-warning">
          Your browser kept {processing.join(', ')} on. It can cut off or bend
          low notes, so readings may be less reliable.
        </p>
      )}
    </section>
  );
}

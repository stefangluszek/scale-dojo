import { midiNoteName } from '../../domain/music/playback';

interface ScalePlaybackProps {
  notes: readonly number[];
  tempo: number;
  isPlaying: boolean;
  activeNote: number | null;
  error: string;
  onTempoChange: (tempo: number) => void;
  onPlay: (notes: readonly number[]) => void;
  onStop: () => void;
}

export function ScalePlayback({
  notes,
  tempo,
  isPlaying,
  activeNote,
  error,
  onTempoChange,
  onPlay,
  onStop,
}: ScalePlaybackProps) {
  return (
    <section className="playback" aria-labelledby="playback-heading">
      <div>
        <h3 id="playback-heading">Hear the scale</h3>
        <p className="notation-note">
          One octave, {midiNoteName(notes[0]!)}–{midiNoteName(notes.at(-1)!)}.
          Synthesized tones, one note per beat.
        </p>
      </div>
      <label className="tempo-control">
        Tempo · {tempo} BPM
        <input
          type="range"
          min="40"
          max="240"
          step="1"
          value={tempo}
          aria-label="Tempo"
          aria-valuetext={`${tempo} beats per minute`}
          onChange={(event) => onTempoChange(Number(event.target.value))}
        />
      </label>
      <div className="playback-buttons">
        <button type="button" onClick={() => onPlay(notes)}>
          ↑ Play ascending
        </button>
        <button type="button" onClick={() => onPlay([...notes].reverse())}>
          ↓ Play descending
        </button>
        <button type="button" onClick={onStop} disabled={!isPlaying}>
          Stop playback
        </button>
      </div>
      <p className="playback-status" role="status">
        {isPlaying ? 'Playing' : 'Ready to play'}
        {activeNote !== null && (
          <span aria-hidden="true"> · {midiNoteName(activeNote)}</span>
        )}
      </p>
      {error && (
        <p className="audio-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

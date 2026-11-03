import { midiNoteName } from '../../domain/music/playback';

interface ScalePlaybackProps {
  notes: readonly number[];
  tempo: number;
  volume: number;
  isPlaying: boolean;
  activeNote: number | null;
  error: string;
  onTempoChange: (tempo: number) => void;
  onVolumeChange: (volume: number) => void;
  onPlay: (notes: readonly number[]) => void;
  onStop: () => void;
}

export function ScalePlayback({
  notes,
  tempo,
  volume,
  isPlaying,
  activeNote,
  error,
  onTempoChange,
  onVolumeChange,
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
      <div className="playback-sliders">
        <label className="slider-control">
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
        <label className="slider-control">
          Volume · {volume}%
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={volume}
            aria-label="Volume"
            aria-valuetext={`${volume} percent`}
            onChange={(event) => onVolumeChange(Number(event.target.value))}
          />
        </label>
      </div>
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

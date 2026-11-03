import { useState } from 'react';
import { useMetronome } from './useMetronome';

export function MetronomeControls({
  tempo,
  onTempoChange,
}: {
  tempo: number;
  onTempoChange: (tempo: number) => void;
}) {
  const metronome = useMetronome(tempo);
  // Keep partial edits (including an empty field) without changing the beat.
  const [draft, setDraft] = useState<string | null>(null);
  const action = metronome.isPlaying ? 'Stop metronome' : 'Start metronome';

  return (
    <>
      <div className="metronome" role="group" aria-label="Metronome">
        <button
          type="button"
          className="metronome-toggle"
          aria-label={action}
          title={action}
          aria-pressed={metronome.isPlaying}
          onClick={metronome.isPlaying ? metronome.stop : metronome.start}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            {metronome.isPlaying ? (
              <rect x="4" y="4" width="8" height="8" rx="1.5" />
            ) : (
              <path d="M5 2.5 13 8l-8 5.5z" />
            )}
          </svg>
        </button>
        <label className="metronome-tempo">
          <input
            type="number"
            inputMode="numeric"
            min="40"
            max="240"
            step="1"
            aria-label="Metronome tempo"
            title="Tempo: 40–240 beats per minute"
            value={draft ?? tempo}
            onChange={(event) => {
              const value = event.target.value;
              setDraft(value);
              const bpm = Number(value);
              if (Number.isInteger(bpm) && bpm >= 40 && bpm <= 240) {
                onTempoChange(bpm);
              }
            }}
            onBlur={() => {
              const bpm = Number(draft);
              if (draft?.trim() && Number.isFinite(bpm)) {
                onTempoChange(Math.max(40, Math.min(240, Math.round(bpm))));
              }
              setDraft(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
            }}
          />
          <span>BPM</span>
        </label>
      </div>
      {metronome.error && (
        <p className="audio-error" role="alert">
          {metronome.error}
        </p>
      )}
    </>
  );
}

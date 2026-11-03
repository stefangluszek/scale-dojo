# Browser audio

Each adapter owns a separate `AudioContext`:

- `NotePlayer.ts` creates/resumes output on user activation, schedules triangle tones through a shared volume gain, and handles replacement/cancellation. `setVolume` takes 0–100% and applies to notes already sounding. Stop invalidates pending startup; voices disconnect after use and the context closes on teardown.
- `Metronome.ts` schedules short clicks against the audio clock with a 100 ms lookahead. Tempo edits update the next beat without restarting; delayed timers skip missed beats. Stop cancels queued clicks and pending startup, and teardown closes its context.
- `MicrophoneInput.ts` requests input from a user action, asks for voice processing off, and delivers analyser windows every 40 ms. `MicrophoneError.problem` identifies unsupported/insecure contexts, denied permission, missing/busy input, or other failure. `onEnded` reports device loss. Stop releases tracks, nodes, timer, and context; a late permission grant releases its stream.

Pitch analysis belongs in `src/domain/pitch/`. These adapters do not store or send audio. See the [architecture](../../../docs/architecture.md#microphone-pipeline).

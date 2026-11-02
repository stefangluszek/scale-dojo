# Browser audio

Each adapter owns a separate `AudioContext`:

- `NotePlayer.ts` creates/resumes output on user activation, schedules triangle tones, and handles replacement/cancellation. Stop invalidates pending startup; voices disconnect after use and the context closes on teardown.
- `MicrophoneInput.ts` requests input from a user action, asks for voice processing off, and delivers analyser windows every 40 ms. `MicrophoneError.problem` identifies unsupported/insecure contexts, denied permission, missing/busy input, or other failure. `onEnded` reports device loss. Stop releases tracks, nodes, timer, and context; a late permission grant releases its stream.

Pitch analysis belongs in `src/domain/pitch/`. These adapters do not store or send audio. See the [architecture](../../../docs/architecture.md#microphone-pipeline).

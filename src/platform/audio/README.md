# Browser audio boundary

Two independent responsibilities, each with its own `AudioContext`:

- `NotePlayer.ts` is stage 1 synthesized output. It lazily creates/resumes Web Audio on user activation, schedules triangle tones with gain envelopes, replaces/cancels playback, disconnects voices on Stop or completion, and closes its context on teardown. Pending startup is invalidated on Stop. Frequency conversion comes from the pure music domain.
- `MicrophoneInput.ts` is stage 2 acquisition. Call `start()` from a user action: it creates and resumes its context before requesting the microphone, asks for echo cancellation, noise suppression, and automatic gain control off, and reports any the browser kept on. It delivers the newest analysis window every 40 ms from an `AnalyserNode` that isn't connected to the speakers. Failures become `MicrophoneError`s with a `problem` (`unsupported`, `insecure`, `denied`, `no-input`, `busy`, `failed`), and a track that ends on its own calls `onEnded`. `stop()` releases the tracks, nodes, timer, and context, and cancels a pending permission request.

Pitch estimation lives in `src/domain/pitch/` and runs on the delivered windows, so it is testable without a microphone. Nothing here records, stores, or sends audio.

See [architecture](../../../docs/architecture.md) and [stage 2](../../../docs/implementation-plan.md#stage-2--microphone-input-and-live-note-feedback).

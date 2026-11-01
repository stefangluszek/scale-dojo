# Browser audio boundary

`NotePlayer.ts` implements stage 1 synthesized output only. It lazily creates/resumes Web Audio on user activation, schedules triangle tones with gain envelopes, replaces/cancels playback, disconnects voices on Stop or completion, and closes its context on teardown. Pending startup is invalidated on Stop. Frequency conversion comes from the pure music domain. There is no microphone request, pitch detection, session recording, or audio persistence.

Stage 2 will add permission requests, media tracks, input contexts, device states, and sample acquisition here. Keep pitch estimation independently testable with deterministic samples. Expose observations to the practice feature without importing UI components or owning scale selection. Request microphone access only after a user action and release input resources on Stop and teardown.

See [architecture](../../../docs/architecture.md) and [stage 2](../../../docs/implementation-plan.md#stage-2--microphone-input-and-live-note-feedback).

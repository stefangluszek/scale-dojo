# Browser storage boundary

Version-1 localStorage envelopes store preferences (`scale-dojo.settings`) and detected-note sessions (`scale-dojo.sessions`) separately. Validators reject malformed data and unknown schemas before it reaches the app. `useStoredState` reads once, saves explicit changes synchronously, preserves in-memory state on failure, and supports retry. Failed reads never trigger an automatic overwrite.

Settings include root, scale, tempo, and zen/full-page view. Sessions retain their original scale and instrument, absolute pitches, event timing, duration, and completion state. Session lifecycle and classification live in features/domain code; this boundary owns serialization, storage access, validation, and recovery. Nothing here stores microphone audio or resumes listening.

See [architecture](../../../docs/architecture.md#state-and-persistence) and [stage 3](../../../docs/implementation-plan.md#stage-3--capture-and-review-practice-sequences).

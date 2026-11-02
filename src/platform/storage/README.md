# Browser storage

Version-1 localStorage envelopes keep preferences (`scale-dojo.settings`) and detected-note sessions (`scale-dojo.sessions`) separate. Validators reject malformed data and unknown schemas. `useStoredState` reads once, saves explicit changes, preserves in-memory state on failure, and supports retry. Failed reads never trigger an automatic overwrite.

This module owns serialization, validation, and recovery. Session lifecycle and classification belong in features/domain code. It stores no raw audio and never resumes listening.

See [state and persistence](../../../docs/architecture.md#state-and-persistence).

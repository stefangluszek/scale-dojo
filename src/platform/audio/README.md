# Browser audio boundary

Reserved for stage 2. No microphone or audio processing is implemented in the bootstrap.

Own permission requests, media tracks, audio context setup/cleanup, device states, and sample acquisition here. Keep pitch estimation independently testable with deterministic samples. Expose observations to the practice feature without importing UI components or owning scale selection. Request access only after a user action and release resources on Stop and teardown.

See [architecture](../../../docs/architecture.md) and [stage 2](../../../docs/implementation-plan.md#stage-2--microphone-input-and-live-note-feedback).

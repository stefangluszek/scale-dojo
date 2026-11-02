# Live practice

`useLiveNote` starts `MicrophoneInput` from a user action, passes frames through `detectPitch` and `NoteStabilizer`, and stops on Stop, device loss, page hiding, or unmount. It publishes stabilized frames and readiness/stop callbacks to session capture.

`ListenPanel` shows controls, note/octave, scale membership, tuning, and input problems; its `minimal` prop serves zen mode. Silence and unclear sound are never wrong notes. Live membership follows current selection; sessions keep their own starting context.

See the [pipeline](../../../docs/architecture.md#microphone-pipeline) and [testing notes](../../../docs/testing.md).

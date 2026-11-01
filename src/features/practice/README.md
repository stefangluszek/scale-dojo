# Live practice

Stage 2 live listening. `useLiveNote` runs the listening lifecycle: it starts `MicrophoneInput` from a user action, passes each frame through `detectPitch` and `NoteStabilizer`, and stops on Stop, device loss, a hidden page, or unmount. `ListenPanel` shows the Start/Stop button, the heard note with octave, its scale membership (text and shape as well as color), its tuning separately, and permission or device problems. It takes a `minimal` prop for zen mode.

Silence and unclear sound are never shown as wrong notes. The heard pitch is passed to the circle and fretboard as a candidate; a pitch can't tell which string was played. Scale membership follows the current selection; freezing a session's scale belongs to stage 3.

See [stage 2](../../../docs/implementation-plan.md#stage-2--microphone-input-and-live-note-feedback) for the detector benchmark, measured accuracy and latency, and known limitations.

# Practice sessions

Stage 3 is implemented. Each listening run is one session: `usePracticeSessions` begins capture when the microphone is ready and finishes it when listening stops, discarding runs with no detected notes. It owns note events, history selection, saving, and clear behavior. `SessionPanel` has no capture controls of its own; it shows the live capture status, a summary, note-by-note review, and saved history, which stays browsable while listening. Zen mode shows it only for storage problems.

`SessionCapture` in `domain/practice` segments stabilized readings using their monotonic frame timestamps. It freezes the selected scale and instrument, groups held notes, and preserves repeats separated by silence. `useLiveNote` publishes every reading and lifecycle change so stopping or losing the microphone also ends capture. Browser storage checkpoints notes, not raw audio; reload restores unfinished captures as interrupted reviews.

See [stage 3](../../../docs/implementation-plan.md#stage-3--capture-and-review-practice-sequences).

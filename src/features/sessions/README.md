# Practice sessions

Stage 3 is implemented. `usePracticeSessions` owns pending capture, note events, history selection, saving, and stop/clear behavior. `SessionPanel` provides capture controls, a summary, note-by-note review, and saved history, with compact Stop controls during zen capture.

`SessionCapture` in `domain/practice` segments stabilized readings using their monotonic frame timestamps. It freezes the selected scale and instrument, groups held notes, and preserves repeats separated by silence. `useLiveNote` publishes every reading and lifecycle change so stopping or losing the microphone also ends capture. Browser storage checkpoints notes, not raw audio; reload restores unfinished captures as interrupted reviews.

See [stage 3](../../../docs/implementation-plan.md#stage-3--capture-and-review-practice-sequences).

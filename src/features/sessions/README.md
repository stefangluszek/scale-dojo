# Practice sessions

`usePracticeSessions` begins capture when the microphone is ready and finishes when listening stops, discarding runs without notes. It owns history selection, saving, and clearing. `SessionPanel` shows status, summaries, and note review below the fretboard on the full page; history stays browsable while listening. Zen mode shows the panel only for storage problems.

`SessionCapture` groups stabilized readings using monotonic timestamps and freezes the starting scale and instrument. Held notes stay together; repeats separated by silence stay separate. Storage checkpoints note events, never raw audio; reload restores unfinished captures as interrupted reviews.

See [state and persistence](../../../docs/architecture.md#state-and-persistence).

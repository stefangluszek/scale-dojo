# Architecture

Scale Dojo is a static React/TypeScript app built with Vite and plain CSS. Web Audio handles playback and microphone input; localStorage holds settings and detected-note sessions. It has no backend, account system, or client-side router.

## Code layout

```text
src/
  app/                  Screen composition, shared state, styles, shortcuts
  domain/
    music/              Notes, scales, membership, playback sequences
    instruments/        Tuning and fret-position mapping
    pitch/              Pitch detection, stabilization, tuning
    practice/           Session events, frozen context, summaries
  features/
    scales/             Scale circle, picker, playback controls
    instruments/        Accessible bass fretboard
    practice/           Listening, metronome controls, and feedback
    sessions/           Capture, history, review
  platform/
    audio/              Web Audio output and microphone acquisition
    storage/            Versioned persistence, validation, recovery
  test/                 Shared setup and deterministic audio fixtures
tests/browser/          Production-build Playwright tests
```

Domain code takes plain data and has no React or browser dependencies. Features connect domain functions to UI and platform adapters. `App.tsx` shares selection, playback, and heard-note state across views. Zen and full views use the same component tree to preserve focus, listening, and highlights.

## Notes and display

Scale membership uses pitch classes (twelve semitones, independent of octave). Fret positions, playback, and tuning use absolute MIDI pitches. Scales store semitone intervals and major/minor quality; degree labels are relative to the major scale. Display labels currently use sharps.

Standard bass tuning is E1–A1–D2–G2, MIDI `[28, 33, 38, 43]`, ordered low to high. Each fret adds one semitone. The UI shows the highest string first. Multiple positions can produce the same pitch, so microphone feedback marks every match. The circle uses pitch classes; the fretboard uses exact pitches. Solid rings mark playback, dashed rings mark heard notes.

Roots and scale membership use text and shape as well as color. Note buttons have accessible labels and keyboard support. The circle picker uses native radio groups, applies choices immediately, and returns focus on Done/Escape. Only the fretboard scrolls horizontally on narrow screens.

## Playback

`domain/music/playback.ts` builds one octave from the first root at or above E1, including the upper root. Descending playback reverses it. Circle notes use that playback octave; frets play their mapped pitch.

`NotePlayer` creates/resumes its `AudioContext` on user activation. Triangle oscillators and gain envelopes are scheduled against the audio clock at 40–240 BPM and feed one output gain set by the volume preference (squared, so slider steps sound even), which can change mid-note; UI timers only update highlights. New playback replaces the old sequence. Stop, selection/tempo changes, page hiding, and teardown cancel playback, including pending startup. Voices are disconnected after use; the context is reused until teardown. Audio failures leave the visual explorer usable.

The independent `Metronome` adapter queues short clicks 100 ms ahead using the audio clock, with a 25 ms scheduler timer. Live tempo edits adjust the next beat; a stalled timer skips missed beats. `useMetronome` stops clicks on page hiding, page exit, or unmount, and invalidates pending startup. Its controls share the saved 40–240 BPM tempo with scale playback, in both views.

## Microphone pipeline

```text
MicrophoneInput → PCM windows → detectPitch → NoteStabilizer → live feedback
                                                ↓
                                          SessionCapture → local history
```

- `MicrophoneInput` creates/resumes a separate audio context before awaiting permission. It requests voice processing off, reports settings the browser keeps on, and polls an analyser every 40 ms without connecting the microphone to speakers. Stop releases tracks, nodes, timer, and context; late permission grants release their streams.
- `detectPitch` uses the McLeod Pitch Method, chosen over YIN in the [benchmark](testing.md#detector-benchmark). It returns frequency and clarity, or no reliable estimate. Windows span at least 75 ms: 4096 samples at 44.1/48 kHz.
- `NoteStabilizer` accepts clarity ≥ 0.8 within 38–420 Hz. A new note needs at least two trusted windows spanning 40 ms. A held note tolerates ±70 cents and dropouts shorter than 120 ms; tuning is the median of five windows.
- The noise gate sits 10 dB above an estimated floor, initially −60 dBFS. The floor falls immediately to quieter windows and rises at most 3 dB/s without a trusted note. Digital silence below −90 dBFS is ignored; the gate never falls below −70 dBFS. Silent windows skip detection.
- `useLiveNote` owns start/stop and error handling, feeds the pipeline, and publishes every stabilized frame to capture. `ListenPanel` announces the note and membership without announcing every tuning change. Silence and unclear readings are never classified as wrong notes.

Stop, device loss, page hiding, and unmount end listening. Live membership follows current selection; session membership uses its saved context. Analysis runs on the main thread. Raw audio is never retained or sent.

## State and persistence

`useStoredState` validates version-1 envelopes for `scale-dojo.settings` and `scale-dojo.sessions`. Settings save root, scale, tempo, volume, and view immediately; settings saved before volume existed load with the default volume. Unreadable data is not overwritten on mount; failed saves preserve in-memory state and offer retry. Clearing a session leaves preferences intact.

`SessionCapture` groups stabilized readings into timed notes. Cents changes keep the same event; a different pitch, silence, or unclear sound ends it. Event timing uses a monotonic clock, while a wall-clock timestamp labels history. Root, scale, and instrument/tuning are copied when the microphone becomes ready and remain fixed for that session.

`usePracticeSessions` begins capture from `useLiveNote`'s readiness callback and finalizes it when listening stops, on pagehide, or on teardown. Permission failure/cancellation creates no session; a run without notes is discarded. History remains browsable during capture, but the active session cannot be cleared.

Note boundaries and one-second checkpoints save events, timing, context, and completion state. Reload turns unfinished checkpoints into interrupted reviews and drops checkpoints with no notes. At most the latest checkpoint interval may be lost after a crash. Listening never resumes automatically. Validators reject unknown schemas, invalid context/timing, overlapping events, and duplicate IDs. There is no cross-tab merge or cloud sync.

## Validation and deployment

Vitest and Testing Library cover domain rules and visible interactions; Playwright exercises the production build on desktop/mobile Chromium with synthesized output and a fake microphone. See [testing notes](testing.md) for audio measurements and real-device gaps, and [contributing](../CONTRIBUTING.md) for commands and deployment.

GitHub Pages publishes `dist/` under `/scale-dojo/` after successful CI on `main`, using the tested commit. Adding client-side routes would require handling Pages' lack of arbitrary SPA route fallback.

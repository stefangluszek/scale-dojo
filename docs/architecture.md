# Architecture

## Scope and decisions

Scale Dojo is a client-only scale-practice app deployed as static assets on GitHub Pages. Stage 0 established the music and bass domain, scale selection, and repeatable checks. Stage 1 adds the accessible bass fretboard and synthesized note/scale playback. Microphone integration, live scoring, session review, and additional instrument views follow in separate stages.

| Choice                      | Reason                                                                                   |
| --------------------------- | ---------------------------------------------------------------------------------------- |
| React                       | Component composition for selectors, instrument views, and practice feedback.            |
| TypeScript                  | Explicit note, scale, and instrument contracts across the UI and future audio pipeline.  |
| Vite                        | Fast local development and a static production build suitable for Pages.                 |
| Plain CSS                   | Responsive styling without another framework or design-system dependency.                |
| Vitest + Testing Library    | Deterministic domain tests and tests driven by visible UI behavior.                      |
| npm + Node.js 24.15+ (24.x) | One package manager, a checked-in lockfile, and a consistent supported runtime.          |
| Browser APIs                | Synthesized output, future microphone processing and local persistence without a server. |

SSR, a database server, authentication, a router, and a global state library are unnecessary for the current scope. Start with React state near its consumers; introduce additional infrastructure when a concrete feature needs it. Framework-independent music functions are the important boundary, not a large plugin framework.

## Module boundaries

```text
app → features → domain
             ↘ platform
```

- `app/` composes the screen and app-wide styles. Root, scale, and tempo state live in `App.tsx`, shared by the scale circle, fretboard, and playback controls. `App.tsx` also marks the practice area with the scale's quality (`data-quality="major"` or `"minor"`) so CSS can give the circle and fretboard the same mood colors. Selection changes stop playback before updating state.
- `domain/music/` contains pure functions and scale data. It does not import React, browser APIs, storage, or audio acquisition.
- `domain/instruments/` defines instruments and maps their positions to notes. The standard four-string bass establishes the first implementation.
- `features/scales/` presents root/scale controls, the scale circle with its reading guide, tempo and playback controls. `ScaleCircle` places the twelve semitones clockwise from the root at 12 o'clock, so a scale's polygon is identical for every root. Its notes are native buttons in two labeled lists (scale notes in degree order, then notes outside the scale). `useNotePlayback` owns UI playback state and coordinates the audio adapter, including cancellation, recoverable errors, hidden-page handling, and unmount cleanup.
- `features/instruments/` renders the standard bass from fret 0 through 12 with `noteAtFret` and the shared membership functions. A semantic table provides string/fret context and labeled native buttons. Roots use text, shape, and color. Only the fretboard scrolls horizontally on narrow screens; its string headers stay visible.
- `features/practice/` will turn stable pitch observations into live feedback. It should depend on a narrow audio-facing contract rather than requesting the microphone inside visual components.
- `features/sessions/` will capture and review detected-note events and use a storage adapter when persistence is added.
- `platform/audio/` owns Web Audio output through `NotePlayer`. It uses pure domain frequency conversion but does not own selection or presentation. Future microphone acquisition belongs here as a separate responsibility.
- `platform/storage/` will own serialization and browser persistence. It does not decide whether a played note is in a scale.
- `test/` contains shared test setup. Tests live beside the behavior they exercise.

Practice, sessions, and storage remain documentation-only placeholders. Avoid mock controls that imply a working microphone or recorder.

## Notes and scales

Pitch class and absolute pitch are different concepts. A pitch class identifies one of twelve semitones independent of octave; an absolute pitch, represented by a MIDI note number, retains the octave. Scale membership compares pitch classes. Instrument mapping and eventual tuning feedback need absolute pitches.

Scale definitions contain semitone intervals from the root and a quality (`major` or `minor`, from the third above the root). Major and minor pentatonic are separate choices. Degree labels compare each interval with the major scale on the same root (3 semitones is ♭3), and step sizes are the semitone gaps between consecutive notes, ending with the step back to the upper root. Domain tests verify known results and transpositions across the octave boundary. Display spelling is a presentation concern; the initial spelling convention uses sharps for accidentals. A future key-aware spelling implementation must preserve enharmonic equivalence in scale membership.

The initial bass tuning is E1–A1–D2–G2, MIDI `[28, 33, 38, 43]`, ordered from lowest to highest string. One fret raises pitch by one semitone. A visualization can choose its screen orientation without changing this definition.

More than one string/fret position can produce the same absolute pitch. Microphone pitch detection cannot establish which position was played. When microphone feedback is added, the fretboard should show matching candidates, or use an explicitly selected practice position, rather than assert a particular fingering. Pitch-class highlighting and exact-pitch highlighting should remain distinguishable. The scale circle is a pitch-class view and highlights a playing note in any octave; the fretboard highlights exact pitches.

## Synthesized playback (stage 1)

`domain/music/playback.ts` converts MIDI pitch to frequency/name and constructs one octave from the first selected root at or above the instrument's lowest pitch, including its upper root. With standard bass tuning, all sequences fit inside the displayed E1–G3 range. Descending playback reverses the same absolute pitches. Each circle note plays its pitch in the playback octave (the low root plus its distance in semitones); each fret plays its exact mapped pitch, including outside-scale notes.

`NotePlayer` lazily creates one `AudioContext` on a play gesture and resumes it before scheduling. It schedules triangle oscillators against the audio clock at one note per beat (40–240 BPM), with short gain envelopes to soften note boundaries. UI timers only update visual feedback; they do not time the sound. Every matching absolute-pitch position receives the playing cue, independently of scale/root membership.

New playback replaces the old sequence. Stop clears timers, stops and disconnects oscillators and gain nodes, and invalidates pending startup. The context is reused while the screen is mounted and closed at teardown. Root/scale/tempo changes and page backgrounding stop playback. A request identifier prevents a late audio-start failure from replacing a newer UI state. No audio is acquired, stored, or sent anywhere. Unsupported or failed audio startup leaves scale exploration usable.

## Future microphone pipeline

```text
Microphone → PCM samples → pitch estimate → stable note event
                                            ↓
                              scale classification and UI
                                            ↓
                                  optional session capture
```

Each step has a different responsibility:

1. **Acquisition:** request permission after a user action; handle pending, denied, missing, disconnected, and unavailable input; stop tracks and release audio resources on Stop and teardown.
2. **Estimation:** convert a sample window into frequency and confidence, or no reliable estimate. Benchmark an established monophonic detector before choosing an algorithm or dependency.
3. **Stabilization:** gate silence/noise, reject uncertain results, and reduce flicker without merging deliberately repeated notes.
4. **Classification:** map the estimated pitch to a note, retain tuning deviation separately, and check scale membership. An in-scale note can still be sharp or flat.
5. **Capture:** record meaningful note events with timestamps and the session's selected scale and instrument context, rather than one event per analysis frame.

Low bass is a primary acceptance criterion. E1 is about 41.2 Hz and a possible future five-string B0 is about 30.9 Hz. Longer sample windows improve the amount of low-frequency evidence but add latency. Harmonic-rich bass signals can lead to octave errors, so synthetic sine-wave tests alone are insufficient. A largest-FFT-bin approach should not be treated as a reliable pitch detector.

Request echo cancellation, noise suppression, and automatic gain control off as preferences, then inspect supported constraints and actual track settings. Hardware and browsers may not honor every preference. `AudioWorklet` is a possible processing boundary when measurements show that main-thread analysis is inadequate; it is not a bootstrap dependency.

Audio stays on the device by design. The default meaning of a recorded session is a sequence of detected note events, not an audio file. Raw audio retention, if introduced later, needs its own user-facing controls and storage design.

## State and persistence

The current root and scale are ephemeral React state. Stage 3 introduces an explicit session lifecycle and a versioned session data format. Save a snapshot of the selected scale and instrument with each session so later selection changes cannot silently reinterpret its results. Persistence should handle malformed data, unavailable storage, and schema upgrades; the first implementation can choose localStorage or IndexedDB based on the measured payload size.

## Testing and deployment

`npm run check` checks formatting, runs unit/component tests with coverage, type-checks (including browser tests/config), and builds. Coverage thresholds are 85% for statements, branches, functions, and lines; these thresholds supplement behavior-based tests. Tests cover music mapping, UI selection, playback sequences/timing, cancellation, pending startup, errors and cleanup.

`npm run test:browser` builds and starts a fresh production preview under `/scale-dojo/`. Playwright runs desktop Chromium (1440×1000) and mobile Chromium emulation (390×844, also checking 320px overflow). Smoke tests exercise selectors, labeled notes, scrolling, keyboard activation, real synthesized output, ascending/descending pitch order and tempo, cancellation, and unavailable audio. Test instrumentation observes real audio nodes and an analyser signal; unit tests mock the audio API for deterministic lifecycle checks. Neither is a physical-device listening test. Stage 2 adds microphone fixtures and real-instrument validation.

CI checks changes without deploying them. The Pages workflow is manually dispatched after the repository's Pages source is configured as GitHub Actions. Vite's base is `/scale-dojo/`, and the deployment artifact is `dist/`. There is no client-side routing requirement at present; if routing is added, account for Pages' lack of arbitrary SPA route fallback.

## References

- [Vite: static deployment and GitHub Pages](https://vite.dev/guide/static-deploy#github-pages)
- [React: thinking in components and state](https://react.dev/learn/thinking-in-react)
- [Vitest: coverage configuration](https://vitest.dev/guide/coverage)
- [Testing Library: guiding principles](https://testing-library.com/docs/guiding-principles/)
- [MDN: microphone permission and secure contexts](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
- [MDN: media track constraints](https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints)
- [MDN: analyser window sizes](https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode/fftSize)
- [MDN: AudioWorklet](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet)

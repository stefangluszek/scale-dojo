# Architecture

## Scope and decisions

Scale Dojo is a client-only scale-practice app deployed as static assets on GitHub Pages. Stage 0 established the music and bass domain, scale selection, and repeatable checks. Stage 1 adds the accessible bass fretboard and synthesized note/scale playback. Stage 2 adds microphone listening with live note, tuning, and scale feedback. Session review and additional instrument views follow in separate stages.

| Choice                      | Reason                                                                                   |
| --------------------------- | ---------------------------------------------------------------------------------------- |
| React                       | Component composition for selectors, instrument views, and practice feedback.            |
| TypeScript                  | Explicit note, scale, and instrument contracts across the UI and future audio pipeline.  |
| Vite                        | Fast local development and a static production build suitable for Pages.                 |
| Plain CSS                   | Responsive styling without another framework or design-system dependency.                |
| Vitest + Testing Library    | Deterministic domain tests and tests driven by visible UI behavior.                      |
| npm + Node.js 24.15+ (24.x) | One package manager, a checked-in lockfile, and a consistent supported runtime.          |
| Browser APIs                | Synthesized output, microphone processing and future local persistence without a server. |

SSR, a database server, authentication, a router, and a global state library are unnecessary for the current scope. Start with React state near its consumers; introduce additional infrastructure when a concrete feature needs it. Framework-independent music functions are the important boundary, not a large plugin framework.

## Module boundaries

```text
app → features → domain
             ↘ platform
```

- `app/` composes the screen and app-wide styles. Root, scale, and tempo state live in `App.tsx`, shared by the scale circle, fretboard, and playback controls. `App.tsx` also marks the practice area with the scale's quality (`data-quality="major"` or `"minor"`) so CSS can give the circle and fretboard the same mood colors. Selection changes stop playback before updating state; they don't stop listening, and the heard note is reclassified against the new scale. `App.tsx` passes the heard pitch (only while a note is held) to the circle and fretboard and counts its visible fretboard positions for the listening panel. The zen/full view is React state in `App.tsx`: zen (the default) shows only the scale circle, a compact listening row, and the fretboard, and the `?` key or the header button toggles the full page. `useKeyboardShortcuts` maps keys to actions: `?` toggles the view, and `1` to `n + 1` play the current playback notes in order (the root through the root an octave up), the same pitches as the circle's notes. Shortcuts are ignored with Ctrl/Alt/Meta, on key repeat, when another handler claimed the key, and in text fields and selects; radios and the tempo slider take no typing, so shortcuts still work there. Both views render one component tree; `ScaleExplorer`, `ListenPanel`, and `BassFretboard` take a `minimal` prop that hides their controls, guides, and legends while keeping screen-reader headings and descriptions. That keeps the toggle buttons, circle, and fretboard mounted, so focus, listening, and highlights survive a view change. Zen mode shows audio errors because its playback panel is hidden. The view is ephemeral React state and isn't persisted.
- `domain/music/` contains pure functions and scale data. It does not import React, browser APIs, storage, or audio acquisition.
- `domain/instruments/` defines instruments and maps their positions to notes, and back: `positionsOfNote` lists every position of a pitch. The standard four-string bass establishes the first implementation.
- `domain/pitch/` holds pure signal analysis: `detectPitch` (McLeod Pitch Method), window sizing and RMS level, `NoteStabilizer`, and frequency-to-note and tuning helpers. It takes sample arrays and timestamps, not browser objects.
- `features/scales/` presents root/scale controls, the scale circle with its reading guide, tempo and playback controls. `ScaleCircle` places the twelve semitones clockwise from the root at 12 o'clock, so a scale's polygon is identical for every root. Its notes are native buttons in two labeled lists (scale notes in degree order, then notes outside the scale); scale notes declare their number shortcut with `aria-keyshortcuts`. The circle's center is a button inside its heading that opens `ScalePicker`, a non-modal dialog of native radio groups for the root and scale. Choices apply immediately through the same handlers as the selectors. Opening it focuses the checked root; Escape and Done close it and return focus to the center, and an outside click or tabbing away also closes it. While it is open, the circle fades behind it. `useNotePlayback` owns UI playback state and coordinates the audio adapter, including cancellation, recoverable errors, hidden-page handling, and unmount cleanup.
- `features/instruments/` renders the standard bass from fret 0 through 12 with `noteAtFret` and the shared membership functions. A semantic table provides string/fret context and labeled native buttons. Roots use text, shape, and color. Every position matching the heard pitch gets a dashed ring and "matches heard pitch" in its label; the circle rings the heard pitch class the same way. Only the fretboard scrolls horizontally on narrow screens; its string headers stay visible.
- `features/practice/` turns microphone frames into live feedback. `useLiveNote` owns the listening lifecycle: it starts `MicrophoneInput` from the Start click, runs the detector and stabilizer on each frame, re-renders only when the reading or the 2%-step input level changes, maps failures to problems, and stops on Stop, device loss, a hidden page, and unmount. `ListenPanel` shows the Start/Stop button, the heard note with octave, its scale membership (text and shape: R, ●, or –), its tuning separately, and status or problem messages. Its `role="status"` region announces the note and membership but not the changing cents.
- `features/sessions/` will capture and review detected-note events and use a storage adapter when persistence is added.
- `platform/audio/` owns Web Audio output through `NotePlayer` and microphone acquisition through `MicrophoneInput`, as separate classes with separate audio contexts. They use pure domain helpers but don't own selection, pitch estimation, or presentation.
- `platform/storage/` will own serialization and browser persistence. It does not decide whether a played note is in a scale.
- `test/` contains shared test setup and `audioFixtures.ts`, which synthesizes seeded bass-like recordings for unit tests, the benchmark, and the browser's fake microphone. Tests live beside the behavior they exercise.

Sessions and storage remain documentation-only placeholders. Avoid mock controls that imply a working recorder.

## Notes and scales

Pitch class and absolute pitch are different concepts. A pitch class identifies one of twelve semitones independent of octave; an absolute pitch, represented by a MIDI note number, retains the octave. Scale membership compares pitch classes. Instrument mapping and eventual tuning feedback need absolute pitches.

Scale definitions contain semitone intervals from the root and a quality (`major` or `minor`, from the third above the root). Major and minor pentatonic are separate choices. Degree labels compare each interval with the major scale on the same root (3 semitones is ♭3), and step sizes are the semitone gaps between consecutive notes, ending with the step back to the upper root. Domain tests verify known results and transpositions across the octave boundary. Display spelling is a presentation concern; the initial spelling convention uses sharps for accidentals. A future key-aware spelling implementation must preserve enharmonic equivalence in scale membership.

The initial bass tuning is E1–A1–D2–G2, MIDI `[28, 33, 38, 43]`, ordered from lowest to highest string. One fret raises pitch by one semitone. A visualization can choose its screen orientation without changing this definition.

More than one string/fret position can produce the same absolute pitch. Microphone pitch detection cannot establish which position was played, so the fretboard rings every matching candidate and the listening panel says so, rather than asserting a fingering. The scale circle is a pitch-class view and highlights a playing or heard note in any octave; the fretboard highlights exact pitches. Playing cues are solid rings and heard cues are dashed, so both can show at once.

## Synthesized playback (stage 1)

`domain/music/playback.ts` converts MIDI pitch to frequency/name and constructs one octave from the first selected root at or above the instrument's lowest pitch, including its upper root. With standard bass tuning, all sequences fit inside the displayed E1–G3 range. Descending playback reverses the same absolute pitches. Each circle note plays its pitch in the playback octave (the low root plus its distance in semitones); each fret plays its exact mapped pitch, including outside-scale notes.

`NotePlayer` lazily creates one `AudioContext` on a play gesture and resumes it before scheduling. It schedules triangle oscillators against the audio clock at one note per beat (40–240 BPM), with short gain envelopes to soften note boundaries. UI timers only update visual feedback; they do not time the sound. Every matching absolute-pitch position receives the playing cue, independently of scale/root membership.

New playback replaces the old sequence. Stop clears timers, stops and disconnects oscillators and gain nodes, and invalidates pending startup. The context is reused while the screen is mounted and closed at teardown. Root/scale/tempo changes and page backgrounding stop playback. A request identifier prevents a late audio-start failure from replacing a newer UI state. No audio is acquired, stored, or sent anywhere. Unsupported or failed audio startup leaves scale exploration usable.

## Microphone pipeline (stage 2)

```text
Microphone → PCM windows → pitch estimate → stable reading → scale classification and UI
(platform)                  (domain/pitch)  (domain/pitch)    (features, domain/music)
                                                   ↓
                                    session capture (stage 3)
```

Each step has a different responsibility:

1. **Acquisition:** request permission after a user action; handle pending, denied, missing, disconnected, and unavailable input; stop tracks and release audio resources on Stop and teardown.
2. **Estimation:** convert a sample window into frequency and confidence, or no reliable estimate. Benchmark an established monophonic detector before choosing an algorithm or dependency.
3. **Stabilization:** gate silence/noise, reject uncertain results, and reduce flicker without merging deliberately repeated notes.
4. **Classification:** map the estimated pitch to a note, retain tuning deviation separately, and check scale membership. An in-scale note can still be sharp or flat.
5. **Capture:** record meaningful note events with timestamps and the session's selected scale and instrument context, rather than one event per analysis frame.

How each step is implemented:

1. **Acquisition (`MicrophoneInput`).** The Start click creates and resumes an `AudioContext` before awaiting `getUserMedia`, so the context counts as user-initiated even when the permission prompt takes a while. Echo cancellation, noise suppression, and automatic gain control are requested off as preferences, and `track.getSettings()` reports any the browser kept on. The stream feeds an `AnalyserNode` (not connected to the speakers) sized by `analysisWindowSize`, which is polled every 40 ms. Errors map to `unsupported`, `insecure`, `denied`, `no-input`, `busy`, or `failed`; a track's `ended` event is device loss. Stop clears the timer, disconnects nodes, stops tracks, and closes the context. A generation counter makes a late permission grant release its stream and a late refusal resolve quietly.
2. **Estimation (`detectPitch`).** The McLeod Pitch Method removes DC offset, computes the normalized square difference function up to the period of 38 Hz, takes the first key maximum within 90% of the highest, and interpolates it. It returns a frequency and a clarity, or null for silence or no repeating shape. It was chosen over YIN by benchmark; see stage 2 in the implementation plan.
3. **Stabilization (`NoteStabilizer`).** RMS below the silence gate is silence. The gate sits 10 dB above a running noise-floor estimate: it starts at an assumed −60 dBFS, falls at once to any quieter window, rises at most 3 dB/s on windows without a trusted note (so notes never raise it), ignores digital silence below −90 dBFS, and never goes below −70 dBFS. `useLiveNote` reads the current gate to skip detection on silent windows and to mark it on the level meter. A window is trusted at clarity ≥ 0.8 within 38–420 Hz. A new note needs 40 ms across two or more trusted windows; a held note survives ±70 cents and dropouts under 120 ms; tuning is the median of the last five windows. Silent and unclear readings are separate from notes.
4. **Classification.** The UI maps the reading's MIDI note to scale membership with the shared domain functions, and shows tuning separately.

Low bass is a primary acceptance criterion. E1 is about 41.2 Hz and a possible future five-string B0 is about 30.9 Hz, below the current 38 Hz limit. Longer sample windows improve the amount of low-frequency evidence but add latency; 4096 samples at 44.1/48 kHz hold over three periods of E1. Harmonic-rich bass signals can lead to octave errors, so the fixtures include weak fundamentals and strong even harmonics, not just sine waves. Analysis runs on the main thread; `AudioWorklet` is a possible processing boundary if device measurements show that is inadequate.

Audio stays on the device by design. The default meaning of a recorded session is a sequence of detected note events, not an audio file. Raw audio retention, if introduced later, needs its own user-facing controls and storage design.

## State and persistence

The current root and scale, and the listening state, are ephemeral React state. Stage 3 introduces an explicit session lifecycle and a versioned session data format. Save a snapshot of the selected scale and instrument with each session so later selection changes cannot silently reinterpret its results. Persistence should handle malformed data, unavailable storage, and schema upgrades; the first implementation can choose localStorage or IndexedDB based on the measured payload size.

## Testing and deployment

`npm run check` checks formatting, runs unit/component tests with coverage, type-checks (including browser tests/config), and builds. Coverage thresholds are 85% for statements, branches, functions, and lines; these thresholds supplement behavior-based tests. Tests cover music mapping, UI selection, playback sequences/timing, cancellation, pending startup, errors and cleanup.

`npm run test:browser` builds and starts a fresh production preview under `/scale-dojo/`. Playwright runs desktop Chromium (1440×1000) and mobile Chromium emulation (390×844, also checking 320px overflow). Smoke tests exercise selectors, labeled notes, scrolling, keyboard activation, real synthesized output, ascending/descending pitch order and tempo, cancellation, and unavailable audio. Test instrumentation observes real audio nodes and an analyser signal; unit tests mock the audio API for deterministic lifecycle checks. Neither is a physical-device listening test. Microphone tests launch Chromium with `--use-fake-device-for-media-stream` and `--use-file-for-fake-audio-capture`, playing a WAV generated from the shared fixtures, so capture, analysis, and UI run for real; denied permission is simulated and device loss is triggered by dispatching the track's `ended` event. Unit tests run the detector on seeded recordings at 44.1 and 48 kHz and drive the stabilizer with controlled timestamps. `npm run bench:pitch` reruns the detector comparison. A real-instrument check is still outstanding.

CI checks every change. The Pages workflow is triggered by a completed CI run (`workflow_run`) and deploys only when that run succeeded for a push to this repository's `main`; it checks out the exact commit CI tested and rebuilds it. It can also be dispatched manually on `main` to redeploy. The repository's Pages source must be configured as GitHub Actions. Deployments share one concurrency group, so a running deployment is never cancelled by the next. Vite's base is `/scale-dojo/`, and the deployment artifact is `dist/`. There is no client-side routing requirement at present; if routing is added, account for Pages' lack of arbitrary SPA route fallback.

## References

- [Vite: static deployment and GitHub Pages](https://vite.dev/guide/static-deploy#github-pages)
- [React: thinking in components and state](https://react.dev/learn/thinking-in-react)
- [Vitest: coverage configuration](https://vitest.dev/guide/coverage)
- [Testing Library: guiding principles](https://testing-library.com/docs/guiding-principles/)
- [MDN: microphone permission and secure contexts](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
- [MDN: media track constraints](https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints)
- [MDN: analyser window sizes](https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode/fftSize)
- [MDN: AudioWorklet](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet)

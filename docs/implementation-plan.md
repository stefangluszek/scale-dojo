# Implementation plan

Each stage is a separate working session with a reviewable outcome. Keep later features out of earlier stages unless they are needed to satisfy an acceptance criterion. Update this plan when a stage is complete, and leave `npm run check` passing.

## Stage 0 — Project foundation

**Status:** implemented in the bootstrap.

**Dependencies:** none.

**Deliverables:** React/TypeScript/Vite project, plain CSS, root and scale selectors, scale-note chips, pure music functions, standard four-string bass definition and position mapping, Vitest/Testing Library coverage, CI, manual Pages deployment workflow, README, architecture notes, and this plan.

**Acceptance criteria:**

- A clean checkout can install with `npm ci` using Node.js 24.15+ (24.x) and run locally.
- Selecting a root and one of major, natural minor, major pentatonic, or minor pentatonic updates the displayed scale notes.
- The root is identifiable without relying only on color.
- `npm run check` enforces formatting, 85% coverage thresholds, type checking, and production build.
- Documentation clearly separates current features from planned ones; no microphone access or session recording is implied.
- The build uses `/scale-dojo/`, and deployment requires manual workflow dispatch after enabling Pages.

**Tests:** known scale contents, transposition, scale membership, bass tuning and fret mapping, user-visible selector behavior.

## Stage 1 — Bass scale explorer

**Status:** implemented, including the requested synthesized playback scope (2026-11-01).

**Dependencies:** stage 0 music and instrument domain.

**Deliverables:** responsive standard four-string bass fretboard, open through fret 12; root and scale-note markers; fret numbers and open-string labels; a semantic table with keyboard-accessible, fully labeled note buttons; click-to-hear chips and fret positions; ascending/descending one-octave scale playback with adjustable tempo and Stop; desktop/mobile production browser smoke tests integrated into CI.

**Acceptance criteria:**

- Every displayed fret maps to the existing domain calculation.
- Changing root or scale updates both note chips and fretboard consistently.
- Root notes and other scale notes have text or shape cues as well as color.
- String orientation and tuning are explicit.
- The screen remains usable on a narrow mobile viewport, with intentional fretboard scrolling if needed.
- Clicking or keyboard-activating a chip or fret plays its absolute pitch through Web Audio. Off-scale fret positions can also be heard. All matching absolute-pitch positions receive a playing cue without implying a fingering.
- Ascending playback starts at the first selected root at or above E1 and includes the upper root; descending playback reverses that sequence. The visible octave range updates with selection. Every sequence fits within the displayed bass range.
- Tempo is adjustable from 40 to 240 BPM, at one note per beat. New playback replaces the previous sequence. Stop, root/scale/tempo changes, page backgrounding, and teardown cancel scheduled playback; pending audio startup cannot restart it.
- Audio starts only after user activation. Audio failures are visible and recoverable without disabling the visual explorer. Oscillators/gain nodes are disconnected on Stop/completion; the reusable context closes on teardown.
- Production-build browser smoke tests load the app under `/scale-dojo/`, exercise scale selection, responsive layout, keyboard access, real audio output, playback direction/tempo, cancellation, and unavailable audio on desktop and mobile emulation.
- Microphone detection, live input feedback, and session recording remain outside Stage 1.

**Tests:** known open/fretted notes, octave boundaries, repeated pitch positions, root markers, shared scale changes, every root/scale playback range, MIDI frequency conversion, keyboard note activation, both playback directions and tempo, gain envelopes, completion/replacement/Stop, pending-start cancellation, visibility/unmount cleanup, and audio error recovery. Playwright observes real oscillator schedules and analyser output without replacing synthesis.

**Verified outcome:**

- `npm run check`: 72 unit/component tests passed; formatting, all 85% coverage thresholds, type checking, and production build passed.
- `npm run test:browser`: 8 tests passed across Chromium desktop (1440×1000) and mobile emulation (390×844), with an additional 320px document-overflow assertion.
- Desktop/mobile production screenshots were visually inspected: readable controls, clear root cues, and contained fretboard scrolling with sticky string labels.
- Browser checks confirm a real synthesized signal, correct frequencies, scheduled note order/tempo, and no microphone requests. Physical phones, speakers/headphones, other browser engines, and assistive-technology listening have not been manually validated.

**Follow-up (2026-11-01):** the evenly spaced note chips were replaced by a scale circle (root at 12 o'clock, twelve semitones, scale notes joined into a polygon) with scale-degree labels, frets between notes, and playable outside-scale notes. Major scales use warm gold and minor scales dusk blue on both the circle and the fretboard; text and shape cues still identify roots and membership without color. GitHub Pages now deploys automatically after CI passes on `main`, replacing the bootstrap's manual-only deployment; manual dispatch remains available for redeploys.

**Follow-up (2026-11-01):** the page now opens in a zen mode with only the scale circle and fretboard; `?` or a header button toggles the full page with selectors, playback, and guides. Selection, focus on the toggle, and active playback highlights carry across views. Unit tests cover the default view, button and key toggling, ignored keys (form fields, modifiers, repeats), and zen audio errors; the browser suite checks that zen fits in one screen on desktop (1440×1000) and mobile (390×844) with no 320px overflow.

**Follow-up (2026-11-01):** the circle's center now opens a root and scale picker in both views, and number keys play the scale's notes in order (`1` is the root; the last number is the root an octave up). Unit tests cover opening, live choices, keyboard use (arrows, Escape, focus return), closing on an outside click or tabbing away, sync with the selectors, number keys for each scale, and keys ignored in text fields, selects, with modifiers, and on repeat. A browser test changes the scale through the picker in zen mode and checks the pitches of the number keys through real Web Audio output.

## Stage 2 — Microphone input and live note feedback

**Status:** implemented and verified on deterministic recordings and Chromium's fake microphone (2026-11-01). The project owner has retested pickup with a real bass and reports a substantial improvement after the adaptive silence-gate fix. The detailed accuracy, latency, and stability checks below remain to be documented.

**Dependencies:** stage 1 visualizer; an explicit choice of pitch detector supported by a short benchmark.

**Deliverables:** microphone Start/Stop controls, permission and device states, monophonic pitch estimation, confidence/silence gating, stable current-note feedback, and in-scale/off-scale indication.

**Acceptance criteria:**

- Microphone access begins only after a user action, and Stop releases media tracks and audio resources.
- Pending permission, denied permission, missing input, unsupported/insecure context, and device loss have understandable UI states.
- Silence and low-confidence estimates are not reported as incorrect notes.
- The current note includes octave; tuning deviation and scale membership remain separate concepts.
- Matching fretboard positions are highlighted as candidates, without claiming the microphone identified a string.
- Before final integration, document an accuracy/latency target and measured results for the supported bass range, including low E1, on deterministic fixtures and at least one real instrument/device setup.
- Document any browser/device limitations instead of presenting synthetic-test success as complete microphone validation.

**Tests:** deterministic PCM fixtures at common sample rates, low E1 and higher bass notes, detuning, silence, noise, strong harmonics and octave ambiguity; mocked permission/error/cleanup paths; browser integration with a fake audio input where available. Perform a real bass microphone or audio-interface check separately.

**Detector choice.** `npm run bench:pitch` (`src/domain/pitch/detector.benchmark.ts`) compares the McLeod Pitch Method (MPM) with YIN on every semitone from E1 to G4, at 44.1 and 48 kHz, in tune and at +23 and −37 cents (240 windows per condition), with 2048-, 4096- and 8192-sample windows. A window counts as a note only at clarity ≥ 0.8. Results with the shipped 4096-sample window:

| Condition                                                   | MPM correct note | MPM median / p95 error | YIN correct note   |
| ----------------------------------------------------------- | ---------------- | ---------------------- | ------------------ |
| Sine; bass-like harmonics                                   | 100%             | 0.0 / 0.0 cents        | 100%               |
| Bass-like, 20 dB SNR white noise                            | 100%             | 0.3 / 1.8 cents        | 100%               |
| Bass-like, 10 dB SNR white noise                            | 100%             | 2.3 / 7.1 cents        | 92.9% (15 octave)  |
| Plucked: decaying, stiff string (B = 0.0003)                | 100%             | 3.7 / 3.9 cents¹       | 100%               |
| Phone microphone: fundamental at 8% of the loudest harmonic | 100%             | 0.0 / 0.0 cents        | 100%               |
| Phone microphone, 20 dB SNR                                 | 100%             | 0.2 / 1.0 cents        | 100%               |
| Octave trap: strong even, weak odd harmonics                | 100%             | 0.0 / 0.0 cents        | 27.5% (174 octave) |
| White noise, 50 windows                                     | 0 reported       | —                      | 0 reported         |

¹ String stiffness raises the partials, so both detectors read such strings slightly sharp.

MPM was chosen: it is the only one without octave errors on the octave trap and in heavy noise, and it costs about the same (4.2 ms per 4096-sample window for MPM, 3.8 ms for YIN, in Node on the development container). 2048-sample windows were just as accurate on these fixtures but hold under two periods of E1, so the app uses the power of two of at least 75 ms: 4096 samples at 44.1 or 48 kHz. Both detectors are implemented in this repository; no dependency was added.

**Pipeline.** `MicrophoneInput` reads the newest window from an `AnalyserNode` every 40 ms. Windows below the silence gate are silence and skip detection. The gate sits 10 dB above a running estimate of the room's noise floor, which starts at an assumed −60 dBFS, falls at once to any quieter window, rises at most 3 dB per second while no note is heard, ignores digital silence, and never puts the gate below −70 dBFS. `NoteStabilizer` trusts a window at clarity ≥ 0.8 within 38–420 Hz, starts a note once it persists for 40 ms across at least two windows, keeps a held note through ±70 cents and through dropouts shorter than 120 ms, and shows the median tuning of the last five windows. Silence and untrusted sound are separate readings, never wrong notes.

**Targets and measured results (deterministic recordings).**

- Accuracy target: the right note and octave for every semitone E1–G4, within 5 cents on clean tones, with no octave errors on weak-fundamental, octave-trap or 20 dB SNR fixtures. Met (see the table and `detector.test.ts`).
- Latency target: a clean note shown within 200 ms of its onset for E1 and 150 ms from A1 up, excluding the browser's input latency. Measured over eight onset phases at 44.1 and 48 kHz: E1 110–150 ms, A1 90–130 ms, D2 80–115 ms, G2 70–105 ms, C3 65–100 ms, G3 55–90 ms, G4 50–85 ms. `stabilizer.test.ts` enforces the targets.
- Stability: a two-second decaying E1 recorded through the phone-microphone timbre gives one unbroken reading; repeated notes separated by 300 ms of silence give two readings; trailing white noise is never reported as a note.

**Verified outcome:**

- `npm run check`: 163 unit/component tests passed; formatting, coverage (99.8% statements, 98.9% branches, 100% functions and lines), type checking, and production build passed.
- `npm run test:browser`: 20 tests passed across Chromium desktop (1440×1000) and mobile emulation (390×844), including the stage 1 suite. Chromium's fake microphone plays a generated E1/F1 bass recording through real `getUserMedia` capture and Web Audio analysis. The tests check the readout, scale membership, fretboard and circle rings, no request before Start, released tracks and closed audio context after Stop and after device loss, a blocked microphone, zen layout fit while listening, and no 320px overflow.
- Desktop/mobile screenshots of both views while listening were visually inspected.

**Remaining detailed manual checks (real instrument).** Pickup improvement has been confirmed by the project owner; the following measurements remain to be documented. Run the deployed site or `npm run dev` on localhost with a bass, ideally twice: once through a laptop or phone microphone near an amplifier, once through an audio interface. Play each open string, fret 5, 7 and 12 on every string, a slow chromatic run on the E string, and the same note plucked repeatedly. Record whether each note and octave reads correctly, how long it takes to appear, whether tuning agrees with a hardware tuner within about 5 cents, whether held notes flicker, and whether the browser reports voice processing still on. Note the browser, device, and microphone. Update this section with the results.

**Known limitations:**

- Automated browser tests cover Chromium with a fake microphone. The project owner's real-bass retest confirms improved pickup, but the browser, device, and input setup were not specified; broader browser/device coverage remains unverified. Phone and laptop microphones pick up little at 41 Hz; the weak-fundamental fixture models this, but real devices may be worse.
- Monophonic: chords or strings left ringing give an unclear or dominant-note reading.
- The silence gate adapts to the room but has no manual control. Notes need to be about 10 dB above the room's background, so quiet notes in a loud room stay below it, and a noisy room reads as "no clear note" for the few seconds the gate takes to rise. Steady pitched hum above the gate, such as mains hum on a noisy audio interface, can read as a note.
- The range stops at 38 Hz, so five-string B0 (30.9 Hz) and drop-D's D1 (36.7 Hz) are not supported. Notes above 420 Hz read as unclear.
- Browsers may not honor the request to turn off echo cancellation, noise suppression, and automatic gain control. The full page names any that stay on.
- Analysis runs on the main thread at 25 windows per second. Phone CPU use and latency have not been measured; `AudioWorklet` remains an option if they are inadequate.
- Hiding the page stops listening. Synthesized playback is audible to the microphone while listening.

**Follow-up (2026-11-01): first real-bass check.** The project owner tried the deployed app with an electric bass. Notes were detected, but only when the string was plucked very hard. The cause was the original fixed −48 dBFS RMS silence gate: with automatic gain control off, normal plucks arrive quieter than that. The gate now adapts to the room as described under **Pipeline**, so in a quiet room notes down to about −65 dBFS count, and the full page's level meter marks the gate. Unit tests cover quiet and noisy rooms, 20 seconds of continuous playing, digital silence, and a soft E1 at −58 dBFS over −75 dBFS room noise through the real detector. The fake-microphone browser test now plays its F1 at −58 dBFS over room noise; it fails with the old gate and passes with the new one.

**Follow-up (2026-11-01): pickup retest confirmed.** The project owner retested the improved pickup and reported it is "much better than before." This confirms the practical improvement from the adaptive silence gate on their bass setup. Browser/device details and measured accuracy, latency, tuning, and held-note stability were not supplied; the detailed manual checks above remain open.

**Next validation:** use the remaining real-instrument checks to validate session segmentation, since it depends on how real notes start and decay.

## Stage 3 — Capture and review practice sequences

**Status:** implemented (2026-11-01), including persistent root, scale, tempo, and view preferences. Real-instrument segmentation checks remain to be documented.

**Dependencies:** stage 2 stable note estimates and microphone lifecycle (implemented). Real-bass pickup improvement is confirmed; detailed real-instrument checks remain useful for validating segmentation.

**Deliverables:** session Start/Stop/Clear, a timestamped note sequence, in-scale/off-scale labels, a useful session summary, and browser-local persistence with a versioned format. A session records detected note events by default; raw audio recording is outside this stage.

**Acceptance criteria:**

- Sustained notes produce meaningful events rather than one row per analysis frame.
- Repeated notes separated by silence remain separate events.
- Each event retains timing, absolute pitch, and the information needed to explain its classification.
- Session root, scale, and instrument settings are frozen at capture start. Changing the current selection cannot rewrite saved results.
- Stop, restart, clear, and empty-session cases behave predictably.
- Saved sessions survive reload; malformed or unavailable storage produces a recoverable state.
- Users can review a sequence and identify which notes were outside its scale without relying only on color.

**Tests:** event segmentation with controlled timestamps, held/repeated notes, silence boundaries, classification snapshots, lifecycle transitions, serialization round trips, invalid stored data, and browser capture/review flow using deterministic input.

**Implementation:** Sessions are available from the header in both views. Start captures the selected context immediately and waits for microphone readiness before recording note events. Held pitches remain one event even when tuning changes; silence/unclear readings and pitch changes form boundaries. Stop session also stops listening. Captures finalize on Stop listening, backgrounding, device loss, pagehide, and teardown. Saved history includes note start times/durations, in-scale/outside-scale labels, counts and an in-scale percentage; empty sessions have no percentage. Clear requires confirmation and affects only that session.

**Persistence:** version-1 localStorage envelopes keep sessions and settings in separate keys. Note boundaries and one-second checkpoints save active capture; interrupted checkpoints restore for review without restarting the microphone. Settings save immediately from both selectors and the circle picker; root, scale, tempo, and view all survive reload. Malformed or unavailable storage uses recoverable UI states with reset/retry controls. Raw audio is never retained. Same-browser/device persistence only; cross-tab merging and export remain outside this stage.

**Verified outcome:**

- `npm run check`: 196 unit/component tests passed, with 99.49% statement coverage, 98.52% branch coverage, and 100% function/line coverage; formatting, type checking, and production build passed.
- All 24 production-browser cases passed across desktop Chromium (1440×1000) and mobile emulation (390×844), including 320px overflow checks. The new capture/review/reload cases passed after correcting their scale-selector locator; the other 22 cases passed in the full run. This environment used its installed Chromium through `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium` because the browser-download host was unavailable.
- Browser capture uses a deterministic fake E1/F1 microphone recording and verifies stored notes, frozen classification, settings after reload, clear, and interrupted-session recovery without a new microphone request. Component/domain tests also cover held/repeated notes, permission cancellation, empty sessions, device loss/backgrounding, invalid storage, and retry after failed saves.
- Desktop, mobile, and 320px session-review screenshots were visually inspected. Real-bass session segmentation and other browser engines remain unverified.

**Next stage:** additional instruments and tunings (stage 4). Real-bass note segmentation should also be tried during normal practice.

## Stage 4 — Additional instruments and tunings

**Status:** planned.

**Dependencies:** stages 1–3 provide a stable shared music/practice model.

**Deliverables:** instrument selection, six-string guitar and another bass tuning or string count, and a piano keyboard visualization. Add key-aware note spelling while keeping pitch equality independent of the displayed label.

**Acceptance criteria:**

- New fretted instruments primarily require tuning and range data rather than duplicated music logic.
- Piano uses a separate renderer with correct white/black key geometry and a clearly stated visible range.
- Instrument changes preserve valid scale selection and update displayed positions.
- Live pitch feedback and session classification work through the same music domain.
- Supported pitch ranges are explicit; extending below the tested bass range requires new detector validation.
- Saved sessions retain their original instrument context.

**Tests:** each tuning's open strings and sample frets, piano key ordering and octave boundaries, enharmonic membership, renderer switching, session context, and instrument-specific detector fixtures where ranges expand.

## Stage 5 — Release quality and practice polish

**Status:** planned.

**Dependencies:** the complete scale/listen/review flow from stages 1–4.

**Deliverables:** accessibility and mobile refinements, browser/device support documentation, performance measurements, improved empty/error states, and a verified GitHub Pages release. Choose extra practice aids only after the core experience is reliable.

**Acceptance criteria:**

- The complete practice flow works on an explicitly documented desktop/mobile browser matrix.
- Permission recovery, microphone interruption, backgrounding, and repeated Start/Stop do not leak resources or leave stale feedback.
- Keyboard navigation, visible focus, contrast, reduced motion, and screen-reader announcements are reviewed.
- Pitch latency and UI responsiveness are measured on representative devices, with limitations recorded.
- Tests and production build pass, and the deployed repository-path URL loads its assets correctly.
- README and stage status accurately describe the shipped behavior.

**Tests:** broadened browser smoke coverage, accessibility checks and manual assistive-technology review, real-device audio scenarios, resource cleanup checks, and a deployment smoke check.

## Deferred decisions

Cloud accounts/synchronization, raw audio files, polyphonic/chord recognition, MIDI hardware input, accompaniment, metronomes, and offline installation are separate enhancements. They should not delay the bass scale/listen/review workflow. No license is selected by this bootstrap.

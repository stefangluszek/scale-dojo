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

**Next session:** stage 2 microphone input and live feedback. Preserve the output-only playback boundary and benchmark low-bass pitch detection before choosing an input implementation.

## Stage 2 — Microphone input and live note feedback

**Status:** planned.

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

## Stage 3 — Capture and review practice sequences

**Status:** planned.

**Dependencies:** stage 2 stable note estimates and microphone lifecycle.

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

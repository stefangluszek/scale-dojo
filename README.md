# Scale Dojo

A browser app for practicing musical scales, starting with bass guitar. Choose a root and a scale, find its notes on the fretboard, hear individual notes or an ascending/descending scale, then play your bass into the microphone and see which notes belong.

Scale Dojo is a static web app intended for **GitHub Pages**. It runs in the browser without a backend, account, or API key.

## Current status

Stages 0–3 are implemented:

- Practice sessions: every time you **Start listening**, the notes you play are captured as a session with timestamps. **Stop listening** ends it and leaves a note-by-note review with durations, in-scale/outside-scale labels, and a summary under **Sessions**. Listens with no detected notes aren't saved. Held notes stay together; repeated notes separated by silence stay separate. Sessions keep their starting scale and instrument even when you change the explorer. History survives reload and can be browsed while listening; **Clear session** asks before deleting that session.
- Live microphone feedback: **Start listening** asks for the microphone and shows the note you play with its octave (for example, E1), how far it is from in tune in cents, and whether it's the root, in the scale (with its degree), or outside the scale. Every fretboard position with that pitch gets a dashed ring, and its note lights up on the circle. Silence and unclear sound show a neutral "Play a note" or "no clear note yet", never a wrong note. **Stop listening** releases the microphone.
- A zen mode, shown on the first visit, with only the scale circle, a **Start listening** button, and the fretboard on a quiet page. Press **?** or the **?** button for the full page with the selectors, playback controls, and reading guides; press **?** or **Zen mode** to return. The chosen scale carries across both views. Root, scale, tempo, and view are saved on this device and restored on reload. Listening, and so session capture, always requires a new user action.
- A root and scale picker in the center of the circle: tap the scale's name to choose another root or scale. Choices apply immediately; **Done**, Escape, or a tap outside closes it. It works in both views and stays in sync with the full-page selectors.
- Keyboard shortcuts: **1**, **2**, **3**, … play the scale's notes in order from the root, and the next number plays the root an octave up (**6** for pentatonic scales, **8** for seven-note scales). **?** toggles zen mode. Shortcuts are ignored while a dropdown has focus and with Ctrl, Alt, or Cmd held.
- Root and scale selection for major, natural minor, major pentatonic, and minor pentatonic scales.
- A scale circle: the twelve semitones clockwise with the root at the top, scale notes joined into the scale's shape, scale-degree labels (1, 2, ♭3, …), and frets between notes. Every position, including notes outside the scale, can be tapped to hear it.
- Scale colors that follow the scale's mood: warm gold for major scales and dusk blue for minor scales, shared by the circle and the fretboard.
- A responsive four-string bass fretboard from open strings through fret 12, with labeled notes, accessible root markers, and intentional horizontal scrolling on small screens.
- Click-to-hear synthesized notes and one-octave ascending/descending scale playback at 40–240 BPM, with Stop and matching-pitch highlights.
- A tested music domain and standard four-string bass definition and fret-position mapping.
- A React app, unit/component tests, coverage checks, a production build, and desktop/mobile Playwright smoke tests.
- CI, and GitHub Pages deployment that publishes `main` automatically after CI passes.

Additional instrument views remain planned. Note labels use sharps for accidentals; full key-aware spelling is future work.

The fretboard shows G2 at the top and E1 at the bottom. Root notes have an **R** and a square marker; other scale notes have a dot. Every note button names its string, fret, octave, and scale membership. Circle notes play in the scale's displayed playback octave. Because the circle has no octaves, a playing pitch lights up its note on the circle in any octave, while the fretboard highlights only the exact pitch. Playback starts at the lowest root available above or at E1 and includes the upper root, or reverses that sequence for descending playback. Changing root, scale, or tempo stops playback; tap Play again to use the new settings. Backgrounding the page also stops playback.

Audio starts only after a click or keyboard activation and uses synthesized triangle tones, not recorded bass samples. An unavailable audio engine shows a recoverable message while the fretboard remains usable. Browser tests verify real Web Audio output in Chromium desktop and mobile emulation; physical phones, speaker quality, and other browser engines have not been validated.

### Practice sessions and saved settings

Each listening run is a session; there are no separate session controls. Once microphone permission is granted after **Start listening**, capture begins with the current root, scale, and bass tuning as a fixed snapshot, and **Stop listening** ends it. A run with no detected notes is discarded, so checking the microphone doesn't fill the history. Silence and unclear sound never count as wrong notes. Open **Sessions** from either view to review; zen mode keeps sessions out of sight unless they can't be saved. The in-scale rate counts captured note events, not time spent playing. Event times describe stabilized detections, so they include the detector's confirmation and release delay.

Each note boundary and a checkpoint every second are saved in browser localStorage. Leaving or hiding the page ends capture and keeps the notes collected so far. After an abrupt closure, the last checkpoint is restored as interrupted; capture never restarts automatically. The latest second of a held note may be missing after a crash. Sessions and preferences stay in this browser on this device; clearing site data removes them. Storage errors leave the app usable and show a retry control. Unreadable saved data is left untouched until you choose to reset it or save new data.

Your selected root, scale, playback tempo, and zen/full-page view are saved immediately, including changes made from the circle picker. The first visit defaults to C major pentatonic, 90 BPM, and zen mode. No account or network service is used for saving.

### Listening to your bass

The microphone is requested only when you press **Start listening**, never on page load. Audio is analysed on your device as it arrives; raw audio is never recorded, stored, or sent. Each listening run stores its detected note events locally as a session; runs with no detected notes aren't kept. Browsers allow microphones only on secure pages (the GitHub Pages HTTPS site or localhost). Blocked permission, a missing or busy microphone, an unsupported or insecure browser, and a disconnected microphone each show a message explaining what to do. Hiding the page stops listening.

Play one note at a time: the detector is monophonic and covers the four-string bass range, E1 (41 Hz) through G4 (392 Hz). The fretboard rings every matching position because a pitch can't tell which string you used. Notes above fret 12 still show in the readout and on the circle. Scale membership follows the scale currently selected.

The detector uses the McLeod Pitch Method on 85–93 ms windows, 25 times a second. On synthetic bass recordings it finds the right note and octave for every semitone from E1 to G4, including with a weak fundamental, strong even harmonics, and background noise. A clean note appears 50–150 ms after it starts, slowest for low E1. Those measurements come from deterministic test signals and Chromium's fake microphone. The project owner has also retested pickup with a real bass after the adaptive silence-gate fix and reports it is much better than before. Detailed real-device accuracy, latency, and stability checks remain to be documented. See [stage 2 in the implementation plan](docs/implementation-plan.md#stage-2--microphone-input-and-live-note-feedback) for the measurements, the known limitations, and the remaining manual checks.

Soft playing counts: anything about 10 dB above the room's background noise is treated as sound. The threshold follows the room, adjusting over a few seconds, and the level meter on the full page marks it. If you still have to pluck hard, raise your computer's or phone's microphone input volume, or move the microphone closer to the bass or amplifier.

Scale Dojo asks the browser to turn off echo cancellation, noise suppression, and automatic gain control, which can cut off or bend bass notes. If the browser keeps any of them on, the full page says so. Synthesized playback is audible to the microphone while listening, so it's heard like any other note.

## Run locally

Use **Node.js 24.15+ (24.x)** and npm. If you use nvm, run `nvm use` in this directory.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite, including `/scale-dojo/`.

```sh
npm run check         # Formatting, tests with coverage, type checking, production build
npm run test:watch    # Tests while developing
npm run format       # Apply formatting
npm run preview      # Serve an existing production build locally
npx playwright install chromium # One-time browser setup; CI also uses --with-deps
npm run test:browser  # Build, then test /scale-dojo/ on desktop/mobile Chromium
# To use an already-installed Chromium instead of the Playwright download:
# PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:browser
npm run bench:pitch   # Compare pitch detectors on synthetic bass recordings (about a minute)
```

`npm run build` writes the static site to `dist/`. Coverage reports are written to `coverage/`; the project enforces an 85% minimum for lines, statements, functions, and branches. Browser tests start their own production preview on port 4173 and write screenshots, failure traces, and an HTML report to ignored `test-results/` and `playwright-report/` directories. The microphone tests run Chromium with a fake microphone that plays a generated bass recording.

## Technology and structure

**React + TypeScript + Vite** provides a small, client-only app with typed music and instrument models. Plain CSS keeps the UI easy to maintain. **Vitest + Testing Library** tests the music rules and user-visible interactions; **Playwright** exercises the production app. Web Audio synthesis and microphone acquisition live behind separate platform adapters; pitch detection and note stabilization are pure functions tested with deterministic recordings.

```text
src/
  app/                  App composition and styles
  domain/
    music/              Notes, scale definitions, and scale membership
    instruments/        Instrument definitions and fret-position mapping
    pitch/              Pitch detection, note stabilization, and tuning
  features/
    scales/             Scale selection, note display, and playback controls
    instruments/        Accessible bass fretboard
    practice/           Live listening and note feedback
    sessions/           Session capture, summaries, and saved sequence review
  platform/
    audio/              Web Audio synthesis and microphone input
    storage/            Versioned settings and session persistence
  test/                 Shared test setup and deterministic audio fixtures
docs/
  architecture.md
  implementation-plan.md
tests/browser/          Production-build desktop/mobile smoke tests, with a fake microphone
```

See [architecture](docs/architecture.md) for the decisions and boundaries, [implementation plan](docs/implementation-plan.md) for session-sized stages, and [contributing](CONTRIBUTING.md) for the development workflow.

## Deploy to GitHub Pages

Every change that lands on `main` is published automatically:

1. One-time setup: in the GitHub repository, open **Settings → Pages** and select **GitHub Actions** as the build source.
2. Merge changes into `main`. The **CI** workflow runs the full check and browser tests for that push.
3. When that CI run succeeds, **Deploy GitHub Pages** checks out the same commit, runs `npm run check` again, and publishes `dist/`. If CI fails or is cancelled, nothing is published.
4. The site is served at `https://stefangluszek.github.io/scale-dojo/`; each deployment run reports its URL.

To redeploy without a new commit, run **Deploy GitHub Pages** from the **Actions** tab using **Run workflow** on the `main` branch. Pull requests and pushes to other branches run checks but never publish.

The Vite base path is `/scale-dojo/`, so production assets work under the repository path. Change that setting if the repository is renamed or a custom domain is introduced. See [Vite's GitHub Pages guide](https://vite.dev/guide/static-deploy#github-pages).

## Product direction

The first experience uses standard four-string bass tuning, E1–A1–D2–G2. A user chooses a root and scale, views scale notes on the fretboard, starts microphone listening, and sees whether detected notes belong to that scale. Practice sessions capture timestamped detected notes for review and save them in this browser; raw audio recording is a separate possible feature.

Instrument definitions and the music domain are kept separate from their visualizations so additional bass tunings, six-string guitar, piano, and other instruments can follow. Microphone processing stays on the user's device. Browser microphone access requires permission and a secure context, such as GitHub Pages HTTPS or localhost. See [MDN's microphone API documentation](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia).

No project license has been selected yet.

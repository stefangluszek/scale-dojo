# Scale Dojo

A browser app for practicing musical scales, starting with bass guitar. Choose a root and a scale, find its notes on the fretboard, and hear individual notes or an ascending/descending scale.

Scale Dojo is a static web app intended for **GitHub Pages**. It runs in the browser without a backend, account, or API key.

## Current status

Stages 0 and 1 are implemented:

- Root and scale selection for major, natural minor, major pentatonic, and minor pentatonic scales.
- Clickable scale-note chips, with the root identified.
- A responsive four-string bass fretboard from open strings through fret 12, with labeled notes, accessible root markers, and intentional horizontal scrolling on small screens.
- Click-to-hear synthesized notes and one-octave ascending/descending scale playback at 40–240 BPM, with Stop and matching-pitch highlights.
- A tested music domain and standard four-string bass definition and fret-position mapping.
- A React app, unit/component tests, coverage checks, a production build, and desktop/mobile Playwright smoke tests.
- CI and a manually triggered GitHub Pages deployment workflow.

Microphone input, live note feedback, session recording, and other instrument views remain planned stages. The app does not request microphone access or record audio. Note labels use sharps for accidentals; full key-aware spelling is future work.

The fretboard shows G2 at the top and E1 at the bottom. Root notes have an **R** and a square marker; other scale notes have a dot. Every note button names its string, fret, octave, and scale membership. Chips play the corresponding note in the scale's displayed playback octave. Playback starts at the lowest root available above or at E1 and includes the upper root, or reverses that sequence for descending playback. Changing root, scale, or tempo stops playback; tap Play again to use the new settings. Backgrounding the page also stops playback.

Audio starts only after a click or keyboard activation and uses synthesized triangle tones, not recorded bass samples. An unavailable audio engine shows a recoverable message while the fretboard remains usable. Browser tests verify real Web Audio output in Chromium desktop and mobile emulation; physical phones, speaker quality, and other browser engines have not been validated.

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
```

`npm run build` writes the static site to `dist/`. Coverage reports are written to `coverage/`; the project enforces an 85% minimum for lines, statements, functions, and branches. Browser tests start their own production preview on port 4173 and write screenshots, failure traces, and an HTML report to ignored `test-results/` and `playwright-report/` directories.

## Technology and structure

**React + TypeScript + Vite** provides a small, client-only app with typed music and instrument models. Plain CSS keeps the UI easy to maintain. **Vitest + Testing Library** tests the music rules and user-visible interactions; **Playwright** exercises the production app. Web Audio synthesis lives behind an output-only adapter. Microphone acquisition will be added separately when live listening is implemented.

```text
src/
  app/                  App composition and styles
  domain/
    music/              Notes, scale definitions, and scale membership
    instruments/        Instrument definitions and fret-position mapping
  features/
    scales/             Scale selection, note display, and playback controls
    instruments/        Accessible bass fretboard
    practice/           Planned live practice feedback
    sessions/           Planned captured-note sequence review
  platform/
    audio/              Web Audio synthesis and resource lifecycle
    storage/            Planned browser-local persistence
  test/                 Shared test setup
docs/
  architecture.md
  implementation-plan.md
tests/browser/          Production-build desktop/mobile smoke tests
```

See [architecture](docs/architecture.md) for the decisions and boundaries, [implementation plan](docs/implementation-plan.md) for session-sized stages, and [contributing](CONTRIBUTING.md) for the development workflow.

## Deploy to GitHub Pages

Deployment is intentionally manual during bootstrap:

1. Merge the bootstrap or subsequent changes into `main`; the deployment workflow only deploys that branch.
2. In the GitHub repository, open **Settings → Pages** and select **GitHub Actions** as the build source.
3. Run **Deploy GitHub Pages** from the **Actions** tab using **Run workflow**, selecting the `main` branch.
4. Use the deployment URL reported by the workflow. For this repository, the expected address is `https://stefangluszek.github.io/scale-dojo/` once Pages is enabled and deployment succeeds.

The Vite base path is `/scale-dojo/`, so production assets work under the repository path. Change that setting if the repository is renamed or a custom domain is introduced. A build or push alone does not publish the app. See [Vite's GitHub Pages guide](https://vite.dev/guide/static-deploy#github-pages).

## Product direction

The first complete experience will use standard four-string bass tuning, E1–A1–D2–G2. A user will choose a root and scale, view scale notes on the fretboard, start microphone listening, and see whether detected notes belong to that scale. Later sessions will capture timestamped detected notes for review; raw audio recording is a separate possible feature.

Instrument definitions and the music domain are kept separate from their visualizations so additional bass tunings, six-string guitar, piano, and other instruments can follow. Microphone processing is intended to stay on the user's device. Browser microphone access requires permission and a secure context, such as GitHub Pages HTTPS or localhost. See [MDN's microphone API documentation](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia).

No project license has been selected yet.

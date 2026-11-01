# Scale Dojo

A browser app for practicing musical scales, starting with bass guitar. Choose a root and a scale, learn its notes, and eventually see them on an instrument, hear feedback from your microphone, and review the notes you played.

Scale Dojo is a static web app intended for **GitHub Pages**. It runs in the browser without a backend, account, or API key.

## Current status

This repository contains the project foundation, not the complete practice app:

- Root and scale selection for major, natural minor, major pentatonic, and minor pentatonic scales.
- Scale-note chips, with the root identified.
- A tested music domain and standard four-string bass definition and fret-position mapping.
- A React app, automated tests, coverage checks, and a production build.
- CI and a manually triggered GitHub Pages deployment workflow.

The fretboard, microphone input, live note feedback, session recording, and other instrument views are planned stages. The app currently does not request microphone access or record audio. Note labels use sharps for accidentals; full key-aware spelling is future work.

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
```

`npm run build` writes the static site to `dist/`. Coverage reports are written to `coverage/`; the project enforces an 85% minimum for lines, statements, functions, and branches. Browser smoke tests will be added with the fretboard in stage 1; no browser automation is included in this bootstrap.

## Technology and structure

**React + TypeScript + Vite** provides a small, client-only app with typed music and instrument models. Plain CSS keeps the initial UI easy to maintain. **Vitest + Testing Library** tests the music rules and user-visible interactions. Web Audio and microphone APIs will be added behind an adapter when live listening is implemented.

```text
src/
  app/                  App composition and styles
  domain/
    music/              Notes, scale definitions, and scale membership
    instruments/        Instrument definitions and fret-position mapping
  features/
    scales/             Scale selection and note display
    instruments/        Planned instrument visualizations
    practice/           Planned live practice feedback
    sessions/           Planned captured-note sequence review
  platform/
    audio/              Planned browser microphone and audio integration
    storage/            Planned browser-local persistence
  test/                 Shared test setup
docs/
  architecture.md
  implementation-plan.md
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

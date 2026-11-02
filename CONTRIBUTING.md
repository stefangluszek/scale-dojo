# Contributing

Use Node.js 24.15+ (24.x) and npm (`nvm use` reads `.nvmrc`).

```sh
npm ci
npm run dev
```

Open the Vite URL under `/scale-dojo/`. See the [architecture](docs/architecture.md) for code boundaries and the [implementation plan](docs/implementation-plan.md) for current priorities.

## Checks

```sh
npm run test:watch    # Tests while developing
npm run format       # Apply formatting
npm run check        # Formatting, coverage, type checking, production build
npx playwright install chromium
npm run test:browser  # Build and test desktop/mobile Chromium
npm run bench:pitch   # Compare pitch detectors; run after detector changes
```

On Linux CI, install the browser with `npx playwright install --with-deps chromium`. To use an installed browser, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium` for the browser-test command.

- Test behavior and edge cases, with tests beside the code. Use accessible controls and visible results for UI tests.
- Keep music, instrument, pitch, and session rules in `src/domain/`; browser audio and storage belong in `src/platform/`. Request microphone access only from a user action.
- For UI changes, check desktop and narrow mobile layouts and inspect screenshots in `test-results/`. Browser reports and failure traces are in `playwright-report/` and `test-results/`.
- Use seeded signals from `src/test/audioFixtures.ts` for audio tests. Update [testing notes](docs/testing.md) after detector benchmarks or real-device checks; distinguish synthetic results from physical-device results.

Coverage requires 85% for lines, statements, functions, and branches. Build output goes to `dist/`, coverage to `coverage/`. Browser tests start a production preview on port 4173. `npm run preview` serves an existing build manually.

Commit dependency changes with `package-lock.json`; leave generated files out of version control. PRs should explain the outcome, checks, and relevant limitations. Keep docs accurate when behavior changes. No project license has been selected.

## Deployment

The app is hosted at [stefangluszek.github.io/scale-dojo](https://stefangluszek.github.io/scale-dojo/).

1. In repository **Settings → Pages**, set the source to **GitHub Actions** (one-time setup).
2. Merge to `main`. CI runs the checks and browser tests.
3. After successful CI, **Deploy GitHub Pages** checks out the tested commit, reruns `npm run check`, and publishes `dist/`. Failed or cancelled CI does not deploy.

To redeploy, run **Deploy GitHub Pages → Run workflow** on `main` in the Actions tab. PRs and other branches do not publish. Keep Vite's `/scale-dojo/` base path unless the repository name or hosting location changes. See [Vite's Pages guide](https://vite.dev/guide/static-deploy#github-pages).

# Contributing

Use Node.js 24.15+ (24.x) and npm. Start with the [README](README.md), [architecture](docs/architecture.md), and the current stage in the [implementation plan](docs/implementation-plan.md).

```sh
npm ci
npm run dev
```

Keep changes focused on a stage or a clearly defined fix. Music and instrument rules belong in the pure domain; React components present those rules. Browser microphone and storage integrations belong in `src/platform/`. Do not request microphone access during app startup.

## Checks

```sh
npm run test:watch
npm run format
npm run check
```

The final command checks formatting, runs tests with coverage, type-checks, and builds. Coverage has an 85% minimum for lines, statements, functions, and branches. Add tests for meaningful behavior and edge cases; avoid tests that merely repeat implementation details or snapshot large screens.

- Test music rules with known examples and boundary cases.
- Test UI through accessible controls and visible outcomes using Testing Library.
- Keep tests beside the code they exercise; shared setup lives in `src/test/`.
- Add browser smoke tests in stage 1 and deterministic audio fixtures in stage 2.
- Distinguish mocked/synthetic audio checks from real microphone validation in change notes.

Use the checked-in lockfile. Commit dependency updates together with `package-lock.json`; keep generated `dist/`, `coverage/`, and `node_modules/` out of version control.

## Review notes

Describe the user-visible outcome, the checks performed, and any relevant limits. Update the implementation plan when a stage is completed, and keep README feature claims accurate. UI changes should be checked at desktop and narrow mobile sizes once browser coverage is introduced.

GitHub Pages deployment is manually triggered after Pages is configured to use GitHub Actions. Routine pushes and pull requests run checks and do not publish the site. Preserve the `/scale-dojo/` base path unless the hosting location changes.

The repository does not yet declare a project license; do not assume a licensing choice when adding source or assets.

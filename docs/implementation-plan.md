# Implementation plan

The bass scale/listen/review flow is implemented and ready for real-world testing. Use normal practice to find bugs and usability problems before adding features. Unscheduled ideas are kept in [future improvements](future-improvements.md).

## Stage 0 — Project foundation

Complete: React, TypeScript, Vite, music and instrument models, unit/component tests, coverage checks, CI, and GitHub Pages hosting.

## Stage 1 — Bass scale explorer

Complete: four-string fretboard through fret 12, scale circle and picker, root/scale markers, synthesized notes and scale playback, tempo, keyboard shortcuts, and zen/full views. Desktop and mobile Chromium smoke tests cover the production build. Pages deploys automatically after CI passes on `main`.

## Stage 2 — Microphone input and live note feedback

Complete: microphone Start/Stop, permission and device errors, monophonic pitch detection, adaptive noise gate, tuning, and scale feedback. Silence and unclear sound are separate from wrong notes. Matching fret positions are candidates, not a claim about fingering.

Synthetic tests cover E1–G4, noise, weak fundamentals, tuning, and note stability. A real-bass retest confirmed better pickup after the adaptive gate fix. Detailed measurements remain open; see [testing notes](testing.md).

## Stage 3 — Capture and review practice sequences

Complete: every listening run captures detected notes once the microphone is ready. Held notes stay together; repeats separated by silence stay separate. Sessions retain their starting scale and instrument, with note timings, membership, summaries, saved history, and confirmed deletion. Empty runs are discarded.

Sessions and preferences persist locally. Interrupted sessions restore for review without restarting listening, and storage failures offer recovery. Automated checks cover capture, review, reload, frozen context, errors, and interruptions. Real-bass segmentation still needs checking during normal practice.

## Current focus — Real-world testing

Follow the [manual checklist](testing.md#real-world-checklist) and record browser, device, input setup, and results. Prioritize:

- Missed notes, octave errors, tuning accuracy, delay, and flicker, especially on low E1 and soft plucks.
- Held/repeated notes and session boundaries during ordinary practice.
- Permission recovery, device loss, backgrounding, repeated Start/Stop, and saved-session review after reload.
- Mobile layout, keyboard use, focus, contrast, reduced motion, and screen-reader feedback.

Fix problems found in use, add regression coverage where useful, and keep `npm run check` passing. Broaden browser coverage and measure device performance as those setups are tested. Record limitations rather than treating synthetic tests as real-device validation.

# Testing notes

Automated checks cover domain rules, UI behavior, synthesized playback, microphone capture with fake input, and session persistence. Commands and setup are in [contributing](../CONTRIBUTING.md#checks).

Playwright runs the production build under `/scale-dojo/` on desktop Chromium (1440×1000) and mobile emulation (390×844), with 320px overflow checks. Its microphone plays a generated bass WAV through real browser capture and analysis. These checks do not validate physical microphones, speakers, or other browser engines.

## Detector benchmark

The results below were recorded on 2026-11-01 with `npm run bench:pitch` ([benchmark source](../src/domain/pitch/detector.benchmark.ts)). They compare the McLeod Pitch Method (MPM) with YIN across every semitone E1–G4 at 44.1/48 kHz, in tune and at +23/−37 cents: 240 windows per condition, with clarity ≥ 0.8 required. Both detectors are implemented locally.

Results for the shipped 4096-sample window:

| Signal                                                   | MPM correct note | MPM median / p95 error | YIN correct note          |
| -------------------------------------------------------- | ---------------- | ---------------------- | ------------------------- |
| Sine; bass-like harmonics                                | 100%             | 0.0 / 0.0 cents        | 100%                      |
| Bass-like, 20 dB SNR white noise                         | 100%             | 0.3 / 1.8 cents        | 100%                      |
| Bass-like, 10 dB SNR white noise                         | 100%             | 2.3 / 7.1 cents        | 92.9% (15 octave errors)  |
| Decaying pluck, stiff string (B = 0.0003)                | 100%             | 3.7 / 3.9 cents¹       | 100%                      |
| Phone-like timbre: fundamental at 8% of loudest harmonic | 100%             | 0.0 / 0.0 cents        | 100%                      |
| Phone-like timbre, 20 dB SNR                             | 100%             | 0.2 / 1.0 cents        | 100%                      |
| Strong even, weak odd harmonics                          | 100%             | 0.0 / 0.0 cents        | 27.5% (174 octave errors) |
| White noise, 50 windows                                  | 0 notes reported | —                      | 0 notes reported          |

¹ String stiffness raises partials, so both detectors read slightly sharp.

MPM avoided octave errors in heavy noise and the strong-even-harmonics test, at similar cost: about 4.2 ms per window versus YIN's 3.8 ms in Node on the development container. The benchmark also compared 2048- and 8192-sample windows. Although 2048 was equally accurate on these fixtures, it holds fewer than two E1 periods. The app uses a power-of-two window spanning at least 75 ms (4096 samples at 44.1/48 kHz).

## Accuracy, delay, and stability

Synthetic recordings met these targets:

- Correct note and octave for every semitone E1–G4, within 5 cents on clean tones; no octave errors on weak fundamentals, strong even harmonics, or 20 dB SNR noise.
- A clean note reported within 200 ms of onset for E1 and 150 ms from A1 upward, excluding browser input latency.
- One unbroken reading for a two-second decaying E1 with phone-like timbre; separate readings for repeats with 300 ms silence; no notes reported from trailing white noise.

Measured onset delay across eight onset phases at both sample rates:

| Note | Delay      |
| ---- | ---------- |
| E1   | 110–150 ms |
| A1   | 90–130 ms  |
| D2   | 80–115 ms  |
| G2   | 70–105 ms  |
| C3   | 65–100 ms  |
| G3   | 55–90 ms   |
| G4   | 50–85 ms   |

These targets are checked in [detector tests](../src/domain/pitch/detector.test.ts) and [stabilizer tests](../src/domain/pitch/stabilizer.test.ts).

## Real-world checklist

On 2026-11-01, a real-bass test found that normal plucks were missed by the fixed −48 dBFS gate. The adaptive gate replaced it, and the owner reported pickup was “much better than before.” Browser/device details and measured accuracy, latency, tuning, and stability were not supplied. Session segmentation with a real bass still needs checking.

Use the [deployed app](https://stefangluszek.github.io/scale-dojo/) or localhost. Try a microphone near an amplifier and, if available, an audio interface. Record the date, browser/version, device, input setup, and any voice processing shown by the app.

- Play each open string and frets 5, 7, and 12; make a slow chromatic run on the E string. Note missed notes, wrong octaves, delay, and tuning disagreement with a hardware tuner (target: within about 5 cents).
- Try soft plucks, held notes, and repeated notes with silence between them. Check flicker and whether session events match what you played.
- Change the scale while listening: live feedback should follow it, while the session keeps its starting context. Review timings, durations, and note counts after stopping.
- Deny/retry permission, disconnect the input, hide the page, and repeat Start/Stop. Check that listening and capture stop cleanly.
- Reload and review saved sessions/settings, clear a session, and check that listening stays off. A listen with no notes should leave no saved session.
- Check desktop/mobile layout, scrolling, keyboard controls, focus, contrast, reduced motion, and screen-reader feedback.

Record results and reproducible problems here as testing continues.

## Known limits

- Detection is monophonic. Chords and ringing strings can give an unclear or dominant-note reading.
- The frequency limits are 38–420 Hz; five-string B0 and drop-D's D1 are outside them. Phone/laptop microphones may capture low E1 poorly.
- Quiet notes need roughly 10 dB above background noise. The gate takes a few seconds to adapt upward; pitched hum can be read as a note. There is no manual gate control.
- Browsers may retain voice processing despite the app's request. Speaker playback can reach the microphone.
- Physical-device latency/CPU use, real-bass session segmentation, other browser engines, and assistive-technology behavior remain unverified.

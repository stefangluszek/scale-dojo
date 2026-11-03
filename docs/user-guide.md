# Using Scale Dojo

[Open the app](https://stefangluszek.github.io/scale-dojo/). It supports standard four-string bass tuning, E1–A1–D2–G2, with major, natural minor, major pentatonic, and minor pentatonic scales.

## Choose and hear a scale

The first visit opens in zen mode with C major pentatonic at 90 BPM. Tap the scale name in the circle to choose a root or scale; changes apply immediately. Close the picker with **Done**, Escape, or a tap outside. Press **?** or the header button to switch between zen mode and the full controls.

- The circle shows twelve semitones clockwise, with the root at the top. Lines join the scale notes; labels show degrees and the frets between notes.
- The fretboard runs from open strings through fret 12, with G2 at the top and E1 at the bottom. Scroll it sideways on small screens.
- Roots have an **R** and a square marker; other scale notes have a dot. Note names currently use sharps for accidentals.
- Tap any note to hear it, including notes outside the scale. Number keys play scale notes in order: **1** is the root, and **6** (pentatonic) or **8** (seven-note scales) is the root an octave up.
- In zen mode, **Space** plays the scale ascending at the saved tempo (90 BPM initially), and pressing it again stops playback. Space takes priority over a focused button there; press Enter to activate the button instead.
- In zen mode, **↑** and **↓** move the root up or down a semitone, and **←** and **→** step through the scales (major pentatonic, minor pentatonic, major, natural minor), wrapping around at either end. In the full view, Space and the arrow keys scroll the page as usual.

The full view adds ascending/descending playback at 40–240 BPM. Playback starts at the lowest root at or above E1 and includes the upper root. Changing root, scale, or tempo stops it, as does hiding the page. Tones are synthesized, not recorded bass samples.

Solid rings mark playback; dashed rings mark a note heard through the microphone. The circle highlights a note in any octave; the fretboard highlights its exact pitch. Shortcuts are ignored in text fields and dropdowns, with Ctrl/Alt/Cmd, and on key repeat. Arrow keys are also left to the picker's radio buttons and to the fretboard when it has focus, so it can scroll.

## Keep time with the metronome

Press the small **Play** button beside **Start listening** to start the metronome; press it again to stop. Edit the **BPM** field to change tempo, including while it is playing. The range is 40–240 BPM, shared with scale playback and saved in this browser. Empty edits restore the previous tempo when you leave the field; out-of-range values are limited to this range.

The metronome is available in both views and runs independently of microphone listening. Switching views keeps it running; hiding or leaving the page stops it. It never starts automatically when you return or reload.

## Listen to your bass

Press **Start listening**, allow microphone access, and play one note at a time. The readout shows the note and octave, tuning in cents, and whether it belongs to the selected scale. Silence and unclear sound never count as wrong notes. A pitch can occur on several strings, so all matching fret positions are marked.

The tested note range is E1–G4. Higher notes within that range still appear in the readout and circle even when they are above the displayed fretboard. Chords and ringing strings can produce an unclear or dominant-note reading.

If soft notes are missed, move the microphone closer to the bass or amplifier, or raise the device's microphone input volume. The noise gate adapts to the room; notes need to be about 10 dB louder than the background. The full view shows the input level and gate, plus any voice processing the browser kept enabled. Playback through speakers can also be picked up by the microphone.

Microphone access requires HTTPS or localhost. Permission, device, and browser errors show recovery instructions. **Stop listening** releases the microphone; hiding or leaving the page also stops it. Audio is analysed on your device and is never recorded, stored, or sent.

## Review a session

Every listening run becomes a session once the microphone is ready. **Stop listening** ends it; runs without detected notes are discarded. Review **Practice sessions** below the fretboard on the full page to see note timings, durations, scale membership, and a summary. From zen mode, press **?** or the **?** header button to open the full page. History remains browsable while listening. **Clear session** asks before deleting the selected session.

A session keeps the scale and tuning selected when capture began. Changing the current scale updates live feedback but leaves that session's classification unchanged. Held notes form one event; repeats separated by silence form separate events. The in-scale percentage counts note events, not time spent playing. Timings include the detector's confirmation and release delay.

Sessions and root, scale, tempo, and view preferences stay in this browser on this device. Clearing site data removes them. Listening never resumes automatically.

Sessions save at note boundaries and once per second. After a crash, the last checkpoint is restored as interrupted; up to the latest second may be missing. Storage errors offer retry/reset controls and keep the current review available in memory. Unreadable saved data is left untouched until you choose to reset it or save new data.

## Real-world testing

The app is ready for everyday bass practice testing. Automated audio checks use synthetic signals and Chromium's fake microphone. A real-bass retest confirmed improved pickup after the noise-gate fix; measured accuracy, latency, and stability on physical devices remain to be documented. See the [testing notes](testing.md) for results and a short checklist.

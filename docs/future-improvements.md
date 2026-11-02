# Possible future improvements

Ideas only, with no schedule or commitment. The current priority is testing and refining the existing four-string bass app.

## Additional instruments and tunings — much later

Possible additions: six-string guitar, other bass tunings or string counts, and a piano keyboard. Revisit only after the current bass workflow has had sustained real-world use.

If pursued:

- Define fretted instruments with tuning/range data and reuse the music and practice logic.
- Give piano its own renderer with correct key geometry and a stated visible range.
- Preserve scale selection when switching instruments; saved sessions must retain their original instrument and tuning.
- Test open strings, frets, piano key order, octave boundaries, switching, and session context.
- Validate any expanded detector range. The current 38–420 Hz limits exclude five-string B0 (30.9 Hz) and drop-D's D1 (36.7 Hz).

## Other ideas

- Key-aware note spelling, while preserving enharmonic pitch equality.
- Session export, cross-tab merging, or account-based synchronization.
- Raw audio recording, with separate controls and storage design.
- Chord recognition, MIDI input, accompaniment, or a metronome.
- Offline installation.
- AudioWorklet processing if measurements show main-thread analysis is too costly.

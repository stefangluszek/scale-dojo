# Instrument visualizations

`BassFretboard.tsx` implements the stage 1 four-string bass view, open through fret 12. It receives shared selection, active absolute pitch, and a note-play callback from app composition. Additional instruments remain stage 4 work.

Render positions using the shared instrument and music domain. Keep scale membership out of rendering calculations. Distinguish root notes with more than color, provide accessible labels, and make orientation and tuning clear. A detected pitch may match several positions; do not claim the microphone identifies a specific string or fret.

See [stage 1](../../../docs/implementation-plan.md#stage-1--bass-scale-explorer) and [stage 4](../../../docs/implementation-plan.md#stage-4--additional-instruments-and-tunings).

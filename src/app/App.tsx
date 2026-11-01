import { useState } from 'react';
import { STANDARD_BASS } from '../domain/instruments/fretted';
import { scalePlaybackNotes } from '../domain/music/playback';
import { type PitchClass, type ScaleId } from '../domain/music/scales';
import { BassFretboard } from '../features/instruments/BassFretboard';
import { ScaleExplorer } from '../features/scales/ScaleExplorer';
import { ScalePlayback } from '../features/scales/ScalePlayback';
import { useNotePlayback } from '../features/scales/useNotePlayback';

export function App() {
  const [root, setRoot] = useState<PitchClass>(0);
  const [scaleId, setScaleId] = useState<ScaleId>('major-pentatonic');
  const [tempo, setTempo] = useState(90);
  const playback = useNotePlayback();
  const notes = scalePlaybackNotes(root, scaleId, STANDARD_BASS.tuning[0]);
  const playNote = (note: number) => {
    void playback.play([note], tempo);
  };

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to practice
      </a>
      <div className="app-shell">
        <header className="site-header">
          <a className="wordmark" href="./" aria-label="Scale Dojo home">
            <span className="brand-symbol" aria-hidden="true">
              s/d
            </span>
            Scale Dojo
          </a>
          <span className="preview-badge">Early preview</span>
        </header>

        <main id="main">
          <section className="intro" aria-labelledby="page-heading">
            <p className="eyebrow">A little practice. A better ear.</p>
            <h1 id="page-heading">
              Make every note <br />
              <em>intentional.</em>
            </h1>
            <p className="intro-copy">
              Get to know a scale, one note at a time. A focused practice space,
              starting with bass guitar.
            </p>
          </section>

          <div className="practice-space">
            <ScaleExplorer
              root={root}
              scaleId={scaleId}
              playbackNotes={notes}
              onRootChange={(value) => {
                playback.stop();
                setRoot(value);
              }}
              onScaleChange={(value) => {
                playback.stop();
                setScaleId(value);
              }}
              onPlayNote={playNote}
            />
            <ScalePlayback
              notes={notes}
              tempo={tempo}
              isPlaying={playback.isPlaying}
              activeNote={playback.activeNote}
              error={playback.error}
              onTempoChange={(value) => {
                playback.stop();
                setTempo(value);
              }}
              onPlay={(sequence) => {
                void playback.play(sequence, tempo);
              }}
              onStop={playback.stop}
            />
            <BassFretboard
              root={root}
              scaleId={scaleId}
              activeNote={playback.activeNote}
              onPlayNote={playNote}
            />
          </div>

          <section className="coming-next" aria-labelledby="next-heading">
            <p className="eyebrow">The practice ahead</p>
            <h2 id="next-heading">From knowing to hearing.</h2>
            <p>
              Live microphone feedback and a record of the notes you play are
              planned for later stages. For now, explore the neck and hear each
              scale.
            </p>
            <ol className="practice-steps">
              <li>
                <span>01</span>
                <div>
                  <h3>See the scale</h3>
                  <p>Ready now: explore the fretboard and hear its notes.</p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <h3>Play & listen</h3>
                  <p>Planned: hear your bass and see which notes belong.</p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <h3>Follow your progress</h3>
                  <p>Planned: review a sequence, note by note.</p>
                </div>
              </li>
            </ol>
          </section>
        </main>

        <footer className="site-footer">
          <span>Built for the practice, not the performance.</span>
          <a href="https://github.com/stefangluszek/scale-dojo">
            Follow the project <span aria-hidden="true">↗</span>
          </a>
        </footer>
      </div>
    </>
  );
}

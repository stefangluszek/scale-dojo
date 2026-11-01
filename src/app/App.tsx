import { ScaleExplorer } from '../features/scales/ScaleExplorer';

export function App() {
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

          <ScaleExplorer />

          <section className="coming-next" aria-labelledby="next-heading">
            <p className="eyebrow">The practice ahead</p>
            <h2 id="next-heading">From knowing to hearing.</h2>
            <p>
              Fretboard maps, live microphone feedback, and a record of the
              notes you play are planned for the next stages.
            </p>
            <ol className="practice-steps">
              <li>
                <span>01</span>
                <div>
                  <h3>See the scale</h3>
                  <p>Find its notes across the fretboard.</p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <h3>Play & listen</h3>
                  <p>Hear your bass. See which notes belong.</p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <h3>Follow your progress</h3>
                  <p>Review a sequence, note by note.</p>
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

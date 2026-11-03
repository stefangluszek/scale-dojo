import { positionsOfNote, STANDARD_BASS } from '../domain/instruments/fretted';
import { scalePlaybackNotes } from '../domain/music/playback';
import {
  cycleScale,
  normalizePitchClass,
  scaleQuality,
  type PitchClass,
  type ScaleId,
} from '../domain/music/scales';
import {
  BassFretboard,
  HIGHEST_FRET_SHOWN,
} from '../features/instruments/BassFretboard';
import { ListenPanel } from '../features/practice/ListenPanel';
import { useLiveNote } from '../features/practice/useLiveNote';
import { ScaleExplorer } from '../features/scales/ScaleExplorer';
import { ScalePlayback } from '../features/scales/ScalePlayback';
import { useNotePlayback } from '../features/scales/useNotePlayback';
import { SessionPanel } from '../features/sessions/SessionPanel';
import { usePracticeSessions } from '../features/sessions/usePracticeSessions';
import {
  DEFAULT_SETTINGS,
  isSettings,
  SETTINGS_KEY,
  type Settings,
} from '../platform/storage/settings';
import { useStoredState } from '../platform/storage/useStoredState';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';

/** Key that toggles between zen mode and the full page. */
const VIEW_TOGGLE_KEY = '?';

export function App() {
  const preferences = useStoredState(
    SETTINGS_KEY,
    isSettings,
    DEFAULT_SETTINGS,
  );
  const { root, scaleId, tempo, view } = preferences.value;
  const setRoot = (root: PitchClass) =>
    preferences.update((settings) => ({ ...settings, root }));
  const setScaleId = (scaleId: ScaleId) =>
    preferences.update((settings) => ({ ...settings, scaleId }));
  const setTempo = (tempo: number) =>
    preferences.update((settings) => ({ ...settings, tempo }));
  const setView = (view: Settings['view']) =>
    preferences.update((settings) => ({ ...settings, view }));
  const playback = useNotePlayback();
  const sessions = usePracticeSessions();
  // Every listening run is a session, frozen to the scale chosen when the
  // microphone becomes ready.
  const listening = useLiveNote({
    onReady: () => sessions.begin({ root, scaleId, instrument: STANDARD_BASS }),
    onReading: sessions.onReading,
    onStop: sessions.finish,
  });
  const heardNote =
    listening.status === 'listening' && listening.reading.kind === 'note'
      ? listening.reading.midi
      : null;
  const zen = view === 'zen';
  const notes = scalePlaybackNotes(root, scaleId, STANDARD_BASS.tuning[0]);
  const playNote = (note: number) => {
    void playback.play([note], tempo);
  };
  const playScale = () => {
    void playback.play(notes, tempo);
  };
  const toggleView = () => setView(zen ? 'full' : 'zen');
  const changeRoot = (value: PitchClass) => {
    playback.stop();
    setRoot(value);
  };
  const changeScale = (value: ScaleId) => {
    playback.stop();
    setScaleId(value);
  };
  const changeTempo = (value: number) => {
    if (value === tempo) return;
    playback.stop();
    setTempo(value);
  };

  useKeyboardShortcuts({
    [VIEW_TOGGLE_KEY]: toggleView,
    // 1 plays the root, 2 the next scale note, and so on; the last number
    // plays the root an octave up.
    ...Object.fromEntries(
      notes.map((note, index) => [String(index + 1), () => playNote(note)]),
    ),
    // Zen has no root, scale or playback controls. Space plays the scale
    // ascending at the saved tempo, or stops it. Arrows step through roots
    // and scales: up and down move the root a semitone, left and right cycle
    // the scales. The full page keeps Space and arrows for scrolling.
    ...(zen
      ? {
          ' ': () => (playback.isPlaying ? playback.stop() : playScale()),
          ArrowUp: () => changeRoot(normalizePitchClass(root + 1)),
          ArrowDown: () => changeRoot(normalizePitchClass(root - 1)),
          ArrowRight: () => changeScale(cycleScale(scaleId, 1)),
          ArrowLeft: () => changeScale(cycleScale(scaleId, -1)),
        }
      : {}),
  });

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to practice
      </a>
      {/* Both views share one tree, so the toggle, circle and fretboard keep
          focus and playback highlights when the view changes. */}
      <div className="app-shell" data-view={view}>
        <header className="site-header">
          <a className="wordmark" href="./" aria-label="Scale Dojo home">
            <span className="brand-symbol" aria-hidden="true">
              s/d
            </span>
            {!zen && 'Scale Dojo'}
          </a>
          <div className="header-actions">
            {!zen && <span className="preview-badge">Early preview</span>}
            <button
              type="button"
              className="view-toggle"
              aria-label={zen ? 'Show full page' : 'Enter zen mode'}
              aria-keyshortcuts={VIEW_TOGGLE_KEY}
              title={`${zen ? 'Show full page' : 'Zen mode'} (${VIEW_TOGGLE_KEY})`}
              onClick={toggleView}
            >
              {zen ? (
                <span aria-hidden="true">{VIEW_TOGGLE_KEY}</span>
              ) : (
                <>
                  Zen mode
                  <kbd aria-hidden="true">{VIEW_TOGGLE_KEY}</kbd>
                </>
              )}
            </button>
          </div>
        </header>

        <main id="main">
          {preferences.problem && (
            <div className="storage-warning" role="alert">
              <p>
                {preferences.problem === 'invalid'
                  ? 'Saved settings could not be read. Default settings are in use.'
                  : 'Settings could not be saved on this device. Changes will last until you leave the page.'}
              </p>
              <button onClick={preferences.retry}>
                {preferences.problem === 'invalid'
                  ? 'Save default settings'
                  : 'Retry saving settings'}
              </button>
            </div>
          )}
          {zen ? (
            <h1 className="sr-only">Scale Dojo</h1>
          ) : (
            <section className="intro" aria-labelledby="page-heading">
              <p className="eyebrow">A little practice. A better ear.</p>
              <h1 id="page-heading">
                Make every note <br />
                <em>intentional.</em>
              </h1>
              <p className="intro-copy">
                Get to know a scale, one note at a time. A focused practice
                space, starting with bass guitar.
              </p>
            </section>
          )}

          {/* Scale colors follow the scale's mood: bright major, darker minor. */}
          <div className="practice-space" data-quality={scaleQuality(scaleId)}>
            <ScaleExplorer
              minimal={zen}
              root={root}
              scaleId={scaleId}
              playbackNotes={notes}
              activeNote={playback.activeNote}
              heardNote={heardNote}
              onRootChange={changeRoot}
              onScaleChange={changeScale}
              onPlayNote={playNote}
            />
            {!zen && (
              <ScalePlayback
                notes={notes}
                tempo={tempo}
                isPlaying={playback.isPlaying}
                activeNote={playback.activeNote}
                error={playback.error}
                onTempoChange={changeTempo}
                onPlay={(sequence) => {
                  void playback.play(sequence, tempo);
                }}
                onStop={playback.stop}
              />
            )}
            <ListenPanel
              minimal={zen}
              root={root}
              scaleId={scaleId}
              listening={listening}
              tempo={tempo}
              onTempoChange={changeTempo}
              fretboardMatches={
                heardNote === null
                  ? 0
                  : positionsOfNote(
                      STANDARD_BASS,
                      heardNote,
                      HIGHEST_FRET_SHOWN,
                    ).length
              }
            />
            <BassFretboard
              minimal={zen}
              root={root}
              scaleId={scaleId}
              activeNote={playback.activeNote}
              heardNote={heardNote}
              onPlayNote={playNote}
            />
            <SessionPanel
              sessions={sessions}
              root={root}
              scaleId={scaleId}
              minimal={zen}
            />
            {/* Playback controls are hidden in zen; notes can still fail. */}
            {zen && playback.error && (
              <p className="audio-error" role="alert">
                {playback.error}
              </p>
            )}
          </div>

          {!zen && (
            <section className="coming-next" aria-labelledby="next-heading">
              <p className="eyebrow">The practice ahead</p>
              <h2 id="next-heading">From knowing to hearing.</h2>
              <p>
                Explore the neck, hear each scale, then play it back on your
                bass and see which notes belong. Each time you listen is saved
                as a session, so you can review the notes you played.
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
                    <p>Ready now: play your bass and see which notes belong.</p>
                  </div>
                </li>
                <li>
                  <span>03</span>
                  <div>
                    <h3>Follow your progress</h3>
                    <p>Ready now: save and review a sequence, note by note.</p>
                  </div>
                </li>
              </ol>
            </section>
          )}
        </main>

        {!zen && (
          <footer className="site-footer">
            <span>Built for the practice, not the performance.</span>
            <a href="https://github.com/stefangluszek/scale-dojo">
              Follow the project <span aria-hidden="true">↗</span>
            </a>
          </footer>
        )}
      </div>
    </>
  );
}

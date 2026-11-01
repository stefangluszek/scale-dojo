import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { STANDARD_BASS } from '../domain/instruments/fretted';
import type { PracticeSession } from '../domain/practice/session';
import { MicrophoneError } from '../platform/audio/MicrophoneInput';
import { SESSIONS_KEY } from '../platform/storage/sessions';
import { fakeMicrophone } from '../test/fakeMicrophone';
import { renderFullPage } from '../test/renderApp';
import { App } from './App';

afterEach(() => vi.restoreAllMocks());
const panel = () =>
  within(screen.getByRole('region', { name: 'Practice sessions' }));
const events = () =>
  within(panel().getByRole('list', { name: 'Captured notes' })).getAllByRole(
    'listitem',
  );
const history = () =>
  within(panel().getByRole('list', { name: 'Saved sessions' }));
const stored = () => JSON.parse(localStorage.getItem(SESSIONS_KEY)!).value;
const startListening = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: 'Start listening' }));
const stopListening = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: 'Stop listening' }));

describe('practice sessions', () => {
  it('captures each listen as a session with held and repeated notes, frozen classification, and history across reload', async () => {
    const mic = fakeMicrophone();
    const user = userEvent.setup();
    const app = renderFullPage();
    expect(panel().getByRole('status')).toHaveTextContent('No sessions yet');
    // Listening is the only control: there is no separate session button.
    expect(
      panel().queryByRole('button', { name: /start session/i }),
    ).not.toBeInTheDocument();
    await startListening(user);
    expect(localStorage.getItem(SESSIONS_KEY)).toBeNull();
    await mic.grant();
    expect(panel().getByRole('status')).toHaveTextContent(
      'Recording C major pentatonic · 0 notes',
    );
    mic.hear(28, 0, 6);
    expect(events()).toHaveLength(1);
    mic.quiet();
    mic.hear(28);
    mic.hear(29);
    expect(events()).toHaveLength(3);
    expect(events()[2]).toHaveTextContent('F1Outside scale');
    await user.selectOptions(
      screen.getByLabelText('Scale', { exact: true }),
      'major',
    );
    // F is now in the explorer's C major, but outside the captured pentatonic.
    expect(events()[2]).toHaveTextContent('Outside scale');
    expect(panel().getByRole('status')).toHaveTextContent(
      'Recording C major pentatonic · 3 notes',
    );
    await stopListening(user);
    expect(mic.stop).toHaveBeenCalled();
    expect(panel().getByRole('status')).toHaveTextContent(
      'Session ready to review',
    );
    expect(panel().getByText('67%')).toBeInTheDocument();
    expect(stored()[0].status).toBe('completed');
    expect(stored()[0].scaleId).toBe('major-pentatonic');
    expect(stored()[0].events[0].endMs).toBeGreaterThan(
      stored()[0].events[0].startMs,
    );
    app.unmount();
    render(<App />);
    expect(events()).toHaveLength(3);
    expect(screen.getByLabelText('Scale', { exact: true })).toHaveValue(
      'major',
    );
    expect(mic.start).toHaveBeenCalledOnce();
    // Listening again starts a second session with the new scale.
    await startListening(user);
    await mic.grant();
    mic.hear(29);
    await stopListening(user);
    expect(events()[0]).toHaveTextContent('In scale');
    expect(history().getAllByRole('button')).toHaveLength(2);
    await user.click(
      history().getByRole('button', { name: /C major pentatonic/ }),
    );
    expect(events()).toHaveLength(3);
    await user.click(panel().getByRole('button', { name: 'Clear session' }));
    await user.click(panel().getByRole('button', { name: 'Keep session' }));
    expect(events()).toHaveLength(3);
    await user.click(panel().getByRole('button', { name: 'Clear session' }));
    await user.click(panel().getByRole('button', { name: 'Confirm clear' }));
    expect(stored()).toHaveLength(1);
    expect(events()).toHaveLength(1);
  });

  it('discards a listen with no notes and stays out of zen mode', async () => {
    const mic = fakeMicrophone();
    const user = userEvent.setup();
    render(<App />);
    await startListening(user);
    await mic.grant();
    mic.quiet();
    expect(
      screen.queryByRole('region', { name: 'Practice sessions' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sessions' }));
    expect(
      panel().getByRole('heading', { name: 'Practice sessions' }),
    ).toHaveFocus();
    expect(panel().getByRole('status')).toHaveTextContent(
      'Recording C major pentatonic · 0 notes',
    );
    expect(panel().getByText(/Play one note at a time/)).toBeInTheDocument();
    expect(panel().getByText('—')).toBeInTheDocument();
    expect(
      panel().queryByRole('button', { name: 'Clear session' }),
    ).not.toBeInTheDocument();
    await stopListening(user);
    expect(panel().getByRole('status')).toHaveTextContent('No sessions yet');
    expect(stored()).toEqual([]);
  });

  it('lets you review and clear earlier sessions while listening', async () => {
    const mic = fakeMicrophone();
    const user = userEvent.setup();
    renderFullPage();
    await startListening(user);
    await mic.grant();
    mic.hear(28);
    await stopListening(user);
    await user.selectOptions(
      screen.getByLabelText('Scale', { exact: true }),
      'major',
    );
    await startListening(user);
    await mic.grant();
    mic.hear(29);
    // The new session is selected and marked as recording in the history.
    expect(events()).toHaveLength(1);
    expect(events()[0]).toHaveTextContent('F1In scale');
    const live = history().getByRole('button', { name: /recording$/ });
    expect(live).toHaveAttribute('aria-pressed', 'true');
    const earlier = history().getByRole('button', {
      name: /C major pentatonic/,
    });
    expect(earlier).toBeEnabled();
    await user.click(earlier);
    expect(events()[0]).toHaveTextContent('E1In scale');
    // The status keeps describing the session being recorded.
    expect(panel().getByRole('status')).toHaveTextContent(
      'Recording C major · 1 note ·',
    );
    await user.click(panel().getByRole('button', { name: 'Clear session' }));
    await user.click(panel().getByRole('button', { name: 'Confirm clear' }));
    expect(stored()).toHaveLength(1);
    expect(stored()[0].status).toBe('recording');
    await stopListening(user);
    expect(stored()[0].status).toBe('completed');
    expect(events()[0]).toHaveTextContent('F1');
    expect(
      history().queryByRole('button', { name: /recording/ }),
    ).not.toBeInTheDocument();
  });

  it('does not save a session when permission is denied or cancelled', async () => {
    const mic = fakeMicrophone();
    const user = userEvent.setup();
    renderFullPage();
    await startListening(user);
    await mic.refuse(new MicrophoneError('denied'));
    expect(screen.getByRole('alert')).toHaveTextContent('blocked');
    expect(localStorage.getItem(SESSIONS_KEY)).toBeNull();
    await startListening(user);
    await stopListening(user);
    await mic.cancel();
    expect(localStorage.getItem(SESSIONS_KEY)).toBeNull();
    expect(panel().getByRole('status')).toHaveTextContent('No sessions yet');
  });

  it.each(['hidden', 'device', 'pagehide'] as const)(
    'keeps captured notes when interrupted by %s',
    async (reason) => {
      const mic = fakeMicrophone();
      const user = userEvent.setup();
      renderFullPage();
      await startListening(user);
      await mic.grant();
      mic.hear(28);
      if (reason === 'hidden') {
        vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
        fireEvent(document, new Event('visibilitychange'));
      } else if (reason === 'device') mic.lose();
      else fireEvent(window, new Event('pagehide'));
      expect(
        screen.getByRole('button', { name: 'Start listening' }),
      ).toBeVisible();
      expect(stored()[0].status).toBe('interrupted');
      expect(events()).toHaveLength(1);
      expect(
        panel().getByText(/Capture ended when listening was interrupted/),
      ).toBeInTheDocument();
    },
  );

  it('recovers checkpoints as interrupted sessions without restarting the microphone', async () => {
    const mic = fakeMicrophone();
    const user = userEvent.setup();
    const app = renderFullPage();
    await startListening(user);
    await mic.grant();
    mic.hear(28, 0, 10);
    // The periodic checkpoint includes the latest held-note duration.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1100));
    });
    const checkpoint = localStorage.getItem(SESSIONS_KEY)!;
    expect(JSON.parse(checkpoint).value[0].events[0].endMs).toBeGreaterThan(
      JSON.parse(checkpoint).value[0].events[0].startMs,
    );
    app.unmount();
    localStorage.setItem(SESSIONS_KEY, checkpoint); // Simulate a crash before teardown could save.
    render(<App />);
    expect(
      panel().getByText(/Capture ended when listening was interrupted/),
    ).toBeInTheDocument();
    expect(mic.start).toHaveBeenCalledOnce();
    expect(events()).toHaveLength(1);
  });

  it('drops a checkpoint saved before the first note', async () => {
    const mic = fakeMicrophone();
    const user = userEvent.setup();
    const app = renderFullPage();
    await startListening(user);
    await mic.grant();
    const checkpoint = localStorage.getItem(SESSIONS_KEY)!;
    expect(JSON.parse(checkpoint).value).toHaveLength(1);
    app.unmount();
    localStorage.setItem(SESSIONS_KEY, checkpoint); // Simulate a crash.
    render(<App />);
    expect(panel().getByRole('status')).toHaveTextContent('No sessions yet');
  });

  it('keeps notes usable when saving fails, warns in zen mode, and lets the user retry', async () => {
    const mic = fakeMicrophone();
    const user = userEvent.setup();
    renderFullPage();
    const write = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new DOMException('full', 'QuotaExceededError');
      });
    await startListening(user);
    await mic.grant();
    mic.hear(29);
    await stopListening(user);
    expect(panel().getByRole('alert')).toHaveTextContent('could not be saved');
    expect(events()).toHaveLength(1);
    write.mockRestore();
    await user.click(screen.getByRole('button', { name: 'Enter zen mode' }));
    // Zen mode hides sessions, but not a problem saving them.
    expect(panel().getByRole('alert')).toHaveTextContent('could not be saved');
    expect(
      panel().queryByRole('list', { name: 'Captured notes' }),
    ).not.toBeInTheDocument();
    await user.click(
      panel().getByRole('button', { name: 'Retry saving sessions' }),
    );
    expect(
      screen.queryByRole('region', { name: 'Practice sessions' }),
    ).not.toBeInTheDocument();
    expect(stored()[0].events).toHaveLength(1);
  });

  it('still shows empty sessions saved before empty listens were discarded', () => {
    const empty: PracticeSession = {
      id: 'earlier',
      root: 0,
      scaleId: 'major',
      instrument: STANDARD_BASS,
      startedAt: Date.now(),
      durationMs: 2000,
      status: 'completed',
      events: [],
    };
    localStorage.setItem(
      SESSIONS_KEY,
      JSON.stringify({ version: 1, value: [empty] }),
    );
    renderFullPage();
    expect(panel().getByText('No notes captured.')).toBeInTheDocument();
    expect(
      panel().getByRole('button', { name: 'Clear session' }),
    ).toBeVisible();
  });

  it('recovers from malformed history without blocking practice', async () => {
    localStorage.setItem(SESSIONS_KEY, '{bad');
    const user = userEvent.setup();
    renderFullPage();
    expect(panel().getByRole('alert')).toHaveTextContent('could not be read');
    await user.click(
      panel().getByRole('button', { name: 'Reset saved sessions' }),
    );
    expect(panel().queryByRole('alert')).not.toBeInTheDocument();
    expect(stored()).toEqual([]);
  });
});

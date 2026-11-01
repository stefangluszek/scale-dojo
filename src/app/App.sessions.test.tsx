import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
const stored = () => JSON.parse(localStorage.getItem(SESSIONS_KEY)!).value;

describe('practice sessions', () => {
  it('captures held and repeated notes, freezes classification, and restores history on reload', async () => {
    const mic = fakeMicrophone();
    const user = userEvent.setup();
    const app = renderFullPage();
    await user.click(panel().getByRole('button', { name: 'Start session' }));
    expect(panel().getByRole('status')).toHaveTextContent(
      'Waiting for the microphone',
    );
    await mic.grant();
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
    await user.click(panel().getByRole('button', { name: 'Stop session' }));
    expect(mic.stop).toHaveBeenCalled();
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
    // A second session retains the first and uses the new scale.
    await user.click(panel().getByRole('button', { name: 'Start session' }));
    await mic.grant();
    mic.hear(29);
    await user.click(panel().getByRole('button', { name: 'Stop session' }));
    expect(events()[0]).toHaveTextContent('In scale');
    const history = within(
      panel().getByRole('list', { name: 'Saved sessions' }),
    );
    expect(history.getAllByRole('button')).toHaveLength(2);
    await user.click(
      history.getByRole('button', { name: /C major pentatonic/ }),
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

  it('can capture while already listening, stop from zen, and review an empty session', async () => {
    const mic = fakeMicrophone();
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Start listening' }));
    await mic.grant();
    await user.click(screen.getByRole('button', { name: 'Sessions' }));
    expect(
      panel().getByRole('heading', { name: 'Practice sessions' }),
    ).toHaveFocus();
    await user.click(panel().getByRole('button', { name: 'Start session' }));
    expect(mic.start).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button', { name: 'Enter zen mode' }));
    expect(panel().getByRole('button', { name: 'Stop session' })).toBeVisible();
    await user.click(panel().getByRole('button', { name: 'Stop session' }));
    await user.click(screen.getByRole('button', { name: 'Sessions' }));
    expect(panel().getByText(/No notes captured/)).toBeInTheDocument();
    expect(panel().getByText('—')).toBeInTheDocument();
    await user.click(panel().getByRole('button', { name: 'Clear session' }));
    await user.click(panel().getByRole('button', { name: 'Confirm clear' }));
    expect(panel().getByRole('status')).toHaveTextContent('No sessions yet');
    expect(stored()).toEqual([]);
  });

  it('does not save a session when permission is denied or cancelled, and supports retry', async () => {
    const mic = fakeMicrophone();
    const user = userEvent.setup();
    renderFullPage();
    await user.click(panel().getByRole('button', { name: 'Start session' }));
    await mic.refuse(new MicrophoneError('denied'));
    expect(screen.getByRole('alert')).toHaveTextContent('blocked');
    expect(
      panel().getByRole('button', { name: 'Start session' }),
    ).toBeVisible();
    expect(localStorage.getItem(SESSIONS_KEY)).toBeNull();
    await user.click(panel().getByRole('button', { name: 'Start session' }));
    await user.click(panel().getByRole('button', { name: 'Stop session' }));
    await mic.cancel();
    expect(localStorage.getItem(SESSIONS_KEY)).toBeNull();
    // Capture can join an existing pending listening request.
    await user.click(screen.getByRole('button', { name: 'Start listening' }));
    await user.click(panel().getByRole('button', { name: 'Start session' }));
    await mic.grant();
    mic.hear(28);
    await user.click(screen.getByRole('button', { name: 'Stop listening' }));
    expect(stored()[0].events).toHaveLength(1);
  });

  it.each(['hidden', 'device', 'pagehide'] as const)(
    'keeps captured notes when interrupted by %s',
    async (reason) => {
      const mic = fakeMicrophone();
      const user = userEvent.setup();
      renderFullPage();
      await user.click(panel().getByRole('button', { name: 'Start session' }));
      await mic.grant();
      mic.hear(28);
      if (reason === 'hidden') {
        vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
        fireEvent(document, new Event('visibilitychange'));
      } else if (reason === 'device') mic.lose();
      else fireEvent(window, new Event('pagehide'));
      expect(
        panel().getByRole('button', { name: 'Start session' }),
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
    await user.click(panel().getByRole('button', { name: 'Start session' }));
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

  it('keeps notes usable when saving fails and lets the user retry', async () => {
    const mic = fakeMicrophone();
    const user = userEvent.setup();
    renderFullPage();
    const write = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new DOMException('full', 'QuotaExceededError');
      });
    await user.click(panel().getByRole('button', { name: 'Start session' }));
    await mic.grant();
    mic.hear(29);
    await user.click(panel().getByRole('button', { name: 'Stop session' }));
    expect(panel().getByRole('alert')).toHaveTextContent('could not be saved');
    expect(events()).toHaveLength(1);
    write.mockRestore();
    await user.click(
      panel().getByRole('button', { name: 'Retry saving sessions' }),
    );
    expect(panel().queryByRole('alert')).not.toBeInTheDocument();
    expect(stored()[0].events).toHaveLength(1);
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

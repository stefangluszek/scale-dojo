import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Metronome } from '../platform/audio/Metronome';
import { NotePlayer } from '../platform/audio/NotePlayer';
import { fakeMicrophone } from '../test/fakeMicrophone';
import { App } from './App';

beforeEach(() => {
  vi.spyOn(Metronome.prototype, 'start').mockResolvedValue(undefined);
});
afterEach(() => vi.restoreAllMocks());

describe('practice metronome', () => {
  it('plays independently of listening, and keeps running across views', async () => {
    const microphone = fakeMicrophone();
    const stop = vi.spyOn(Metronome.prototype, 'stop');
    const user = userEvent.setup();
    render(<App />);
    expect(Metronome.prototype.start).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Start metronome' }));
    expect(Metronome.prototype.start).toHaveBeenCalledWith(90);
    expect(
      screen.getByRole('button', { name: 'Stop metronome' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(microphone.start).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Show full page' }));
    expect(
      screen.getByRole('button', { name: 'Stop metronome' }),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Start listening' }));
    await microphone.grant();
    expect(
      screen.getByRole('button', { name: 'Stop metronome' }),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Stop metronome' }));
    expect(stop).toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: 'Stop listening' }),
    ).toBeVisible();
  });

  it('edits and saves the shared tempo while playing, without triggering note shortcuts', async () => {
    const setTempo = vi.spyOn(Metronome.prototype, 'setTempo');
    const play = vi.spyOn(NotePlayer.prototype, 'play');
    const user = userEvent.setup();
    const view = render(<App />);
    await user.click(screen.getByRole('button', { name: 'Start metronome' }));
    const field = screen.getByRole('spinbutton', { name: 'Metronome tempo' });
    await user.clear(field);
    await user.type(field, '137');
    await user.keyboard('{Enter}');
    expect(field).toHaveValue(137);
    expect(setTempo).toHaveBeenLastCalledWith(137);
    expect(Metronome.prototype.start).toHaveBeenCalledOnce();
    expect(play).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Show full page' }));
    expect(screen.getByRole('slider', { name: 'Tempo' })).toHaveValue('137');
    fireEvent.change(screen.getByRole('slider', { name: 'Tempo' }), {
      target: { value: '120' },
    });
    expect(field).toHaveValue(120);
    expect(setTempo).toHaveBeenLastCalledWith(120);
    view.unmount();
    render(<App />);
    expect(
      screen.getByRole('spinbutton', { name: 'Metronome tempo' }),
    ).toHaveValue(120);
    expect(
      screen.getByRole('button', { name: 'Start metronome' }),
    ).toBeVisible();
    expect(Metronome.prototype.start).toHaveBeenCalledOnce();
  });

  it('allows partial edits and restores or bounds invalid BPM on blur', async () => {
    const user = userEvent.setup();
    render(<App />);
    const field = screen.getByRole('spinbutton', { name: 'Metronome tempo' });
    await user.clear(field);
    expect(field).toHaveValue(null);
    await user.tab();
    expect(field).toHaveValue(90);
    for (const [input, expected] of [
      ['0', 40],
      ['999', 240],
      ['100.5', 101],
    ] as const) {
      fireEvent.change(field, { target: { value: input } });
      fireEvent.blur(field);
      expect(field).toHaveValue(expected);
    }
  });

  it('stops on hiding, page exit and unmount', async () => {
    const stop = vi.spyOn(Metronome.prototype, 'stop');
    const dispose = vi.spyOn(Metronome.prototype, 'dispose');
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    await user.click(screen.getByRole('button', { name: 'Start metronome' }));
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    fireEvent(document, new Event('visibilitychange'));
    expect(
      screen.getByRole('button', { name: 'Stop metronome' }),
    ).toBeVisible();
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    fireEvent(document, new Event('visibilitychange'));
    expect(
      screen.getByRole('button', { name: 'Start metronome' }),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Start metronome' }));
    fireEvent(window, new Event('pagehide'));
    expect(
      screen.getByRole('button', { name: 'Start metronome' }),
    ).toBeVisible();
    expect(stop).toHaveBeenCalledTimes(2);
    unmount();
    expect(dispose).toHaveBeenCalledOnce();
  });

  it('reports startup failures and recovers on retry', async () => {
    vi.mocked(Metronome.prototype.start)
      .mockRejectedValueOnce(new Error('Audio unavailable'))
      .mockRejectedValueOnce('Unknown failure');
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Start metronome' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Audio unavailable');
    await user.click(screen.getByRole('button', { name: 'Start metronome' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'The metronome could not start',
    );
    await user.click(screen.getByRole('button', { name: 'Start metronome' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('ignores a stale startup failure after Stop', async () => {
    let reject!: (cause: Error) => void;
    vi.mocked(Metronome.prototype.start).mockReturnValue(
      new Promise<void>((_resolve, rejectPromise) => {
        reject = rejectPromise;
      }),
    );
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Start metronome' }));
    await user.click(screen.getByRole('button', { name: 'Stop metronome' }));
    await act(async () => reject(new Error('Old failure')));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Start metronome' }),
    ).toBeVisible();
  });
});

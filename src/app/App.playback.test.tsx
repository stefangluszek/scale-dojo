import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NotePlayer } from '../platform/audio/NotePlayer';
import { App } from './App';

afterEach(() => vi.restoreAllMocks());

describe('bass explorer and playback integration', () => {
  it('renders labeled strings, open notes, fret 12, repeated pitches and non-color root cues', () => {
    render(<App />);
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('button')).toHaveLength(52);
    expect(
      within(table)
        .getAllByRole('rowheader')
        .map((row) => row.textContent),
    ).toEqual(['G2', 'D2', 'A1', 'E1']);
    expect(
      screen.getByRole('button', {
        name: 'E1 string, open, E1, scale note. Play note',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: 'G2 string, fret 12, G3, scale note. Play note',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: 'E1 string, fret 8, C2, root. Play note',
      }),
    ).toHaveTextContent('R');
    expect(
      screen.getByRole('button', {
        name: 'A1 string, fret 3, C2, root. Play note',
      }),
    ).toHaveTextContent('R');
    expect(
      screen.getByRole('button', {
        name: 'D2 string, fret 10, C3, root. Play note',
      }),
    ).toHaveTextContent('R');
    expect(
      screen.getByRole('button', {
        name: 'E1 string, fret 1, F1, outside scale. Play note',
      }),
    ).toBeInTheDocument();
  });

  it('keeps roots, membership, and playback synchronized with both selectors', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.selectOptions(screen.getByLabelText('Root note'), '9');
    await user.selectOptions(
      screen.getByLabelText('Scale', { exact: true }),
      'natural-minor',
    );
    expect(
      screen.getByRole('button', {
        name: 'A1 string, open, A1, root. Play note',
      }),
    ).toHaveTextContent('R');
    expect(
      screen.getByRole('button', {
        name: 'E1 string, fret 8, C2, scale note. Play note',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: 'E1 string, fret 1, F1, scale note. Play note',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/One octave, A1–A2/)).toBeInTheDocument();
  });

  it('plays chips and frets with keyboard input and highlights every matching absolute pitch', async () => {
    const play = vi
      .spyOn(NotePlayer.prototype, 'play')
      .mockImplementation(async (notes, _tempo, onNote) => {
        onNote(notes[0]!);
      });
    const user = userEvent.setup();
    render(<App />);
    const chip = screen.getByRole('button', { name: 'Play C2, root' });
    chip.focus();
    await user.keyboard('{Enter}');
    expect(play.mock.calls[0]!.slice(0, 2)).toEqual([[36], 90]);
    expect(
      screen.getByRole('button', {
        name: 'E1 string, fret 8, C2, root. Play note',
      }),
    ).toHaveClass('fret-playing');
    expect(
      screen.getByRole('button', {
        name: 'A1 string, fret 3, C2, root. Play note',
      }),
    ).toHaveClass('fret-playing');
    expect(
      screen.getByRole('button', {
        name: 'D2 string, fret 10, C3, root. Play note',
      }),
    ).not.toHaveClass('fret-playing');
    const fret = screen.getByRole('button', {
      name: 'E1 string, fret 1, F1, outside scale. Play note',
    });
    fret.focus();
    await user.keyboard(' ');
    expect(play.mock.calls.at(-1)!.slice(0, 2)).toEqual([[29], 90]);
  });

  it('lights circle notes by pitch class and plays outside notes from the circle', async () => {
    const play = vi
      .spyOn(NotePlayer.prototype, 'play')
      .mockImplementation(async (notes, _tempo, onNote) => {
        onNote(notes[0]!);
      });
    const user = userEvent.setup();
    render(<App />);
    const third = screen.getByRole('button', {
      name: 'Play E2, scale degree 3',
    });
    expect(third).not.toHaveClass('circle-playing');
    await user.click(
      screen.getByRole('button', {
        name: 'E1 string, open, E1, scale note. Play note',
      }),
    );
    expect(third).toHaveClass('circle-playing');
    await user.click(
      screen.getByRole('button', {
        name: 'D2 string, fret 10, C3, root. Play note',
      }),
    );
    expect(third).not.toHaveClass('circle-playing');
    expect(screen.getByRole('button', { name: 'Play C2, root' })).toHaveClass(
      'circle-playing',
    );
    const outside = screen.getByRole('button', {
      name: 'Play C#2, outside scale',
    });
    await user.click(outside);
    expect(play.mock.calls.at(-1)!.slice(0, 2)).toEqual([[37], 90]);
    expect(outside).toHaveClass('circle-playing');
    expect(
      screen.getByRole('button', {
        name: 'A1 string, fret 4, C#2, outside scale. Play note',
      }),
    ).toHaveClass('fret-playing');
  });

  it('plays both directions at the selected tempo and stops on edits, Stop, hidden page and unmount', async () => {
    const play = vi
      .spyOn(NotePlayer.prototype, 'play')
      .mockResolvedValue(undefined);
    const stop = vi.spyOn(NotePlayer.prototype, 'stop');
    const dispose = vi.spyOn(NotePlayer.prototype, 'dispose');
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    expect(
      screen.getByRole('button', { name: 'Stop playback' }),
    ).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /Play ascending/ }));
    expect(play.mock.calls[0]!.slice(0, 2)).toEqual([
      [36, 38, 40, 43, 45, 48],
      90,
    ]);
    fireEvent.change(screen.getByRole('slider', { name: 'Tempo' }), {
      target: { value: '120' },
    });
    expect(screen.getByRole('status')).toHaveTextContent('Ready to play');
    await user.click(screen.getByRole('button', { name: /Play descending/ }));
    expect(play.mock.calls[1]!.slice(0, 2)).toEqual([
      [48, 45, 43, 40, 38, 36],
      120,
    ]);
    await user.selectOptions(screen.getByLabelText('Root note'), '4');
    expect(
      screen.getByRole('button', { name: 'Stop playback' }),
    ).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /Play ascending/ }));
    await user.selectOptions(
      screen.getByLabelText('Scale', { exact: true }),
      'major',
    );
    expect(screen.getByRole('status')).toHaveTextContent('Ready to play');
    await user.click(screen.getByRole('button', { name: /Play ascending/ }));
    await user.click(screen.getByRole('button', { name: 'Stop playback' }));
    expect(screen.getByRole('status')).toHaveTextContent('Ready to play');
    await user.click(screen.getByRole('button', { name: /Play descending/ }));
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    fireEvent(document, new Event('visibilitychange'));
    expect(screen.getByRole('status')).toHaveTextContent('Playing');
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    fireEvent(document, new Event('visibilitychange'));
    expect(screen.getByRole('status')).toHaveTextContent('Ready to play');
    expect(stop).toHaveBeenCalled();
    unmount();
    expect(dispose).toHaveBeenCalledOnce();
  });

  it('finishes naturally and reports recoverable audio errors without blocking scale exploration', async () => {
    const play = vi
      .spyOn(NotePlayer.prototype, 'play')
      .mockImplementation(async (_notes, _tempo, _onNote, complete) => {
        complete();
      });
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /Play ascending/ }));
    expect(screen.getByRole('status')).toHaveTextContent('Ready to play');
    play.mockRejectedValueOnce(new Error('Audio is unavailable'));
    await user.click(screen.getByRole('button', { name: /Play ascending/ }));
    expect(screen.getByRole('alert')).toHaveTextContent('Audio is unavailable');
    expect(
      screen.getByRole('button', { name: 'Stop playback' }),
    ).toBeDisabled();
    await user.selectOptions(screen.getByLabelText('Root note'), '4');
    play.mockRejectedValueOnce('Unknown failure');
    await user.click(screen.getByRole('button', { name: /Play ascending/ }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Audio could not start',
    );
    await user.click(screen.getByRole('button', { name: /Play ascending/ }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('ignores a rejected startup after Stop', async () => {
    let reject!: (reason: Error) => void;
    vi.spyOn(NotePlayer.prototype, 'play').mockReturnValue(
      new Promise<void>((_resolve, rejectPromise) => {
        reject = rejectPromise;
      }),
    );
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /Play ascending/ }));
    await user.click(screen.getByRole('button', { name: 'Stop playback' }));
    await act(async () => {
      reject(new Error('Old failure'));
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Ready to play');
  });
});

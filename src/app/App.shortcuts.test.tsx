import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NotePlayer } from '../platform/audio/NotePlayer';
import { renderFullPage } from '../test/renderApp';
import { App } from './App';

afterEach(() => vi.restoreAllMocks());

function mockPlayer() {
  return vi
    .spyOn(NotePlayer.prototype, 'play')
    .mockImplementation(async (notes, _tempo, onNote) => {
      onNote(notes[0]!);
    });
}

const played = (play: ReturnType<typeof mockPlayer>) =>
  play.mock.calls.map(([notes, tempo]) => [...notes, tempo]);

describe('number key shortcuts', () => {
  it('play the scale notes in order, then the root an octave up', async () => {
    const play = mockPlayer();
    const user = userEvent.setup();
    render(<App />);
    expect(
      within(screen.getByRole('list', { name: 'Notes in the selected scale' }))
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-keyshortcuts')),
    ).toEqual(['1', '2', '3', '4', '5']);

    await user.keyboard('2');
    expect(
      screen.getByRole('button', { name: 'Play D2, scale degree 2' }),
    ).toHaveClass('circle-playing');
    await user.keyboard('1345607');
    // C2 D2 E2 G2 A2 and C3, each at the default tempo; 0 and 7 do nothing.
    expect(played(play)).toEqual([
      [38, 90],
      [36, 90],
      [40, 90],
      [43, 90],
      [45, 90],
      [48, 90],
    ]);
  });

  it('follow the selected scale', async () => {
    const play = mockPlayer();
    const user = userEvent.setup();
    render(<App />);
    await user.click(
      screen.getByRole('button', { name: 'C major pentatonic' }),
    );
    await user.click(screen.getByRole('radio', { name: 'A' }));
    await user.click(screen.getByRole('radio', { name: 'Natural minor' }));
    // Keys work while a picker radio has focus.
    await user.keyboard('389');
    expect(played(play)).toEqual([
      [36, 90],
      [45, 90],
    ]);
  });

  it('are ignored while typing, in selects, with modifiers, or on repeat', async () => {
    const play = mockPlayer();
    const user = userEvent.setup();
    renderFullPage();

    const field = document.createElement('input');
    document.body.append(field);
    act(() => field.focus());
    await user.keyboard('1');
    field.remove();

    act(() => screen.getByRole('combobox', { name: 'Root note' }).focus());
    await user.keyboard('1');
    act(() => screen.getByRole('combobox', { name: 'Root note' }).blur());

    fireEvent.keyDown(document.body, { key: '1', ctrlKey: true });
    fireEvent.keyDown(document.body, { key: '1', repeat: true });
    expect(play).not.toHaveBeenCalled();

    // The tempo slider takes no typing, so number keys still play there.
    act(() => screen.getByRole('slider', { name: 'Tempo' }).focus());
    await user.keyboard('1');
    expect(played(play)).toEqual([[36, 90]]);
  });
});

describe('arrow key shortcuts in zen mode', () => {
  const heading = (name: string) =>
    expect(screen.getByRole('heading', { name })).toBeInTheDocument();

  it('move the root a semitone with up and down, wrapping at the octave', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.keyboard('{ArrowUp}');
    heading('C# major pentatonic');
    await user.keyboard('{ArrowDown}{ArrowDown}');
    heading('B major pentatonic');
    await user.keyboard('{ArrowUp}{ArrowUp}{ArrowUp}');
    heading('D major pentatonic');
    // The fretboard follows the new root.
    expect(
      screen.getByRole('button', {
        name: 'A1 string, fret 5, D2, root. Play note',
      }),
    ).toHaveTextContent('R');
  });

  it('cycle the scales with left and right, wrapping at either end', async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    await user.keyboard('{ArrowRight}');
    heading('C minor pentatonic');
    expect(container.querySelector('.practice-space')).toHaveAttribute(
      'data-quality',
      'minor',
    );
    await user.keyboard('{ArrowRight}');
    heading('C major');
    await user.keyboard('{ArrowRight}');
    heading('C natural minor');
    await user.keyboard('{ArrowRight}');
    heading('C major pentatonic');
    await user.keyboard('{ArrowLeft}');
    heading('C natural minor');
  });

  it('stop playback, keep the choice, and retarget the number keys', async () => {
    const play = mockPlayer();
    const stop = vi.spyOn(NotePlayer.prototype, 'stop');
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    await user.keyboard('1');
    stop.mockClear();
    await user.keyboard('{ArrowUp}{ArrowRight}');
    expect(stop).toHaveBeenCalled();
    heading('C# minor pentatonic');
    // C#2, then E2: the minor third of C# minor pentatonic.
    await user.keyboard('12');
    expect(played(play)).toEqual([
      [36, 90],
      [37, 90],
      [40, 90],
    ]);

    unmount();
    render(<App />);
    heading('C# minor pentatonic');
  });

  it('are left to the full page, the picker radios, the fretboard and modifiers', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Arrows move the picker's radio group natively.
    await user.click(
      screen.getByRole('button', { name: 'C major pentatonic' }),
    );
    expect(screen.getByRole('radio', { name: 'C' })).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    heading('C# major pentatonic');
    await user.keyboard('{Escape}');

    // The focused fretboard scrolls with the arrow keys.
    act(() =>
      screen.getByRole('region', { name: 'Scrollable bass fretboard' }).focus(),
    );
    await user.keyboard('{ArrowLeft}{ArrowUp}');
    heading('C# major pentatonic');
    act(() =>
      screen.getByRole('region', { name: 'Scrollable bass fretboard' }).blur(),
    );

    // Alt+Left is the browser's Back.
    fireEvent.keyDown(document.body, { key: 'ArrowLeft', altKey: true });
    fireEvent.keyDown(document.body, { key: 'ArrowUp', metaKey: true });
    fireEvent.keyDown(document.body, { key: 'ArrowUp', repeat: true });
    heading('C# major pentatonic');

    // The full page has root and scale controls, and arrows scroll it.
    await user.keyboard('?');
    await user.keyboard('{ArrowUp}{ArrowRight}');
    heading('C# major pentatonic');
    expect(screen.getByRole('combobox', { name: 'Root note' })).toHaveValue(
      '1',
    );
  });
});

describe('space in zen mode', () => {
  const rootNote = () => screen.getByRole('button', { name: 'Play C2, root' });

  it('plays the scale ascending at the saved tempo, and stops it when pressed again', async () => {
    const play = mockPlayer();
    const stop = vi.spyOn(NotePlayer.prototype, 'stop');
    const user = userEvent.setup();
    render(<App />);
    await user.keyboard(' ');
    expect(played(play)).toEqual([[36, 38, 40, 43, 45, 48, 90]]);
    expect(rootNote()).toHaveClass('circle-playing');

    stop.mockClear();
    await user.keyboard(' ');
    expect(stop).toHaveBeenCalled();
    expect(rootNote()).not.toHaveClass('circle-playing');

    // The run follows the current scale and the tempo set on the full page.
    await user.keyboard('?');
    fireEvent.change(screen.getByRole('slider', { name: 'Tempo' }), {
      target: { value: '120' },
    });
    await user.keyboard('?{ArrowRight} ');
    expect(played(play)).toEqual([
      [36, 38, 40, 43, 45, 48, 90],
      [36, 39, 41, 43, 46, 48, 120],
    ]);
  });

  it('takes priority over a focused button, and holding it plays once', async () => {
    const play = vi
      .spyOn(NotePlayer.prototype, 'play')
      .mockImplementation(async (notes, _tempo, onNote, onComplete) => {
        onNote(notes[0]!);
        onComplete();
      });
    const user = userEvent.setup();
    render(<App />);
    const third = screen.getByRole('button', {
      name: 'Play E2, scale degree 3',
    });
    await user.click(third);
    expect(third).toHaveFocus();
    // Held down, Space repeats; releasing it must not press the button.
    await user.keyboard('[Space>4/]');
    expect(played(play)).toEqual([
      [40, 90],
      [36, 38, 40, 43, 45, 48, 90],
    ]);

    // The press, its repeats and its release are all claimed.
    expect(fireEvent.keyDown(third, { key: ' ' })).toBe(false);
    expect(fireEvent.keyDown(third, { key: ' ', repeat: true })).toBe(false);
    expect(fireEvent.keyUp(third, { key: ' ' })).toBe(false);
    expect(fireEvent.keyUp(third, { key: ' ' })).toBe(true);
    expect(fireEvent.keyDown(third, { key: 'x', repeat: true })).toBe(true);
  });

  it('is left to text fields, modifiers and the full page', async () => {
    const play = mockPlayer();
    const user = userEvent.setup();
    render(<App />);

    const field = document.createElement('input');
    document.body.append(field);
    act(() => field.focus());
    await user.keyboard(' ');
    expect(field).toHaveValue(' ');
    field.remove();

    expect(fireEvent.keyDown(document.body, { key: ' ', ctrlKey: true })).toBe(
      true,
    );
    expect(fireEvent.keyDown(document.body, { key: ' ', repeat: true })).toBe(
      true,
    );

    // Space scrolls the full page.
    await user.keyboard('?');
    expect(fireEvent.keyDown(document.body, { key: ' ' })).toBe(true);
    expect(play).not.toHaveBeenCalled();
  });
});

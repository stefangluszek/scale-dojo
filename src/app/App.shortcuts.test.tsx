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

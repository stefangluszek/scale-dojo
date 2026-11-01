import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NotePlayer } from '../platform/audio/NotePlayer';
import { App } from './App';

afterEach(() => vi.restoreAllMocks());

function expectZen() {
  expect(screen.getByRole('button', { name: 'Show full page' })).toBeVisible();
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
}

function expectFullPage() {
  expect(screen.getByRole('button', { name: 'Enter zen mode' })).toBeVisible();
  expect(
    screen.getByRole('heading', { name: 'Make every note intentional.' }),
  ).toBeInTheDocument();
  expect(screen.getAllByRole('combobox')).toHaveLength(2);
}

describe('zen mode', () => {
  it('opens with only the scale circle and the fretboard', () => {
    render(<App />);
    expectZen();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Scale Dojo' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'C major pentatonic' }),
    ).toBeInTheDocument();
    expect(
      within(
        screen.getByRole('list', { name: 'Notes in the selected scale' }),
      ).getAllByRole('button'),
    ).toHaveLength(5);
    expect(
      within(
        screen.getByRole('list', { name: 'Notes outside the scale' }),
      ).getAllByRole('button'),
    ).toHaveLength(7);
    expect(
      within(screen.getByRole('table')).getAllByRole('button'),
    ).toHaveLength(52);
    expect(
      screen.getByRole('region', { name: 'Scrollable bass fretboard' }),
    ).toHaveAccessibleDescription(/Standard tuning E1–A1–D2–G2/);
    expect(
      screen.getByRole('button', { name: 'Show full page' }),
    ).toHaveAttribute('aria-keyshortcuts', '?');

    expect(
      screen.queryByRole('button', { name: /Play ascending/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Read it like a clock.')).not.toBeInTheDocument();
    expect(screen.queryByText('Early preview')).not.toBeInTheDocument();
    expect(screen.queryByText('Scale note')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'From knowing to hearing.' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
  });

  it('toggles the full page with the button and keeps focus on it', async () => {
    const user = userEvent.setup();
    render(<App />);
    const toggle = screen.getByRole('button', { name: 'Show full page' });
    await user.click(toggle);
    expectFullPage();
    expect(screen.getByRole('button', { name: 'Enter zen mode' })).toBe(toggle);
    expect(toggle).toHaveFocus();
    expect(
      screen.getByRole('button', { name: /Play ascending/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    await user.keyboard('{Enter}');
    expectZen();
    expect(toggle).toHaveFocus();
  });

  it('toggles with the ? key, except in form fields or with modifiers', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.keyboard('?');
    expectFullPage();

    act(() => screen.getByRole('combobox', { name: 'Root note' }).focus());
    await user.keyboard('?');
    expectFullPage();
    act(() => screen.getByRole('combobox', { name: 'Root note' }).blur());

    fireEvent.keyDown(document.body, { key: '?', ctrlKey: true });
    fireEvent.keyDown(document.body, { key: '?', metaKey: true });
    fireEvent.keyDown(document.body, { key: '?', altKey: true });
    fireEvent.keyDown(document.body, { key: '?', repeat: true });
    fireEvent.keyDown(document.body, { key: '/' });
    const claim = (event: Event) => event.preventDefault();
    document.body.addEventListener('keydown', claim);
    fireEvent.keyDown(document.body, { key: '?' });
    document.body.removeEventListener('keydown', claim);
    expectFullPage();

    fireEvent.keyDown(document.body, { key: '?' });
    expectZen();
  });

  it('keeps the selected scale when switching views', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.keyboard('?');
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Root note' }),
      '9',
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Scale' }),
      'natural-minor',
    );
    await user.click(screen.getByRole('button', { name: 'Enter zen mode' }));
    expectZen();
    expect(
      screen.getByRole('heading', { name: 'A natural minor' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: 'A1 string, open, A1, root. Play note',
      }),
    ).toHaveTextContent('R');
  });

  it('plays notes, keeps playback across views, and reports audio errors', async () => {
    const play = vi
      .spyOn(NotePlayer.prototype, 'play')
      .mockImplementation(async (notes, _tempo, onNote) => {
        onNote(notes[0]!);
      });
    const user = userEvent.setup();
    render(<App />);
    const open = screen.getByRole('button', {
      name: 'E1 string, open, E1, scale note. Play note',
    });
    await user.click(open);
    expect(play).toHaveBeenCalledWith(
      [28],
      90,
      expect.any(Function),
      expect.any(Function),
    );
    expect(open).toHaveClass('fret-playing');

    await user.keyboard('?');
    expect(screen.getByRole('status')).toHaveTextContent('Playing');
    expect(open).toHaveClass('fret-playing');
    await user.keyboard('?');

    play.mockRejectedValueOnce(new Error('Audio is unavailable'));
    await user.click(screen.getByRole('button', { name: 'Play C2, root' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Audio is unavailable');
  });
});

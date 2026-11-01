import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from './App';

function displayedNotes() {
  return within(
    screen.getByRole('list', { name: 'Notes in the selected scale' }),
  )
    .getAllByRole('listitem')
    .map((item) => item.querySelector('.note-name')?.textContent);
}

describe('scale explorer', () => {
  it('starts with C major pentatonic and identifies the root', () => {
    render(<App />);
    expect(
      screen.getByRole('heading', { name: 'Make every note intentional.' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Root note' })).toHaveValue(
      '0',
    );
    expect(screen.getByRole('combobox', { name: 'Scale' })).toHaveValue(
      'major-pentatonic',
    );
    expect(displayedNotes()).toEqual(['C', 'D', 'E', 'G', 'A']);
    expect(
      screen.getByText('Root', { exact: true }).closest('li'),
    ).toHaveTextContent('C');
  });

  it('transposes the visible notes when the root changes', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Root note' }),
      '9',
    );
    expect(
      screen.getByRole('heading', { name: 'A major pentatonic' }),
    ).toBeInTheDocument();
    expect(displayedNotes()).toEqual(['A', 'B', 'C#', 'E', 'F#']);
  });

  it('updates scale notes and count while retaining the selected root', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Root note' }),
      '9',
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Scale' }),
      'natural-minor',
    );
    expect(
      screen.getByRole('heading', { name: 'A natural minor' }),
    ).toBeInTheDocument();
    expect(displayedNotes()).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
    expect(screen.getByText('7 notes')).toBeInTheDocument();
  });

  it('distinguishes minor pentatonic from major pentatonic', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Scale' }),
      'minor-pentatonic',
    );
    expect(displayedNotes()).toEqual(['C', 'D#', 'F', 'G', 'A#']);
    expect(screen.getByText('5 notes')).toBeInTheDocument();
  });
});

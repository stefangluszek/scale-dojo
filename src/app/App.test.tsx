import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderFullPage } from '../test/renderApp';

function displayedNotes() {
  return within(
    screen.getByRole('list', { name: 'Notes in the selected scale' }),
  )
    .getAllByRole('listitem')
    .map((item) => item.querySelector('.note-name')?.textContent);
}

function circleButtons(listName: string) {
  return within(screen.getByRole('list', { name: listName }))
    .getAllByRole('button')
    .map((button) => button.getAttribute('aria-label'));
}

function formulaRow(term: string) {
  return within(screen.getByText(term).nextElementSibling as HTMLElement)
    .getAllByRole('listitem')
    .map(
      (item) =>
        (item.querySelector('[aria-hidden="true"]') ?? item).textContent,
    );
}

describe('scale explorer', () => {
  it('starts with C major pentatonic and identifies the root', () => {
    renderFullPage();
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
      screen.getByRole('button', { name: 'Play C2, root' }),
    ).toHaveTextContent('C');
  });

  it('transposes the visible notes when the root changes', async () => {
    const user = userEvent.setup();
    renderFullPage();
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
    renderFullPage();
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
    renderFullPage();
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Scale' }),
      'minor-pentatonic',
    );
    expect(displayedNotes()).toEqual(['C', 'D#', 'F', 'G', 'A#']);
    expect(screen.getByText('5 notes')).toBeInTheDocument();
  });

  it('draws the scale on a circle with degrees, outside notes and fret steps', () => {
    const { container } = renderFullPage();
    expect(circleButtons('Notes in the selected scale')).toEqual([
      'Play C2, root',
      'Play D2, scale degree 2',
      'Play E2, scale degree 3',
      'Play G2, scale degree 5',
      'Play A2, scale degree 6',
    ]);
    expect(circleButtons('Notes outside the scale')).toEqual([
      'Play C#2, outside scale',
      'Play D#2, outside scale',
      'Play F2, outside scale',
      'Play F#2, outside scale',
      'Play G#2, outside scale',
      'Play A#2, outside scale',
      'Play B2, outside scale',
    ]);
    expect(
      screen
        .getByRole('button', { name: 'Play D2, scale degree 2' })
        .querySelector('.note-degree'),
    ).toHaveTextContent('2');
    expect(formulaRow('Degrees')).toEqual(['1', '2', '3', '5', '6']);
    expect(formulaRow('Frets between notes')).toEqual([
      '2',
      '2',
      '3',
      '2',
      '3',
    ]);
    expect(container.querySelector('.circle-polygon')).toHaveAttribute(
      'points',
      '0,-1 0.866,-0.5 0.866,0.5 -0.5,0.866 -1,0',
    );
    expect(container.querySelector('.practice-space')).toHaveAttribute(
      'data-quality',
      'major',
    );
  });

  it('keeps the shape when the root changes and colors minor scales differently', async () => {
    const user = userEvent.setup();
    const { container } = renderFullPage();
    const shape = () =>
      container.querySelector('.circle-polygon')?.getAttribute('points');
    const majorShape = shape();
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Root note' }),
      '7',
    );
    expect(shape()).toBe(majorShape);
    expect(circleButtons('Notes in the selected scale')[0]).toBe(
      'Play G1, root',
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Scale' }),
      'minor-pentatonic',
    );
    expect(shape()).not.toBe(majorShape);
    expect(container.querySelector('.practice-space')).toHaveAttribute(
      'data-quality',
      'minor',
    );
    expect(
      screen.getByRole('button', { name: 'Play A#1, scale degree flat 3' }),
    ).toHaveTextContent('♭3');
    expect(formulaRow('Degrees')).toEqual(['1', '♭3', '4', '5', '♭7']);
    expect(screen.getByText('flat 3', { selector: '.sr-only' })).toBeVisible();
    expect(formulaRow('Frets between notes')).toEqual([
      '3',
      '2',
      '2',
      '3',
      '2',
    ]);
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Scale' }),
      'natural-minor',
    );
    expect(circleButtons('Notes outside the scale')).toHaveLength(5);
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Scale' }),
      'major',
    );
    expect(container.querySelector('.practice-space')).toHaveAttribute(
      'data-quality',
      'major',
    );
  });
});

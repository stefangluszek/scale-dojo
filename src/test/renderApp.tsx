import { fireEvent, render, screen, within } from '@testing-library/react';
import { App } from '../app/App';

/** Renders the app and leaves zen mode, which hides the controls and guides. */
export function renderFullPage() {
  const result = render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Show full page' }));
  return result;
}

/** The playback panel's status; the listening panel has its own. */
export function playbackStatus() {
  return within(
    screen.getByRole('region', { name: 'Hear the scale' }),
  ).getByRole('status');
}

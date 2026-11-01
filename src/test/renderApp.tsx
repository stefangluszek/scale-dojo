import { fireEvent, render, screen } from '@testing-library/react';
import { App } from '../app/App';

/** Renders the app and leaves zen mode, which hides the controls and guides. */
export function renderFullPage() {
  const result = render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Show full page' }));
  return result;
}

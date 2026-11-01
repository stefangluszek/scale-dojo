import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderFullPage } from '../test/renderApp';
import { App } from './App';

const picker = () => screen.queryByRole('dialog', { name: 'Choose a scale' });

describe('scale picker on the circle', () => {
  it('opens from the circle center and applies choices immediately', async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    const toggle = screen.getByRole('button', { name: 'C major pentatonic' });
    expect(toggle).toHaveAccessibleDescription('Change root and scale');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(picker()).not.toBeInTheDocument();

    await user.click(toggle);
    expect(picker()).toBeVisible();
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('radio', { name: 'C' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'C' })).toHaveFocus();
    expect(
      screen.getByRole('radio', { name: 'Major pentatonic' }),
    ).toBeChecked();

    await user.click(screen.getByRole('radio', { name: 'A' }));
    expect(
      screen.getByRole('heading', { name: 'A major pentatonic' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Natural minor' }));
    expect(
      screen.getByRole('heading', { name: 'A natural minor' }),
    ).toBeInTheDocument();
    expect(container.querySelector('.practice-space')).toHaveAttribute(
      'data-quality',
      'minor',
    );
    expect(
      screen.getByRole('button', {
        name: 'A1 string, open, A1, root. Play note',
      }),
    ).toHaveTextContent('R');
    expect(picker()).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(picker()).not.toBeInTheDocument();
    expect(toggle).toHaveFocus();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('works from the keyboard: arrows choose, Escape closes and returns focus', async () => {
    const user = userEvent.setup();
    render(<App />);
    const toggle = screen.getByRole('button', { name: 'C major pentatonic' });
    toggle.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('radio', { name: 'C' })).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'C#' })).toBeChecked();
    expect(
      screen.getByRole('heading', { name: 'C# major pentatonic' }),
    ).toBeInTheDocument();
    await user.tab();
    expect(
      screen.getByRole('radio', { name: 'Major pentatonic' }),
    ).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(
      screen.getByRole('heading', { name: 'C# minor pentatonic' }),
    ).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(picker()).not.toBeInTheDocument();
    expect(toggle).toHaveFocus();
  });

  it('closes on an outside click, on tabbing away, or from its toggle', async () => {
    const user = userEvent.setup();
    render(<App />);
    const toggle = screen.getByRole('button', { name: 'C major pentatonic' });

    await user.click(toggle);
    await user.click(screen.getByText('Root'));
    expect(picker()).toBeVisible();
    await user.click(document.body);
    expect(picker()).not.toBeInTheDocument();

    await user.click(toggle);
    await user.click(screen.getByRole('button', { name: 'Done' }));
    await user.click(toggle);
    screen.getByRole('button', { name: 'Done' }).focus();
    await user.tab();
    expect(picker()).not.toBeInTheDocument();

    await user.click(toggle);
    await user.click(toggle);
    expect(picker()).not.toBeInTheDocument();
  });

  it('stays in sync with the full-page selectors', async () => {
    const user = userEvent.setup();
    renderFullPage();
    await user.click(
      screen.getByRole('button', { name: 'C major pentatonic' }),
    );
    await user.click(screen.getByRole('radio', { name: 'G' }));
    await user.click(screen.getByRole('radio', { name: 'Major' }));
    expect(screen.getByRole('combobox', { name: 'Root note' })).toHaveValue(
      '7',
    );
    expect(screen.getByRole('combobox', { name: 'Scale' })).toHaveValue(
      'major',
    );
  });
});

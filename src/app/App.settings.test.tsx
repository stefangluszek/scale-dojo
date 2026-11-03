import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { writeStored } from '../platform/storage/local';
import { SETTINGS_KEY } from '../platform/storage/settings';
import { MicrophoneInput } from '../platform/audio/MicrophoneInput';
import { renderFullPage } from '../test/renderApp';
import { App } from './App';

afterEach(() => vi.restoreAllMocks());

describe('saved preferences', () => {
  it('restores root, scale, tempo, volume and full-page view without opening the microphone', async () => {
    const start = vi.spyOn(MicrophoneInput.prototype, 'start');
    const user = userEvent.setup();
    const app = renderFullPage();
    await user.selectOptions(screen.getByLabelText('Root note'), '9');
    await user.selectOptions(
      screen.getByLabelText('Scale', { exact: true }),
      'natural-minor',
    );
    fireEvent.change(screen.getByRole('slider', { name: 'Tempo' }), {
      target: { value: '140' },
    });
    expect(screen.getByRole('slider', { name: 'Volume' })).toHaveValue('80');
    fireEvent.change(screen.getByRole('slider', { name: 'Volume' }), {
      target: { value: '45' },
    });
    app.unmount();
    render(<App />);
    expect(screen.getByLabelText('Root note')).toHaveValue('9');
    expect(screen.getByLabelText('Scale', { exact: true })).toHaveValue(
      'natural-minor',
    );
    expect(screen.getByRole('slider', { name: 'Tempo' })).toHaveValue('140');
    expect(screen.getByRole('slider', { name: 'Volume' })).toHaveValue('45');
    expect(
      screen.getByRole('button', { name: 'Enter zen mode' }),
    ).toBeVisible();
    expect(start).not.toHaveBeenCalled();
  });

  it('keeps preferences saved before volume existed, at the default volume', () => {
    writeStored(SETTINGS_KEY, {
      root: 7,
      scaleId: 'major',
      tempo: 150,
      view: 'full',
    });
    render(<App />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Root note')).toHaveValue('7');
    expect(screen.getByRole('slider', { name: 'Tempo' })).toHaveValue('150');
    expect(screen.getByRole('slider', { name: 'Volume' })).toHaveValue('80');
  });

  it('saves changes from the circle picker and restores zen mode', async () => {
    const user = userEvent.setup();
    const app = renderFullPage();
    await user.click(screen.getByRole('button', { name: 'Enter zen mode' }));
    await user.click(
      screen.getByRole('button', { name: 'C major pentatonic' }),
    );
    await user.click(screen.getByRole('radio', { name: 'E' }));
    await user.click(screen.getByRole('radio', { name: 'Minor pentatonic' }));
    app.unmount();
    render(<App />);
    expect(
      screen.getByRole('heading', { name: 'E minor pentatonic' }),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Show full page' }),
    ).toBeVisible();
  });

  it('falls back from invalid settings and lets the user save defaults', async () => {
    localStorage.setItem(SETTINGS_KEY, 'null');
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Default settings are in use',
    );
    await user.click(
      screen.getByRole('button', { name: 'Save default settings' }),
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY)!).value.root).toBe(0);
  });

  it('works with unavailable storage and saves in-memory changes when retry succeeds', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const write = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('blocked');
      });
    const user = userEvent.setup();
    renderFullPage();
    await user.selectOptions(screen.getByLabelText('Root note'), '7');
    expect(
      screen.getByRole('heading', { name: 'G major pentatonic' }),
    ).toBeVisible();
    expect(
      screen.getByText(/Settings could not be saved on this device/),
    ).toBeVisible();
    write.mockRestore();
    await user.click(
      screen.getByRole('button', { name: 'Retry saving settings' }),
    );
    expect(
      screen.queryByText(
        'Settings could not be saved on this device. Changes will last until you leave the page.',
      ),
    ).not.toBeInTheDocument();
  });
});

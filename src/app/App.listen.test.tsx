import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MicrophoneError,
  MicrophoneInput,
  type MicrophoneCallbacks,
  type MicrophoneDetails,
  type MicrophoneProblem,
} from '../platform/audio/MicrophoneInput';
import {
  midiFrequency,
  silence,
  tone,
  whiteNoise,
} from '../test/audioFixtures';
import { renderFullPage } from '../test/renderApp';
import { App } from './App';

afterEach(() => vi.restoreAllMocks());

const SAMPLE_RATE = 48000;
const WINDOW = 4096;

/**
 * Replaces microphone acquisition with a controllable fake: grant or refuse
 * permission, then feed deterministic sample windows through the real pitch
 * detector and stabilizer.
 */
function fakeMicrophone() {
  let callbacks: MicrophoneCallbacks | undefined;
  let settle!: {
    resolve: (details: MicrophoneDetails | null) => void;
    reject: (cause: unknown) => void;
  };
  let clock = 0;
  const start = vi
    .spyOn(MicrophoneInput.prototype, 'start')
    .mockImplementation((handlers) => {
      callbacks = handlers;
      return new Promise((resolve, reject) => {
        settle = { resolve, reject };
      });
    });
  const stop = vi.spyOn(MicrophoneInput.prototype, 'stop');

  function feed(samples: Float32Array, frames: number) {
    for (let frame = 0; frame < frames; frame += 1) {
      clock += 40;
      act(() =>
        callbacks!.onFrame({ time: clock, samples, sampleRate: SAMPLE_RATE }),
      );
    }
  }

  return {
    start,
    stop,
    grant: (details: Partial<MicrophoneDetails> = {}) =>
      act(async () =>
        settle.resolve({ sampleRate: SAMPLE_RATE, processing: [], ...details }),
      ),
    cancel: () => act(async () => settle.resolve(null)),
    refuse: (cause: unknown) => act(async () => settle.reject(cause)),
    /** A note held for a few analysis windows. */
    hear: (midi: number, cents = 0, frames = 3) =>
      feed(
        tone({
          frequency: midiFrequency(midi, cents),
          sampleRate: SAMPLE_RATE,
          length: WINDOW,
          seed: midi,
        }),
        frames,
      ),
    quiet: (frames = 5) => feed(silence(WINDOW), frames),
    noise: (frames = 5) => feed(whiteNoise(WINDOW, 0.2), frames),
    lose: () => act(() => callbacks!.onEnded()),
  };
}

function listenRegion() {
  return within(screen.getByRole('region', { name: /Play (&|and) listen/ }));
}

/** What a screen reader hears from the readout: hidden glyphs left out. */
function heard() {
  const readout = listenRegion().getByRole('status').cloneNode(true) as Element;
  readout
    .querySelectorAll('[aria-hidden="true"]')
    .forEach((node) => node.remove());
  return readout.textContent!.replace(/\s+/g, ' ').trim();
}

function heardFrets() {
  return within(screen.getByRole('table'))
    .getAllByRole('button')
    .filter((button) => button.classList.contains('fret-heard'))
    .map((button) => button.getAttribute('aria-label'));
}

describe('live microphone feedback', () => {
  it('listens only after Start, then shows the heard note, its tuning and its place in the scale', async () => {
    const microphone = fakeMicrophone();
    const user = userEvent.setup();
    renderFullPage();
    expect(microphone.start).not.toHaveBeenCalled();
    expect(heard()).toContain('Microphone off.');

    await user.click(screen.getByRole('button', { name: 'Start listening' }));
    expect(microphone.start).toHaveBeenCalledOnce();
    expect(heard()).toContain('Waiting for microphone permission…');
    expect(
      screen.getByRole('button', { name: 'Stop listening' }),
    ).toBeInTheDocument();
    await microphone.grant();
    expect(heard()).toContain('Listening. Play a note.');

    // Low E1 is the third degree of C major pentatonic.
    microphone.hear(28);
    expect(heard()).toContain('Hearing E1 In the scale · degree 3');
    expect(listenRegion().getByText('In tune')).toBeInTheDocument();
    expect(
      listenRegion().getByText(/Ringed at its one position on the fretboard/),
    ).toBeInTheDocument();
    expect(heardFrets()).toEqual([
      'E1 string, open, E1, scale note, matches heard pitch. Play note',
    ]);
    expect(
      screen.getByRole('button', {
        name: 'Play E2, scale degree 3, matches heard note',
      }),
    ).toHaveClass('circle-heard');

    microphone.hear(29);
    expect(heard()).toContain('Hearing F1 Outside the scale');
    expect(heardFrets()).toEqual([
      'E1 string, fret 1, F1, outside scale, matches heard pitch. Play note',
    ]);
    expect(
      screen.getByRole('button', {
        name: 'Play F2, outside scale, matches heard note',
      }),
    ).toHaveClass('circle-heard');

    microphone.hear(36);
    expect(heard()).toContain('Hearing C2 Root');
    expect(heardFrets()).toHaveLength(2);
    expect(
      listenRegion().getByText(/all 2 matching positions/),
    ).toBeInTheDocument();
    expect(
      listenRegion().getByText(/not which string you used/),
    ).toBeInTheDocument();
  });

  it('keeps tuning apart from the note and silence apart from wrong notes', async () => {
    const microphone = fakeMicrophone();
    const user = userEvent.setup();
    renderFullPage();
    await user.click(screen.getByRole('button', { name: 'Start listening' }));
    await microphone.grant();

    microphone.hear(33, 22);
    expect(heard()).toContain('Hearing A1');
    expect(listenRegion().getByText(/2\d cents sharp/)).toBeInTheDocument();
    microphone.hear(38, -30);
    expect(heard()).toContain('Hearing D2');
    expect(listenRegion().getByText(/[23]\d cents flat/)).toBeInTheDocument();

    microphone.quiet();
    expect(heard()).toContain('Listening. Play a note.');
    expect(heardFrets()).toEqual([]);
    expect(screen.queryByText(/Outside the scale/)).not.toBeInTheDocument();

    microphone.noise();
    expect(heard()).toContain('Listening… no clear note yet.');
    expect(heardFrets()).toEqual([]);
    expect(screen.queryByText(/Outside the scale/)).not.toBeInTheDocument();
  });

  it('classifies against the current scale and explains notes above the fretboard', async () => {
    const microphone = fakeMicrophone();
    const user = userEvent.setup();
    renderFullPage();
    await user.click(screen.getByRole('button', { name: 'Start listening' }));
    await microphone.grant();
    microphone.hear(29);
    expect(heard()).toContain('Outside the scale');
    await user.selectOptions(screen.getByLabelText('Root note'), '9');
    await user.selectOptions(
      screen.getByLabelText('Scale', { exact: true }),
      'natural-minor',
    );
    expect(heard()).toContain('In the scale · degree flat 6');

    // G4 is fret 24 on the G string, beyond the frets shown.
    microphone.hear(67);
    expect(heard()).toContain('Hearing G4');
    expect(heardFrets()).toEqual([]);
    expect(listenRegion().getByText(/Above fret 12/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: 'Play G2, scale degree flat 7, matches heard note',
      }),
    ).toHaveClass('circle-heard');
  });

  it('releases the microphone and clears feedback on Stop', async () => {
    const microphone = fakeMicrophone();
    const user = userEvent.setup();
    renderFullPage();
    await user.click(screen.getByRole('button', { name: 'Start listening' }));
    await microphone.grant();
    microphone.hear(28);
    expect(listenRegion().getByText('In tune')).toBeInTheDocument();

    microphone.stop.mockClear();
    await user.click(screen.getByRole('button', { name: 'Stop listening' }));
    expect(microphone.stop).toHaveBeenCalledOnce();
    expect(heard()).toContain('Microphone off.');
    expect(heardFrets()).toEqual([]);
    expect(document.querySelector('.circle-heard')).toBeNull();
    expect(screen.queryByText('In tune')).not.toBeInTheDocument();
  });

  it('cancels a pending permission request on Stop', async () => {
    const microphone = fakeMicrophone();
    const user = userEvent.setup();
    renderFullPage();
    await user.click(screen.getByRole('button', { name: 'Start listening' }));
    await user.click(screen.getByRole('button', { name: 'Stop listening' }));
    expect(microphone.stop).toHaveBeenCalled();
    await microphone.cancel();
    expect(heard()).toContain('Microphone off.');
    expect(
      screen.getByRole('button', { name: 'Start listening' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it.each<[MicrophoneProblem, RegExp]>([
    ['denied', /Microphone access is blocked/],
    ['no-input', /No microphone was found/],
    ['busy', /may be in use by another app/],
    ['unsupported', /can’t listen to a microphone/],
    ['insecure', /needs a secure page/],
    ['failed', /Listening couldn’t start/],
  ])(
    'explains a %s problem and lets you try again',
    async (problem, message) => {
      const microphone = fakeMicrophone();
      const user = userEvent.setup();
      renderFullPage();
      await user.click(screen.getByRole('button', { name: 'Start listening' }));
      await microphone.refuse(new MicrophoneError(problem));
      expect(screen.getByRole('alert')).toHaveTextContent(message);
      expect(
        screen.getByRole('button', { name: 'Start listening' }),
      ).toBeInTheDocument();
      // The explorer keeps working.
      await user.selectOptions(screen.getByLabelText('Root note'), '4');
      expect(
        screen.getByRole('heading', { name: 'E major pentatonic' }),
      ).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Start listening' }));
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      await microphone.grant();
      expect(heard()).toContain('Listening. Play a note.');
    },
  );

  it('treats unexpected start-up errors as failures', async () => {
    const microphone = fakeMicrophone();
    const user = userEvent.setup();
    renderFullPage();
    await user.click(screen.getByRole('button', { name: 'Start listening' }));
    await microphone.refuse(new Error('boom'));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Listening couldn’t start',
    );
  });

  it('reports a disconnected microphone', async () => {
    const microphone = fakeMicrophone();
    const user = userEvent.setup();
    renderFullPage();
    await user.click(screen.getByRole('button', { name: 'Start listening' }));
    await microphone.grant();
    microphone.hear(33);
    microphone.lose();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'The microphone was disconnected',
    );
    expect(heardFrets()).toEqual([]);
    expect(
      screen.getByRole('button', { name: 'Start listening' }),
    ).toBeInTheDocument();
  });

  it('warns when the browser keeps voice processing on', async () => {
    const microphone = fakeMicrophone();
    const user = userEvent.setup();
    renderFullPage();
    await user.click(screen.getByRole('button', { name: 'Start listening' }));
    await microphone.grant({
      processing: ['noise suppression', 'automatic gain control'],
    });
    expect(
      screen.getByText(/kept noise suppression, automatic gain control on/),
    ).toBeInTheDocument();
  });

  it('stops when the page is hidden, and on unmount', async () => {
    const microphone = fakeMicrophone();
    const user = userEvent.setup();
    const { unmount } = renderFullPage();
    await user.click(screen.getByRole('button', { name: 'Start listening' }));
    await microphone.grant();
    microphone.hear(40);

    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    fireEvent(document, new Event('visibilitychange'));
    expect(heard()).toContain('Hearing E2');

    microphone.stop.mockClear();
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    fireEvent(document, new Event('visibilitychange'));
    expect(microphone.stop).toHaveBeenCalledOnce();
    expect(heard()).toContain(
      'Listening stopped while the page was in the background.',
    );
    // Hiding again while stopped does nothing new.
    fireEvent(document, new Event('visibilitychange'));
    expect(microphone.stop).toHaveBeenCalledOnce();

    await user.click(screen.getByRole('button', { name: 'Start listening' }));
    await microphone.grant();
    microphone.stop.mockClear();
    unmount();
    expect(microphone.stop).toHaveBeenCalled();
  });
});

describe('listening in zen mode', () => {
  it('offers a compact listen control and keeps listening across views', async () => {
    const microphone = fakeMicrophone();
    const user = userEvent.setup();
    render(<App />);
    expect(screen.queryByText('Microphone off.')).not.toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: 'Start listening' });
    await user.click(toggle);
    await microphone.grant({ processing: ['echo cancellation'] });
    // Zen leaves out the guidance and processing details.
    expect(
      screen.queryByText(/kept echo cancellation on/),
    ).not.toBeInTheDocument();
    microphone.hear(31);
    expect(heard()).toContain('Hearing G1 In the scale · degree 5');
    expect(screen.queryByText(/Ringed at/)).not.toBeInTheDocument();
    expect(heardFrets()).toEqual([
      'E1 string, fret 3, G1, scale note, matches heard pitch. Play note',
    ]);

    expect(toggle).toHaveAccessibleName('Stop listening');
    toggle.focus();
    await user.keyboard('?');
    expect(toggle).toHaveFocus();
    expect(heard()).toContain('Hearing G1');
    expect(screen.getByText(/kept echo cancellation on/)).toBeInTheDocument();
    await user.keyboard('?');
    expect(microphone.start).toHaveBeenCalledOnce();

    await user.click(toggle);
    microphone.start.mockClear();
    await user.click(toggle);
    await microphone.refuse(new MicrophoneError('denied'));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Microphone access is blocked',
    );
  });
});

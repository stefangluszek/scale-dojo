import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test as base, type Page } from '@playwright/test';
import { rootMeanSquare } from '../../src/domain/pitch/detector';
import {
  concat,
  encodeWav,
  fade,
  midiFrequency,
  silence,
  tone,
  whiteNoise,
} from '../../src/test/audioFixtures';

const SAMPLE_RATE = 48000;

/** RMS level for a level in dBFS. */
const dbfs = (decibels: number) => 10 ** (decibels / 20);

/**
 * What Chromium's fake microphone plays, on a loop, over quiet room noise
 * (about −75 dBFS): a firm low E1 (in C major pentatonic), then a soft F1
 * (outside it) at about −58 dBFS, below the old fixed −48 dBFS gate.
 */
function fakeBassRecording() {
  const note = (midi: number, seed: number, level: number) => {
    const samples = fade(
      tone({
        frequency: midiFrequency(midi),
        sampleRate: SAMPLE_RATE,
        length: Math.round(1.4 * SAMPLE_RATE),
        timbre: 'bass',
        amplitude: 0.6,
        decay: 0.4,
        seed,
      }),
      SAMPLE_RATE,
    );
    const scale = level / rootMeanSquare(samples);
    return samples.map((sample) => sample * scale);
  };
  const gap = silence(Math.round(0.6 * SAMPLE_RATE));
  const music = concat(
    gap,
    note(28, 1, dbfs(-20)),
    gap,
    note(29, 2, dbfs(-58)),
    gap,
  );
  // Uniform noise RMS is peak/√3.
  const room = whiteNoise(music.length, dbfs(-75) * Math.sqrt(3), 5);
  return music.map((sample, index) => sample + room[index]!);
}

declare global {
  interface Window {
    microphoneProbe: {
      requests: number;
      streams: MediaStream[];
      contexts: AudioContext[];
    };
  }
}

/**
 * Runs Chromium with a fake microphone that plays a deterministic recording.
 * This exercises real capture, Web Audio analysis and the UI, but it is not a
 * real bass, microphone or room.
 */
const test = base.extend<object, { fakeRecording: string }>({
  fakeRecording: [
    async ({}, use) => {
      const directory = await mkdtemp(join(tmpdir(), 'scale-dojo-'));
      const file = join(directory, 'fake-bass.wav');
      await writeFile(file, encodeWav(fakeBassRecording(), SAMPLE_RATE));
      await use(file);
      await rm(directory, { recursive: true, force: true });
    },
    { scope: 'worker' },
  ],
  launchOptions: [
    async ({ launchOptions, fakeRecording }, use) => {
      await use({
        ...launchOptions,
        args: [
          ...(launchOptions.args ?? []),
          '--use-fake-ui-for-media-stream',
          '--use-fake-device-for-media-stream',
          `--use-file-for-fake-audio-capture=${fakeRecording}`,
        ],
      });
    },
    { scope: 'worker' },
  ],
});

test.use({ permissions: ['microphone'] });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    // Observe streams and contexts without changing how they work.
    const probe: Window['microphoneProbe'] = {
      requests: 0,
      streams: [],
      contexts: [],
    };
    window.microphoneProbe = probe;
    const getUserMedia = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      probe.requests += 1;
      const stream = await getUserMedia(constraints);
      probe.streams.push(stream);
      return stream;
    };
    const BrowserAudioContext = window.AudioContext;
    window.AudioContext = class extends BrowserAudioContext {
      constructor(options?: AudioContextOptions) {
        super(options);
        probe.contexts.push(this);
      }
    };
  });
});

function listenPanel(page: Page) {
  return page.getByRole('region', { name: /Play (&|and) listen/ });
}

function readout(page: Page) {
  return listenPanel(page).getByRole('status');
}

async function expectReleased(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => ({
        tracks: window.microphoneProbe.streams
          .flatMap((stream) => stream.getTracks())
          .map((track) => track.readyState),
        contexts: window.microphoneProbe.contexts.map(
          (context) => context.state,
        ),
      })),
    )
    .toEqual({ tracks: ['ended'], contexts: ['closed'] });
}

test('hears a fake bass through the microphone and rings matching positions', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./');
  await page.getByRole('button', { name: 'Show full page' }).click();
  expect(await page.evaluate(() => window.microphoneProbe.requests)).toBe(0);
  await expect(readout(page)).toHaveText('Microphone off.');

  await page.getByRole('button', { name: 'Start listening' }).click();
  await expect(readout(page)).toContainText('Hearing E1', { timeout: 10_000 });
  await expect(readout(page)).toContainText('In the scale · degree');
  await expect(
    page.getByRole('button', {
      name: 'E1 string, open, E1, scale note, matches heard pitch. Play note',
    }),
  ).toHaveClass(/fret-heard/);
  await expect(
    page.getByRole('button', {
      name: 'Play E2, scale degree 3, matches heard note',
    }),
  ).toHaveClass(/circle-heard/);
  await expect(listenPanel(page).getByText(/cents|In tune/)).toBeVisible();
  await listenPanel(page).scrollIntoViewIfNeeded();
  await page.screenshot({
    path: testInfo.outputPath('listening.png'),
    fullPage: true,
  });

  // The recording moves on to a soft F1, outside the scale, after a silence.
  await expect(readout(page)).toContainText('Hearing F1', { timeout: 10_000 });
  await expect(readout(page)).toContainText('Outside the scale');
  await expect(
    page.getByRole('button', {
      name: 'E1 string, fret 1, F1, outside scale, matches heard pitch. Play note',
    }),
  ).toHaveClass(/fret-heard/);
  await expect(readout(page)).toHaveText('Listening. Play a note.', {
    timeout: 10_000,
  });

  if (testInfo.project.name.startsWith('mobile')) {
    await page.setViewportSize({ width: 320, height: 700 });
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  await page.getByRole('button', { name: 'Stop listening' }).click();
  await expect(readout(page)).toHaveText('Microphone off.');
  await expect(page.locator('.fret-heard, .circle-heard')).toHaveCount(0);
  await expectReleased(page);
  expect(await page.evaluate(() => window.microphoneProbe.requests)).toBe(1);
  expect(errors).toEqual([]);
});

test('zen mode listens from a compact row and keeps the practice space on screen', async ({
  page,
}, testInfo) => {
  await page.goto('./');
  const listen = page.getByRole('button', { name: 'Start listening' });
  await expect(page.locator('.scale-circle')).toBeInViewport({ ratio: 1 });
  await expect(
    page.getByRole('region', { name: 'Scrollable bass fretboard' }),
  ).toBeInViewport({ ratio: 1 });
  await listen.click();
  await expect(readout(page)).toContainText('Hearing E1', { timeout: 10_000 });
  await expect(
    page.getByRole('button', {
      name: 'Play E2, scale degree 3, matches heard note',
    }),
  ).toHaveClass(/circle-heard/);
  await expect(page.locator('.scale-circle')).toBeInViewport({ ratio: 1 });
  await expect(
    page.getByRole('region', { name: 'Scrollable bass fretboard' }),
  ).toBeInViewport({ ratio: 1 });
  await page.screenshot({ path: testInfo.outputPath('zen-listening.png') });

  // Unplugging the microphone ends its track.
  await page.evaluate(() =>
    window.microphoneProbe.streams[0]!.getAudioTracks()[0]!.dispatchEvent(
      new Event('ended'),
    ),
  );
  await expect(page.getByRole('alert')).toHaveText(
    'The microphone was disconnected. Reconnect it, then start again.',
  );
  await expect(
    page.getByRole('button', { name: 'Start listening' }),
  ).toBeVisible();
  await expect(page.locator('.fret-heard, .circle-heard')).toHaveCount(0);
  await expectReleased(page);
});

test('a blocked microphone explains what to do and leaves the explorer usable', async ({
  page,
}) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      window.microphoneProbe.requests += 1;
      throw new DOMException('Permission denied', 'NotAllowedError');
    };
  });
  await page.goto('./');
  await page.getByRole('button', { name: 'Start listening' }).click();
  await expect(page.getByRole('alert')).toContainText(
    'Microphone access is blocked',
  );
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.microphoneProbe.contexts.map((context) => context.state),
      ),
    )
    .toEqual(['closed']);
  await page.getByRole('button', { name: 'C major pentatonic' }).click();
  await page.getByRole('radio', { name: 'A', exact: true }).check();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(
    page.getByRole('button', { name: 'A major pentatonic' }),
  ).toBeVisible();
  // Trying again asks again.
  await page.getByRole('button', { name: 'Start listening' }).click();
  await expect
    .poll(() => page.evaluate(() => window.microphoneProbe.requests))
    .toBe(2);
});

test('saves each listen as a session to review, preserving its scale and the latest preferences across reload', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./');
  await page.getByRole('button', { name: 'Show full page' }).click();
  const sessions = page.getByRole('region', { name: 'Practice sessions' });
  await expect(sessions.getByRole('status')).toContainText('No sessions yet');
  // Each listening run is captured as a session.
  await page.getByRole('button', { name: 'Start listening' }).click();
  await expect(sessions.getByRole('status')).toContainText(
    'Recording C major pentatonic',
    { timeout: 10_000 },
  );
  const notes = sessions.getByRole('list', { name: 'Captured notes' });
  await expect(
    notes.getByRole('listitem').filter({ hasText: 'E1' }).first(),
  ).toBeVisible({ timeout: 10_000 });
  await expect(
    notes.getByRole('listitem').filter({ hasText: 'F1' }).first(),
  ).toContainText('Outside scale', { timeout: 10_000 });
  await page.getByRole('button', { name: 'Stop listening' }).click();
  await expectReleased(page);
  await expect(sessions.getByRole('status')).toContainText(
    'Session ready to review',
  );
  const count = await notes.getByRole('listitem').count();
  expect(count).toBeGreaterThanOrEqual(2);
  // The next scale differs; saved classifications must not change.
  await page.getByRole('combobox', { name: 'Root note' }).selectOption('9');
  await page
    .getByRole('combobox', { name: 'Scale', exact: true })
    .selectOption('natural-minor');
  await page.getByRole('slider', { name: 'Tempo' }).focus();
  await page.keyboard.press('End');
  await page.keyboard.press('ArrowLeft');
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Root note' })).toHaveValue(
    '9',
  );
  await expect(
    page.getByRole('combobox', { name: 'Scale', exact: true }),
  ).toHaveValue('natural-minor');
  await expect(page.getByRole('slider', { name: 'Tempo' })).toHaveValue('239');
  await expect(notes.getByRole('listitem')).toHaveCount(count);
  await expect(
    notes.getByRole('listitem').filter({ hasText: 'F1' }).first(),
  ).toContainText('Outside scale');
  expect(await page.evaluate(() => window.microphoneProbe.requests)).toBe(0);
  await sessions.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: testInfo.outputPath('session-review.png'),
    fullPage: true,
  });
  if (testInfo.project.name.startsWith('mobile')) {
    await page.setViewportSize({ width: 320, height: 700 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await sessions.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: testInfo.outputPath('session-review-narrow.png'),
      fullPage: true,
    });
  }
  await sessions.getByRole('button', { name: 'Clear session' }).click();
  await sessions.getByRole('button', { name: 'Confirm clear' }).click();
  await page.reload();
  await expect(sessions.getByRole('status')).toContainText('No sessions yet');
  await expect(page.getByRole('combobox', { name: 'Root note' })).toHaveValue(
    '9',
  );
  // Zen is a preference too, while listening always stays off after reload.
  await page.getByRole('button', { name: 'Enter zen mode' }).click();
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Show full page' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'A natural minor' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Start listening' }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test('recovers an interrupted capture after reloading without reopening the microphone', async ({
  page,
}) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Show full page' }).click();
  const sessions = page.getByRole('region', { name: 'Practice sessions' });
  await page.getByRole('button', { name: 'Start listening' }).click();
  await expect(
    sessions.getByRole('list', { name: 'Captured notes' }),
  ).toContainText('E1', { timeout: 10_000 });
  await page.reload();
  await expect(
    sessions.getByText(/Capture ended when listening was interrupted/),
  ).toBeVisible();
  await expect(
    sessions.getByRole('list', { name: 'Captured notes' }),
  ).toContainText('E1');
  await expect(
    page.getByRole('button', { name: 'Start listening' }),
  ).toBeVisible();
  expect(await page.evaluate(() => window.microphoneProbe.requests)).toBe(0);
});

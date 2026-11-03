import { expect, test, type Page } from '@playwright/test';

interface ScheduledNote {
  frequency: number;
  time: number;
  stops: number[];
}
declare global {
  interface Window {
    audioProbe: {
      contexts: AudioContext[];
      notes: ScheduledNote[];
      analysers: AnalyserNode[];
      microphoneRequests: number;
    };
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    // Observe real audio nodes without replacing synthesis or its clock.
    const probe: Window['audioProbe'] = {
      contexts: [],
      notes: [],
      analysers: [],
      microphoneRequests: 0,
    };
    window.audioProbe = probe;
    const BrowserAudioContext = window.AudioContext;
    window.AudioContext = class extends BrowserAudioContext {
      private analyser: AnalyserNode;
      constructor() {
        super();
        this.analyser = this.createAnalyser();
        probe.contexts.push(this);
        probe.analysers.push(this.analyser);
      }
      createGain() {
        const gain = super.createGain();
        gain.connect(this.analyser);
        return gain;
      }
      createOscillator() {
        const oscillator = super.createOscillator();
        let frequency = 0;
        let record: ScheduledNote;
        const setFrequency = oscillator.frequency.setValueAtTime.bind(
          oscillator.frequency,
        );
        oscillator.frequency.setValueAtTime = (value, time) => {
          frequency = value;
          return setFrequency(value, time);
        };
        const start = oscillator.start.bind(oscillator);
        oscillator.start = (time = 0) => {
          record = { frequency, time, stops: [] };
          probe.notes.push(record);
          start(time);
        };
        const stop = oscillator.stop.bind(oscillator);
        oscillator.stop = (time = 0) => {
          record.stops.push(time);
          stop(time);
        };
        return oscillator;
      }
    };
    navigator.mediaDevices.getUserMedia = async () => {
      probe.microphoneRequests += 1;
      throw new Error('These tests must not request the microphone');
    };
  });
});

/** The playback panel's status; the listening panel has its own. */
function playbackStatus(page: Page) {
  return page
    .getByRole('region', { name: 'Hear the scale' })
    .getByRole('status');
}

/** The app opens in zen mode; the full page holds selectors and playback. */
async function openFullPage(page: Page) {
  await page.getByRole('button', { name: 'Show full page' }).click();
  await expect(
    page.getByRole('button', { name: 'Enter zen mode' }),
  ).toBeVisible();
}

test('zen mode shows only the scale and fretboard, and ? toggles the full page', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./');
  const circle = page.locator('.scale-circle');
  const fretboard = page.getByRole('region', {
    name: 'Scrollable bass fretboard',
  });
  await expect(
    page.getByRole('heading', { name: 'C major pentatonic' }),
  ).toBeVisible();
  await expect(page.getByRole('table').getByRole('button')).toHaveCount(52);
  await expect(page.getByRole('combobox')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: /Play ascending/ }),
  ).toHaveCount(0);
  // Both fit on one screen without scrolling.
  await expect(circle).toBeInViewport({ ratio: 1 });
  await expect(fretboard).toBeInViewport({ ratio: 1 });
  await page.screenshot({ path: testInfo.outputPath('zen.png') });

  await page.keyboard.press('?');
  await expect(
    page.getByRole('heading', { name: 'Find your notes.' }),
  ).toBeVisible();
  await expect(page.getByRole('combobox')).toHaveCount(2);
  await page.getByRole('combobox', { name: 'Root note' }).selectOption('9');
  await page.getByRole('button', { name: 'Enter zen mode' }).click();
  await expect(page.getByRole('combobox')).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'A major pentatonic' }),
  ).toBeVisible();
  await page.keyboard.press('?');
  await expect(page.getByRole('combobox')).toHaveCount(2);
  await page.keyboard.press('?');
  await expect(page.getByRole('combobox')).toHaveCount(0);

  if (testInfo.project.name.startsWith('mobile')) {
    await page.setViewportSize({ width: 320, height: 700 });
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test('zen circle center changes the scale and number keys play its notes', async ({
  page,
}, testInfo) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'C major pentatonic' }).click();
  const picker = page.getByRole('dialog', { name: 'Choose a scale' });
  await expect(picker).toBeVisible();
  await expect(picker).toBeInViewport({ ratio: 1 });
  await page.getByRole('radio', { name: 'A', exact: true }).check();
  await page.getByRole('radio', { name: 'Natural minor' }).check();
  await expect(page.locator('.practice-space')).toHaveAttribute(
    'data-quality',
    'minor',
  );
  await page.screenshot({ path: testInfo.outputPath('zen-picker.png') });
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(picker).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'A natural minor' }),
  ).toBeFocused();
  await expect(page.getByRole('combobox')).toHaveCount(0);

  // A natural minor from A1: 3 is C2 and 8 is A2, the root an octave up.
  await page.keyboard.press('3');
  await expect
    .poll(() => page.evaluate(() => window.audioProbe.notes.length))
    .toBe(1);
  expect(
    await page.evaluate(() => window.audioProbe.notes[0]!.frequency),
  ).toBeCloseTo(65.4064, 4);
  await expect(
    page.getByRole('button', { name: 'Play C2, scale degree flat 3' }),
  ).toHaveClass(/circle-playing/);
  await page.keyboard.press('8');
  await expect
    .poll(() => page.evaluate(() => window.audioProbe.notes.length))
    .toBe(2);
  expect(
    await page.evaluate(() => window.audioProbe.notes[1]!.frequency),
  ).toBeCloseTo(110, 4);
  await page.keyboard.press('9');
  await page.keyboard.press('?');
  await expect(page.getByRole('combobox', { name: 'Root note' })).toHaveValue(
    '9',
  );
  expect(await page.evaluate(() => window.audioProbe.notes.length)).toBe(2);
});

test('zen arrow keys step the root and scale, but not on the fretboard or full page', async ({
  page,
}, testInfo) => {
  await page.goto('./');
  const heading = (name: string) =>
    expect(page.getByRole('heading', { name })).toBeVisible();
  await page.keyboard.press('ArrowUp');
  await heading('C# major pentatonic');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await heading('B major pentatonic');
  await page.keyboard.press('ArrowRight');
  await heading('B minor pentatonic');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await heading('B natural minor');
  await expect(page.locator('.practice-space')).toHaveAttribute(
    'data-quality',
    'minor',
  );

  // The focused fretboard keeps the arrow keys for scrolling.
  const fretboard = page.getByRole('region', {
    name: 'Scrollable bass fretboard',
  });
  await fretboard.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowUp');
  await heading('B natural minor');
  if (testInfo.project.name.startsWith('mobile')) {
    await expect
      .poll(() => fretboard.evaluate((element) => element.scrollLeft))
      .toBeGreaterThan(0);
  }

  // The full page has root and scale controls; arrows scroll it instead.
  await page.keyboard.press('?');
  await fretboard.blur();
  await page.keyboard.press('ArrowDown');
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(0);
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('combobox', { name: 'Root note' })).toHaveValue(
    '11',
  );
  await expect(page.getByRole('combobox', { name: 'Scale' })).toHaveValue(
    'natural-minor',
  );
});

test('production app keeps selectors, chips and accessible fretboard synchronized', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./');
  await openFullPage(page);
  await expect(
    page.getByRole('heading', { name: 'Find your notes.' }),
  ).toBeVisible();
  await expect(page.getByRole('table').getByRole('button')).toHaveCount(52);
  await expect(
    page.getByRole('button', {
      name: 'E1 string, open, E1, scale note. Play note',
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', {
      name: 'E1 string, fret 8, C2, root. Play note',
    }),
  ).toHaveText(/R/);
  await expect(
    page.getByRole('button', {
      name: 'A1 string, fret 3, C2, root. Play note',
    }),
  ).toHaveText(/R/);
  await page.getByRole('combobox', { name: 'Root note' }).selectOption('9');
  await page
    .getByRole('combobox', { name: 'Scale', exact: true })
    .selectOption('natural-minor');
  await expect(
    page.getByRole('heading', { name: 'A natural minor' }),
  ).toBeVisible();
  await expect(
    page
      .getByRole('list', { name: 'Notes in the selected scale' })
      .locator('.note-name'),
  ).toHaveText(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
  await expect(page.locator('.practice-space')).toHaveAttribute(
    'data-quality',
    'minor',
  );
  await expect(
    page.getByRole('button', { name: 'A1 string, open, A1, root. Play note' }),
  ).toHaveText(/R/);
  await expect(
    page.getByRole('button', {
      name: 'E1 string, fret 1, F1, scale note. Play note',
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', {
      name: 'E1 string, fret 8, C2, scale note. Play note',
    }),
  ).toBeAttached();
  const fretboard = page.getByRole('region', {
    name: 'Scrollable bass fretboard',
  });
  await fretboard.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: testInfo.outputPath('explorer.png'),
    fullPage: true,
  });
  const lastNote = page.getByRole('button', {
    name: 'G2 string, fret 12, G3, scale note. Play note',
  });
  await lastNote.focus();
  await expect(lastNote).toBeInViewport();
  await expect(lastNote).toBeFocused();
  if (testInfo.project.name.startsWith('mobile')) {
    expect(
      await fretboard.evaluate(
        (element) =>
          element.scrollWidth > element.clientWidth && element.scrollLeft > 0,
      ),
    ).toBe(true);
    await page.setViewportSize({ width: 320, height: 700 });
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(await page.evaluate(() => window.audioProbe.contexts.length)).toBe(0);
  expect(await page.evaluate(() => window.audioProbe.microphoneRequests)).toBe(
    0,
  );
  expect(errors).toEqual([]);
});

test('click and keyboard notes produce real audio at the mapped pitch', async ({
  page,
}) => {
  await page.goto('./');
  await openFullPage(page);
  const note = page.getByRole('button', {
    name: 'E1 string, open, E1, scale note. Play note',
  });
  await note.click();
  await expect
    .poll(() => page.evaluate(() => window.audioProbe.contexts[0]?.state))
    .toBe('running');
  const frequency = await page.evaluate(
    () => window.audioProbe.notes[0]!.frequency,
  );
  expect(frequency).toBeCloseTo(41.2034, 4);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const analyser = window.audioProbe.analysers[0]!;
        const samples = new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(samples);
        return samples.some((sample) => Math.abs(sample) > 0.001);
      }),
    )
    .toBe(true);
  await expect(note).toHaveClass(/fret-playing/);
  const chip = page.getByRole('button', { name: 'Play C2, root' });
  await chip.focus();
  await page.keyboard.press('Enter');
  await expect
    .poll(() => page.evaluate(() => window.audioProbe.notes.length))
    .toBe(2);
  expect(
    await page.evaluate(() => window.audioProbe.notes[1]!.frequency),
  ).toBeCloseTo(65.4064, 4);
  await expect(
    page.getByRole('button', {
      name: 'E1 string, fret 8, C2, root. Play note',
    }),
  ).toHaveClass(/fret-playing/);
  await expect(
    page.getByRole('button', {
      name: 'A1 string, fret 3, C2, root. Play note',
    }),
  ).toHaveClass(/fret-playing/);
  await expect(playbackStatus(page)).toHaveText('Ready to play');
  expect(await page.evaluate(() => window.audioProbe.contexts.length)).toBe(1);
  expect(await page.evaluate(() => window.audioProbe.microphoneRequests)).toBe(
    0,
  );
});

test('circle notes respond to pointer clicks in zen mode, including notes outside the scale', async ({
  page,
}) => {
  await page.goto('./');
  await expect(
    page.getByRole('button', { name: 'Show full page' }),
  ).toBeVisible();
  await expect(page.locator('.practice-space')).toHaveAttribute(
    'data-quality',
    'major',
  );
  const second = page.getByRole('button', { name: 'Play D2, scale degree 2' });
  await second.click();
  await expect
    .poll(() => page.evaluate(() => window.audioProbe.notes.length))
    .toBe(1);
  expect(
    await page.evaluate(() => window.audioProbe.notes[0]!.frequency),
  ).toBeCloseTo(73.4162, 4);
  await expect(second).toHaveClass(/circle-playing/);
  const outside = page.getByRole('button', {
    name: 'Play C#2, outside scale',
  });
  await outside.click();
  await expect
    .poll(() => page.evaluate(() => window.audioProbe.notes.length))
    .toBe(2);
  expect(
    await page.evaluate(() => window.audioProbe.notes[1]!.frequency),
  ).toBeCloseTo(69.2957, 4);
  await expect(outside).toHaveClass(/circle-playing/);
  await page.setViewportSize({ width: 320, height: 700 });
  const circle = await page.locator('.scale-circle').boundingBox();
  expect(circle!.x).toBeGreaterThanOrEqual(0);
  expect(circle!.x + circle!.width).toBeLessThanOrEqual(320);
  await page.getByRole('button', { name: 'Play A2, scale degree 6' }).click();
  await expect
    .poll(() => page.evaluate(() => window.audioProbe.notes.length))
    .toBe(3);
});

test('scale playback follows direction and tempo, and cancels on Stop and selection changes', async ({
  page,
}) => {
  await page.goto('./');
  await openFullPage(page);
  const tempo = page.getByRole('slider', { name: 'Tempo' });
  await tempo.focus();
  await page.keyboard.press('Home');
  await expect(tempo).toHaveValue('40');
  await page.getByRole('button', { name: /Play ascending/ }).click();
  await expect(playbackStatus(page)).toContainText('Playing');
  await expect
    .poll(() => page.evaluate(() => window.audioProbe.notes.length))
    .toBe(6);
  const ascending = await page.evaluate(() => window.audioProbe.notes);
  expect(
    ascending.map((note) =>
      Math.round(69 + 12 * Math.log2(note.frequency / 440)),
    ),
  ).toEqual([36, 38, 40, 43, 45, 48]);
  expect(ascending[1]!.time - ascending[0]!.time).toBeCloseTo(1.5, 5);
  await page.getByRole('button', { name: 'Stop playback' }).click();
  await expect(playbackStatus(page)).toHaveText('Ready to play');
  expect(
    await page.evaluate(() =>
      window.audioProbe.notes.every((note) => note.stops.at(-1) === 0),
    ),
  ).toBe(true);
  await tempo.focus();
  await page.keyboard.press('End');
  await expect(tempo).toHaveValue('240');
  await page.getByRole('button', { name: /Play descending/ }).click();
  await expect
    .poll(() => page.evaluate(() => window.audioProbe.notes.length))
    .toBe(12);
  const descending = await page.evaluate(() =>
    window.audioProbe.notes.slice(6),
  );
  expect(
    descending.map((note) =>
      Math.round(69 + 12 * Math.log2(note.frequency / 440)),
    ),
  ).toEqual([48, 45, 43, 40, 38, 36]);
  expect(descending[1]!.time - descending[0]!.time).toBeCloseTo(0.25, 5);
  await expect(playbackStatus(page)).toHaveText('Ready to play');
  await page.getByRole('button', { name: /Play ascending/ }).click();
  await page.getByRole('combobox', { name: 'Root note' }).selectOption('4');
  await expect(playbackStatus(page)).toHaveText('Ready to play');
  await expect(
    page.getByRole('button', { name: 'Stop playback' }),
  ).toBeDisabled();
  await page.getByRole('button', { name: /Play ascending/ }).click();
  await page
    .getByRole('combobox', { name: 'Scale', exact: true })
    .selectOption('major');
  await expect(playbackStatus(page)).toHaveText('Ready to play');
  await page.getByRole('button', { name: /Play ascending/ }).click();
  await tempo.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(tempo).toHaveValue('235');
  await expect(playbackStatus(page)).toHaveText('Ready to play');
});

test('audio unavailability leaves the visual explorer usable', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'AudioContext', { value: undefined });
  });
  await page.goto('./');
  await openFullPage(page);
  await page.getByRole('button', { name: /Play ascending/ }).click();
  await expect(page.getByRole('alert')).toContainText(
    'Audio playback is unavailable',
  );
  await expect(
    page.getByRole('button', { name: 'Stop playback' }),
  ).toBeDisabled();
  await page.getByRole('combobox', { name: 'Root note' }).selectOption('4');
  await expect(
    page.getByRole('heading', { name: 'E major pentatonic' }),
  ).toBeVisible();
});

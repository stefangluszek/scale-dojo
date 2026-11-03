import { useEffect, useEffectEvent, useRef } from 'react';

/** Input types that don't take typed text, so shortcuts still work in them. */
const NON_TEXT_INPUTS = new Set([
  'button',
  'checkbox',
  'radio',
  'range',
  'reset',
  'submit',
]);

function isTextEntry(target: EventTarget | null): boolean {
  if (target instanceof HTMLInputElement) {
    return !NON_TEXT_INPUTS.has(target.type);
  }
  return (
    target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement
  );
}

/**
 * Radio groups and sliders move with the arrow keys, and so do scroll areas
 * made focusable with tabindex, such as the fretboard.
 */
function usesArrowKeys(target: EventTarget | null): boolean {
  if (target instanceof HTMLInputElement) {
    return target.type === 'radio' || target.type === 'range';
  }
  return target instanceof HTMLElement && target.hasAttribute('tabindex');
}

function isArrowKey(key: string): boolean {
  return key.startsWith('Arrow');
}

/**
 * Runs the action mapped to a pressed key, such as `'?'`, `'1'`, `' '` or
 * `'ArrowUp'`. Keys are ignored with Ctrl, Alt or Meta, on repeat, when
 * another handler already claimed them, and while typing in a text field or
 * choosing in a select. Arrow keys are also left to the focused radio
 * button, slider or scroll area.
 */
export function useKeyboardShortcuts(
  shortcuts: Readonly<Record<string, () => void>>,
) {
  // The key whose press ran a shortcut. Its repeats and release are claimed
  // too, so holding Space doesn't scroll and releasing it doesn't also press
  // a focused button.
  const held = useRef<string | null>(null);

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.repeat) {
      if (event.key === held.current) event.preventDefault();
      return;
    }
    if (
      event.defaultPrevented ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      isTextEntry(event.target) ||
      (isArrowKey(event.key) && usesArrowKeys(event.target)) ||
      !Object.hasOwn(shortcuts, event.key)
    ) {
      return;
    }
    event.preventDefault();
    held.current = event.key;
    shortcuts[event.key]!();
  });

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => onKeyDown(event);
    const keyUp = (event: KeyboardEvent) => {
      if (event.key !== held.current) return;
      event.preventDefault();
      held.current = null;
    };
    document.addEventListener('keydown', keyDown);
    document.addEventListener('keyup', keyUp);
    return () => {
      document.removeEventListener('keydown', keyDown);
      document.removeEventListener('keyup', keyUp);
    };
  }, []);
}

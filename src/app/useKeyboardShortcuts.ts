import { useEffect, useEffectEvent } from 'react';

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
 * Runs the action mapped to a pressed key, such as `'?'` or `'1'`. Keys are
 * ignored with Ctrl, Alt or Meta, on repeat, when another handler already
 * claimed them, and while typing in a text field or choosing in a select.
 */
export function useKeyboardShortcuts(
  shortcuts: Readonly<Record<string, () => void>>,
) {
  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (
      event.repeat ||
      event.defaultPrevented ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      isTextEntry(event.target) ||
      !Object.hasOwn(shortcuts, event.key)
    ) {
      return;
    }
    event.preventDefault();
    shortcuts[event.key]!();
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKeyDown(event);
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, []);
}

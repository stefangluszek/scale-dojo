import { useCallback, useEffect, useState } from 'react';

/** Zen shows only the scale circle and fretboard; full adds everything else. */
export type ViewMode = 'zen' | 'full';

/** Key that toggles between zen mode and the full page. */
export const VIEW_TOGGLE_KEY = '?';

const FORM_FIELDS = new Set(['INPUT', 'SELECT', 'TEXTAREA']);

function isFormField(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && FORM_FIELDS.has(target.tagName);
}

export function useViewMode() {
  const [view, setView] = useState<ViewMode>('zen');
  const toggle = useCallback(
    () => setView((current) => (current === 'zen' ? 'full' : 'zen')),
    [],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key !== VIEW_TOGGLE_KEY ||
        event.repeat ||
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        isFormField(event.target)
      ) {
        return;
      }
      event.preventDefault();
      toggle();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [toggle]);

  return { view, toggle };
}

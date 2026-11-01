import { useEffect, useEffectEvent, useRef, type RefObject } from 'react';
import {
  NOTE_NAMES,
  SCALE_DEFINITIONS,
  type PitchClass,
  type ScaleId,
} from '../../domain/music/scales';

interface ScalePickerProps {
  id: string;
  root: PitchClass;
  scaleId: ScaleId;
  /** The button that opened the picker; focus returns to it on close. */
  opener: RefObject<HTMLButtonElement | null>;
  onRootChange: (root: PitchClass) => void;
  onScaleChange: (scaleId: ScaleId) => void;
  onClose: () => void;
}

/**
 * A small non-modal dialog for choosing the root and scale. Choices apply
 * immediately. Escape, Done, clicking outside or tabbing away closes it.
 */
export function ScalePicker({
  id,
  root,
  scaleId,
  opener,
  onRootChange,
  onScaleChange,
  onClose,
}: ScalePickerProps) {
  const panel = useRef<HTMLDivElement>(null);
  const isInside = (target: EventTarget | null) =>
    target instanceof Node &&
    (panel.current!.contains(target) || opener.current!.contains(target));
  const closeToOpener = () => {
    onClose();
    opener.current!.focus();
  };

  const onDocumentPointerDown = useEffectEvent((event: Event) => {
    if (!isInside(event.target)) onClose();
  });
  const onDocumentKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === 'Escape') closeToOpener();
  });

  useEffect(() => {
    panel.current!.querySelector<HTMLInputElement>('input:checked')!.focus();
    const pointerDown = (event: Event) => onDocumentPointerDown(event);
    const keyDown = (event: KeyboardEvent) => onDocumentKeyDown(event);
    document.addEventListener('pointerdown', pointerDown);
    document.addEventListener('keydown', keyDown);
    return () => {
      document.removeEventListener('pointerdown', pointerDown);
      document.removeEventListener('keydown', keyDown);
    };
  }, []);

  return (
    <div
      id={id}
      ref={panel}
      className="scale-picker"
      role="dialog"
      aria-label="Choose a scale"
      onBlur={(event) => {
        // Close when keyboard focus moves elsewhere on the page.
        if (event.relatedTarget && !isInside(event.relatedTarget)) onClose();
      }}
    >
      <fieldset>
        <legend>Root</legend>
        <div className="picker-options picker-roots">
          {NOTE_NAMES.map((name, pitchClass) => (
            <label key={name}>
              <input
                type="radio"
                name="picker-root"
                checked={pitchClass === root}
                onChange={() => onRootChange(pitchClass as PitchClass)}
              />
              <span>{name}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>Scale</legend>
        <div className="picker-options picker-scales">
          {SCALE_DEFINITIONS.map((definition) => (
            <label key={definition.id}>
              <input
                type="radio"
                name="picker-scale"
                checked={definition.id === scaleId}
                onChange={() => onScaleChange(definition.id)}
              />
              <span>{definition.name}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <button type="button" className="picker-done" onClick={closeToOpener}>
        Done
      </button>
    </div>
  );
}

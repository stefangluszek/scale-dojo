import { useCallback, useRef, useState, type SetStateAction } from 'react';
import { readStored, writeStored } from './local';

/** Saves only explicit changes, preserving unreadable data until user action. */
export function useStoredState<T>(
  key: string,
  valid: (value: unknown) => value is T,
  fallback: T,
  restore: (value: T) => T = (value) => value,
) {
  const [initial] = useState(() => readStored(key, valid, fallback));
  const [value, setValue] = useState(() => restore(initial.value));
  const current = useRef(value);
  const [problem, setProblem] = useState(initial.problem);
  const update = useCallback(
    (action: SetStateAction<T>) => {
      const next =
        typeof action === 'function'
          ? (action as (previous: T) => T)(current.current)
          : action;
      current.current = next;
      setValue(next);
      setProblem(writeStored(key, next));
    },
    [key],
  );
  const retry = useCallback(
    () => setProblem(writeStored(key, current.current)),
    [key],
  );
  return { value, update, problem, retry };
}

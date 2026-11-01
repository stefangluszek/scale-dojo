import { useCallback, useEffect, useRef, useState } from 'react';
import {
  SessionCapture,
  type PracticeSession,
  type SessionContext,
} from '../../domain/practice/session';
import type { LiveReading } from '../../domain/pitch/stabilizer';
import { isSessions, SESSIONS_KEY } from '../../platform/storage/sessions';
import { useStoredState } from '../../platform/storage/useStoredState';

const restoreSessions = (sessions: PracticeSession[]): PracticeSession[] =>
  sessions.map((session) =>
    session.status === 'recording'
      ? { ...session, status: 'interrupted' }
      : session,
  );

export function usePracticeSessions() {
  const stored = useStoredState(SESSIONS_KEY, isSessions, [], restoreSessions);
  const [selectedId, setSelectedId] = useState<string | null>(
    stored.value[0]?.id ?? null,
  );
  const [status, setStatus] = useState<'idle' | 'waiting' | 'recording'>(
    'idle',
  );
  const pending = useRef<SessionContext | null>(null);
  const capture = useRef<SessionCapture | null>(null);
  const save = stored.update;

  const commit = useCallback(
    (session: PracticeSession) => {
      save((sessions) => [
        session,
        ...sessions.filter((item) => item.id !== session.id),
      ]);
    },
    [save],
  );

  const ready = useCallback(() => {
    if (!pending.current || capture.current) return;
    capture.current = new SessionCapture(
      pending.current,
      performance.now(),
      Date.now(),
      crypto.randomUUID(),
    );
    pending.current = null;
    const session = capture.current.snapshot();
    setSelectedId(session.id);
    setStatus('recording');
    commit(session);
  }, [commit]);

  const begin = (context: SessionContext, listening: boolean) => {
    if (pending.current || capture.current) return;
    pending.current = {
      ...context,
      instrument: {
        ...context.instrument,
        tuning: [...context.instrument.tuning],
      },
    };
    setStatus('waiting');
    if (listening) ready();
  };

  const onReading = useCallback(
    (reading: LiveReading, time: number) => {
      const current = capture.current;
      if (current?.push(reading, time)) commit(current.snapshot());
    },
    [commit],
  );

  const finish = useCallback(
    (interrupted = false) => {
      pending.current = null;
      if (capture.current) {
        commit(capture.current.finish(performance.now(), interrupted));
        capture.current = null;
      }
      setStatus('idle');
    },
    [commit],
  );

  useEffect(() => {
    // Checkpoint held notes once per second, and finalize before a reload.
    const timer = setInterval(() => {
      if (capture.current) commit(capture.current.snapshot());
    }, 1000);
    const onPageHide = () => finish(true);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      clearInterval(timer);
      window.removeEventListener('pagehide', onPageHide);
      // Microphone teardown also finishes capture; this covers standalone use.
      if (capture.current) finish(true);
    };
  }, [commit, finish]);

  const clear = (id: string) => {
    if (capture.current || pending.current) return;
    save((sessions) => sessions.filter((session) => session.id !== id));
    setSelectedId(null);
  };

  const selected =
    stored.value.find((session) => session.id === selectedId) ??
    stored.value[0] ??
    null;
  return {
    sessions: stored.value,
    selected,
    select: setSelectedId,
    status,
    begin,
    ready,
    onReading,
    finish,
    clear,
    problem: stored.problem,
    retry: stored.retry,
  };
}

export type PracticeSessions = ReturnType<typeof usePracticeSessions>;

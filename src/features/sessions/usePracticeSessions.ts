import { useCallback, useEffect, useRef, useState } from 'react';
import {
  SessionCapture,
  type PracticeSession,
  type SessionContext,
} from '../../domain/practice/session';
import type { LiveReading } from '../../domain/pitch/stabilizer';
import { isSessions, SESSIONS_KEY } from '../../platform/storage/sessions';
import { useStoredState } from '../../platform/storage/useStoredState';

/**
 * Unfinished captures become interrupted reviews. A capture checkpointed
 * before its first note has nothing to review, so it is dropped.
 */
const restoreSessions = (sessions: PracticeSession[]): PracticeSession[] =>
  sessions.flatMap((session) => {
    if (session.status !== 'recording') return [session];
    return session.events.length
      ? [{ ...session, status: 'interrupted' as const }]
      : [];
  });

/**
 * Each listening run is one session: capture begins when the microphone is
 * ready and ends when listening stops for any reason. Runs with no detected
 * notes are discarded, so checking the microphone doesn't fill the history.
 */
export function usePracticeSessions() {
  const stored = useStoredState(SESSIONS_KEY, isSessions, [], restoreSessions);
  const [selectedId, setSelectedId] = useState<string | null>(
    stored.value[0]?.id ?? null,
  );
  const [liveId, setLiveId] = useState<string | null>(null);
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

  /** Call when the microphone is ready, with the context to freeze. */
  const begin = useCallback(
    (context: SessionContext) => {
      if (capture.current) return;
      capture.current = new SessionCapture(
        context,
        performance.now(),
        Date.now(),
        crypto.randomUUID(),
      );
      const session = capture.current.snapshot();
      setSelectedId(session.id);
      setLiveId(session.id);
      commit(session);
    },
    [commit],
  );

  const onReading = useCallback(
    (reading: LiveReading, time: number) => {
      const current = capture.current;
      if (current?.push(reading, time)) commit(current.snapshot());
    },
    [commit],
  );

  const finish = useCallback(
    (interrupted = false) => {
      const current = capture.current;
      capture.current = null;
      setLiveId(null);
      if (!current) return;
      const session = current.finish(performance.now(), interrupted);
      if (session.events.length) {
        commit(session);
        return;
      }
      save((sessions) => sessions.filter((item) => item.id !== session.id));
      setSelectedId((id) => (id === session.id ? null : id));
    },
    [commit, save],
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
    if (id === liveId) return;
    save((sessions) => sessions.filter((session) => session.id !== id));
    setSelectedId(null);
  };

  const find = (id: string | null) =>
    stored.value.find((session) => session.id === id) ?? null;
  return {
    sessions: stored.value,
    selected: find(selectedId) ?? stored.value[0] ?? null,
    select: setSelectedId,
    /** The session being captured right now, if any. */
    live: find(liveId),
    begin,
    onReading,
    finish,
    clear,
    problem: stored.problem,
    retry: stored.retry,
  };
}

export type PracticeSessions = ReturnType<typeof usePracticeSessions>;

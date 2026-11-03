import { useCallback, useEffect, useRef, useState } from 'react';
import { Metronome } from '../../platform/audio/Metronome';

export function useMetronome(tempo: number) {
  const player = useRef<Metronome | null>(null);
  const request = useRef(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState('');

  const stop = useCallback(() => {
    request.current += 1;
    player.current?.stop();
    setIsPlaying(false);
  }, []);

  useEffect(() => {
    player.current?.setTempo(tempo);
  }, [tempo]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) stop();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', stop);
    return () => {
      request.current += 1;
      player.current?.dispose();
      player.current = null;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', stop);
    };
  }, [stop]);

  async function start() {
    const currentRequest = ++request.current;
    setError('');
    setIsPlaying(true);
    player.current ??= new Metronome();
    try {
      await player.current.start(tempo);
    } catch (cause) {
      if (currentRequest !== request.current) return;
      stop();
      setError(
        cause instanceof Error
          ? cause.message
          : 'The metronome could not start. Please try again.',
      );
    }
  }

  return { start, stop, isPlaying, error };
}

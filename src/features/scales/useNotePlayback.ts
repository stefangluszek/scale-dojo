import { useCallback, useEffect, useRef, useState } from 'react';
import { NotePlayer } from '../../platform/audio/NotePlayer';

export function useNotePlayback(volume: number) {
  const player = useRef<NotePlayer | null>(null);
  const request = useRef(0);
  const [activeNote, setActiveNote] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState('');

  const stop = useCallback(() => {
    request.current += 1;
    player.current?.stop();
    setIsPlaying(false);
    setActiveNote(null);
  }, []);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) stop();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      request.current += 1;
      player.current?.dispose();
      player.current = null;
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [stop]);

  useEffect(() => {
    player.current?.setVolume(volume);
  }, [volume]);

  async function play(notes: readonly number[], bpm: number) {
    stop();
    const currentRequest = request.current;
    setError('');
    setIsPlaying(true);
    player.current ??= new NotePlayer();
    player.current.setVolume(volume);
    try {
      await player.current.play(notes, bpm, setActiveNote, () => {
        setIsPlaying(false);
        setActiveNote(null);
      });
    } catch (cause) {
      if (currentRequest !== request.current) return;
      stop();
      setError(
        cause instanceof Error
          ? cause.message
          : 'Audio could not start. Please try again.',
      );
    }
  }

  return { play, stop, activeNote, isPlaying, error };
}

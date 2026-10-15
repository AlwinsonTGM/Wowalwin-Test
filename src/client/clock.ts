import { useEffect, useState } from 'react';
import { secondsLeft } from '../game/machine.ts';

/**
 * The answer window, counted down on the surface's own clock. Re-renders while
 * a question is on screen and not one tick longer, so the Stage and forty
 * phones are not redrawing after the window has closed.
 */
export function useSecondsLeft(askedAt: number | null): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (askedAt === null) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [askedAt]);

  return askedAt === null ? 0 : secondsLeft(askedAt, now);
}
import { useEffect, useState } from 'react';
import { getGraceRemainingMs } from '@/lib/editGracePeriod';

/**
 * Live countdown for the 10-minute edit grace period.
 *
 * Returns the milliseconds remaining, re-rendering once per second while the
 * window is open, then stopping. Pass `enabled = false` (e.g. the viewer isn't
 * the requester, or the status is past `approved`) to skip the timer entirely
 * — no interval is created and it returns 0.
 *
 * The interval clears itself the moment it hits zero, so an open request
 * detail page left on screen doesn't tick forever.
 */
export function useGraceCountdown(
  createdAt: string | null | undefined,
  enabled: boolean = true,
): number {
  const [remainingMs, setRemainingMs] = useState<number>(() =>
    enabled ? getGraceRemainingMs(createdAt) : 0,
  );

  useEffect(() => {
    if (!enabled) {
      setRemainingMs(0);
      return;
    }

    // Re-sync immediately: `createdAt` may have arrived after first render.
    const initial = getGraceRemainingMs(createdAt);
    setRemainingMs(initial);
    if (initial <= 0) return;

    const timer = setInterval(() => {
      const next = getGraceRemainingMs(createdAt);
      setRemainingMs(next);
      if (next <= 0) clearInterval(timer);
    }, 1000);

    return () => clearInterval(timer);
  }, [createdAt, enabled]);

  return remainingMs;
}

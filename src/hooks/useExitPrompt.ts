import { useEffect, useCallback, useRef } from 'react';

/**
 * Intercepts browser back-button navigation on dashboard routes.
 * Pushes a dummy history entry on mount; when popstate fires (back pressed),
 * calls `onBackAttempt` instead of navigating away.
 *
 * The caller is responsible for either:
 *   - calling `allowExit()` to actually navigate away (sign out flow), or
 *   - calling `resetTrap()` to re-push the dummy entry (cancel flow).
 */
export function useExitPrompt(onBackAttempt: () => void) {
  const handlerRef = useRef(onBackAttempt);
  handlerRef.current = onBackAttempt;

  // Whether we should intercept — disabled during intentional navigation
  const activeRef = useRef(true);

  useEffect(() => {
    // Push a dummy state so that "back" pops this instead of leaving the app
    window.history.pushState({ exitGuard: true }, '');

    const handlePopState = () => {
      if (!activeRef.current) return;
      // The dummy entry was popped — the user pressed Back.
      // Don't navigate; instead notify the caller.
      handlerRef.current();
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  /** Re-push the dummy entry after the user cancels the exit prompt */
  const resetTrap = useCallback(() => {
    window.history.pushState({ exitGuard: true }, '');
  }, []);

  /** Disable the trap so a real navigation (sign-out redirect) can proceed */
  const allowExit = useCallback(() => {
    activeRef.current = false;
  }, []);

  return { resetTrap, allowExit };
}

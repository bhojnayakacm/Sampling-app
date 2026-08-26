import { useEffect } from 'react';

/**
 * Trigger the browser's native "Leave site?" prompt while a form holds
 * unsaved work.
 *
 * SCOPE: this covers the events React Router cannot see — tab close, reload,
 * typing a new URL, and the OS back-swipe when it exits the page rather than
 * popping in-app history. In-app navigation is guarded separately by the
 * popstate interceptor in NewRequest, which can show a real dialog with a
 * "Save draft" option. Both are needed; neither replaces the other.
 *
 * BROWSER CONTRACT: the wording is fixed by the browser and cannot be
 * customised — every modern engine ignores a custom string to stop sites
 * writing scare copy. `preventDefault()` is the modern signal; `returnValue`
 * is kept for older Chrome/Edge, which still require it.
 *
 * The prompt also only appears if the user has interacted with the page
 * (a browser anti-abuse rule), which happens to align exactly with the
 * condition we pass in: `enabled` is only true once they have typed something.
 */
export function usePreventNavigation(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Legacy path: older Chromium needs a non-empty returnValue to prompt.
      event.returnValue = '';
      return '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [enabled]);
}

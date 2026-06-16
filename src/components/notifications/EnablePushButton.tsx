import { Bell, BellOff, Loader2, Share } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePushNotifications } from '@/hooks/usePushNotifications';

interface EnablePushButtonProps {
  /**
   * When true, render in header-row mode: drop `w-full`/`mb-3`, suppress
   * the multi-line "permission denied" hint (return null instead). Default
   * (false) is the original sidebar-footer layout used by DashboardLayout.
   */
  inline?: boolean;
}

/**
 * Detects iOS — covers iPhone / iPod / iPad including iPadOS that reports
 * itself as MacIntel with touchpoints. Used to surface the Add-to-Home-
 * Screen hint when Web Push isn't yet supported (which is iOS Safari's
 * tab mode — iOS 16.4+ only enables Web Push for *installed* PWAs).
 */
function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS 13+ reports as MacIntel; multi-touch is the giveaway.
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}

/**
 * Opt-in control for PWA system push notifications.
 *
 * Branching on browser capability:
 *   1. `supported && permission === 'denied'`  → permission blocked hint
 *      (sidebar) or null (inline).
 *   2. `supported`                              → the actual Bell button.
 *   3. `!supported && isIOS()`                  → "Add to Home Screen"
 *      hint. This is the most common case on iPhone: Web Push only works
 *      in iOS 16.4+ installed PWAs, not Safari tabs, so the previous
 *      `return null` left dispatchers/makers wondering why the button
 *      wasn't there. We now tell them how to get it.
 *   4. `!supported && !isIOS()`                 → null (genuinely
 *      unsupported browser; no actionable guidance we could offer).
 */
export default function EnablePushButton({ inline = false }: EnablePushButtonProps = {}) {
  const { supported, permission, isSubscribed, isBusy, enable, disable } =
    usePushNotifications();

  if (!supported) {
    // iOS Safari tab: no Push API. Tell the user how to install instead.
    if (isIOS()) {
      // Same compact-vs-roomy split as the permission-denied hint below.
      if (inline) {
        return (
          <span
            role="note"
            aria-label="Enable notifications by adding to Home Screen"
            className="hidden sm:inline-flex items-center gap-1.5 text-[11px] leading-tight text-slate-500 bg-slate-50 border border-slate-200 rounded-md px-2 py-1 max-w-[220px]"
          >
            <Share className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span className="truncate">Tap Share → Add to Home Screen for alerts</span>
          </span>
        );
      }
      return (
        <div
          role="note"
          className="flex items-start gap-2 text-[11px] leading-snug text-slate-500 bg-slate-50 border border-slate-200 rounded-md px-2.5 py-2 mb-3"
        >
          <Share className="h-3.5 w-3.5 mt-0.5 shrink-0 text-slate-400" />
          <span>
            To enable notifications on iPhone, tap the{' '}
            <span className="font-medium text-slate-700">Share</span> icon in
            Safari and choose{' '}
            <span className="font-medium text-slate-700">Add to Home Screen</span>.
            Open SampleHub from the home-screen icon and you'll see the Enable
            button.
          </span>
        </div>
      );
    }
    // Genuinely unsupported (e.g. older desktop browser) — silent.
    return null;
  }

  // The user blocked notifications — only browser settings can undo this.
  if (permission === 'denied') {
    if (inline) return null; // header row has no space for a hint paragraph
    return (
      <p className="text-[11px] leading-tight text-slate-400 px-1 mb-3">
        Push notifications are blocked. Enable them in your browser site
        settings to receive new-request alerts.
      </p>
    );
  }

  // Layout classes differ between sidebar footer and inline header row.
  const layoutClasses = inline
    ? 'gap-2 min-h-[44px] border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
    : 'w-full gap-2 min-h-[44px] mb-3 border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900';

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={isSubscribed ? disable : enable}
      disabled={isBusy}
      className={layoutClasses}
    >
      {isBusy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isSubscribed ? (
        <BellOff className="h-4 w-4" />
      ) : (
        <Bell className="h-4 w-4" />
      )}
      {/* In inline mode, hide the label on small screens so the header stays compact. */}
      <span className={inline ? 'hidden sm:inline' : ''}>
        {isSubscribed ? 'Disable Push Alerts' : 'Enable Push Alerts'}
      </span>
    </Button>
  );
}

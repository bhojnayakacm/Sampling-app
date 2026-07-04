import { Bell, BellOff, Loader2, Share } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { usePushNotifications } from '@/hooks/usePushNotifications';

interface EnablePushButtonProps {
  /**
   * When true, render in header-row mode (mobile dashboard headers):
   * a compact icon button whose label collapses on small screens.
   * Default (false) is the roomy sidebar-footer layout used by
   * DashboardLayout, which can afford multi-line explanatory hints.
   */
  inline?: boolean;
}

/**
 * Detects iOS — covers iPhone / iPod / iPad including iPadOS that reports
 * itself as MacIntel with touchpoints. Used to tailor the "unsupported"
 * guidance: on iOS, Web Push needs an *installed* PWA (iOS 16.4+), so the
 * fix is Add-to-Home-Screen rather than "switch browser".
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
 * INLINE MODE (mobile dashboard headers) NEVER renders null — the bell is
 * always visible so the affordance can't vanish on a phone:
 *   1. supported + grantable → active bell, toggles subscribe/unsubscribe.
 *   2. permission denied      → muted BellOff; tap explains how to unblock.
 *   3. unsupported            → muted bell; tap explains (in-app webview →
 *      open in Chrome/Safari; iOS Safari tab → Add to Home Screen).
 *
 * NON-INLINE MODE (sidebar footer) keeps roomy, text-forward hints and may
 * render null only on a genuinely unsupported non-iOS desktop browser,
 * where there is nothing actionable to show in a sidebar.
 */
export default function EnablePushButton({ inline = false }: EnablePushButtonProps = {}) {
  const { supported, permission, isSubscribed, isBusy, enable, disable } =
    usePushNotifications();

  // ============================================================
  // INLINE special states — always a visible, tappable bell (never null).
  // ============================================================
  const mutedClasses =
    'gap-2 min-h-[44px] border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-500';

  // Unsupported: no Push API (in-app webview like WhatsApp/Instagram, or an
  // iOS Safari tab where Push requires an installed PWA).
  if (inline && !supported) {
    const message = isIOS()
      ? 'To get alerts on iPhone: tap the Share icon, choose "Add to Home Screen", then open SampleHub from the home-screen icon.'
      : 'Push notifications are not supported in this browser. Try opening the app in Chrome or Safari.';
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => toast.info(message)}
        aria-label="Push notifications unavailable"
        title="Push notifications unavailable"
        className={mutedClasses}
      >
        <Bell className="h-4 w-4" />
        <span className="hidden sm:inline">Alerts</span>
      </Button>
    );
  }

  // Denied: the user (or OS) blocked notifications — only browser settings
  // can undo it. Slashed, muted bell; tap says how.
  if (inline && permission === 'denied') {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          toast.error('Notifications are blocked. Please enable them in your browser settings.')
        }
        aria-label="Push notifications blocked"
        title="Push notifications blocked"
        className={mutedClasses}
      >
        <BellOff className="h-4 w-4" />
        <span className="hidden sm:inline">Blocked</span>
      </Button>
    );
  }

  // ============================================================
  // NON-INLINE special states — roomy hints (unchanged behaviour).
  // ============================================================
  if (!inline && !supported) {
    // iOS Safari tab: no Push API. Tell the user how to install instead.
    if (isIOS()) {
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

  if (!inline && permission === 'denied') {
    return (
      <p className="text-[11px] leading-tight text-slate-400 px-1 mb-3">
        Push notifications are blocked. Enable them in your browser site
        settings to receive new-request alerts.
      </p>
    );
  }

  // ============================================================
  // Shared normal state (supported + grantable), inline or sidebar.
  // ============================================================
  const layoutClasses = inline
    ? 'gap-2 min-h-[44px] border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
    : 'w-full gap-2 min-h-[44px] mb-3 border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900';

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={isSubscribed ? disable : enable}
      disabled={isBusy}
      aria-label={isSubscribed ? 'Disable push alerts' : 'Enable push alerts'}
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

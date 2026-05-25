import { Bell, BellOff, Loader2 } from 'lucide-react';
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
 * Opt-in control for PWA system push notifications. Renders nothing on
 * unsupported browsers; in sidebar mode it also renders a hint when
 * permission is denied, in inline mode it just hides.
 */
export default function EnablePushButton({ inline = false }: EnablePushButtonProps = {}) {
  const { supported, permission, isSubscribed, isBusy, enable, disable } =
    usePushNotifications();

  if (!supported) return null;

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

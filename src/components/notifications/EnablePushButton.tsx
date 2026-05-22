import { Bell, BellOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePushNotifications } from '@/hooks/usePushNotifications';

/**
 * Compact opt-in control for PWA system push notifications.
 * Designed to sit in the dashboard sidebar footer. Renders nothing
 * on unsupported browsers; shows a hint when permission is blocked.
 */
export default function EnablePushButton() {
  const { supported, permission, isSubscribed, isBusy, enable, disable } =
    usePushNotifications();

  if (!supported) return null;

  // The user blocked notifications — only the browser settings can undo this.
  if (permission === 'denied') {
    return (
      <p className="text-[11px] leading-tight text-slate-400 px-1 mb-3">
        Push notifications are blocked. Enable them in your browser site
        settings to receive new-request alerts.
      </p>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={isSubscribed ? disable : enable}
      disabled={isBusy}
      className="w-full gap-2 min-h-[44px] mb-3 border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
    >
      {isBusy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isSubscribed ? (
        <BellOff className="h-4 w-4" />
      ) : (
        <Bell className="h-4 w-4" />
      )}
      {isSubscribed ? 'Disable Push Alerts' : 'Enable Push Alerts'}
    </Button>
  );
}

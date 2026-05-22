import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import {
  isPushSupported,
  getPushSubscription,
  subscribeToPush,
  unsubscribeFromPush,
} from '@/lib/push';

interface UsePushNotificationsResult {
  /** Browser is capable of Web Push. */
  supported: boolean;
  /** Current Notification permission state. */
  permission: NotificationPermission;
  /** This browser currently has an active push subscription. */
  isSubscribed: boolean;
  /** A subscribe/unsubscribe call is in flight. */
  isBusy: boolean;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
}

/**
 * React wrapper around the Web Push helpers in `lib/push`. Tracks
 * support, permission, and subscription state, and exposes
 * enable/disable actions with toast feedback.
 */
export function usePushNotifications(): UsePushNotificationsResult {
  const { user } = useAuth();
  const supported = isPushSupported();

  const [permission, setPermission] = useState<NotificationPermission>(
    supported ? Notification.permission : 'denied'
  );
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  // Reflect the existing subscription state on mount.
  useEffect(() => {
    if (!supported) return;
    let cancelled = false;
    getPushSubscription()
      .then((sub) => {
        if (!cancelled) setIsSubscribed(!!sub);
      })
      .catch(() => {
        /* getSubscription failures just mean "not subscribed" */
      });
    return () => {
      cancelled = true;
    };
  }, [supported]);

  const enable = useCallback(async () => {
    if (!user || isBusy) return;
    setIsBusy(true);
    try {
      await subscribeToPush(user.id);
      setIsSubscribed(true);
      setPermission(Notification.permission);
      toast.success('Push notifications enabled');
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Could not enable notifications';
      setPermission(supported ? Notification.permission : 'denied');
      toast.error(message);
    } finally {
      setIsBusy(false);
    }
  }, [user, isBusy, supported]);

  const disable = useCallback(async () => {
    if (isBusy) return;
    setIsBusy(true);
    try {
      await unsubscribeFromPush();
      setIsSubscribed(false);
      toast.success('Push notifications disabled');
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Could not disable notifications';
      toast.error(message);
    } finally {
      setIsBusy(false);
    }
  }, [isBusy]);

  return { supported, permission, isSubscribed, isBusy, enable, disable };
}

import { useMakerNotifications } from '@/hooks/useMakerNotifications';

/**
 * Headless component that activates the global Realtime listener for
 * maker new-assignment toasts. Renders nothing — mount it once,
 * inside the router so its toast action can navigate.
 *
 * The hook itself is a no-op for any role other than `maker`, so
 * mounting it unconditionally alongside the other notification
 * components is safe — only makers will actually open a channel.
 */
export default function MakerNotifications() {
  useMakerNotifications();
  return null;
}

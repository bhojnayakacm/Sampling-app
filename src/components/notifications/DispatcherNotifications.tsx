import { useDispatcherNotifications } from '@/hooks/useDispatcherNotifications';

/**
 * Headless component that activates the global Realtime listener for
 * dispatcher ready-for-dispatch toasts. Renders nothing — mount it
 * once, inside the router so its toast action can navigate.
 *
 * The hook itself is a no-op for any role other than `dispatcher`,
 * so mounting it unconditionally alongside the other notification
 * components is safe — only dispatchers will actually open a channel.
 */
export default function DispatcherNotifications() {
  useDispatcherNotifications();
  return null;
}

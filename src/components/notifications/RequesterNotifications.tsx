import { useRequesterNotifications } from '@/hooks/useRequesterNotifications';

/**
 * Headless component that activates the global Realtime listener for
 * requester status-change toasts. Renders nothing — mount it once,
 * inside the router so its toast actions can navigate.
 *
 * The hook itself is a no-op for any role other than `requester`, so
 * mounting it unconditionally alongside `<RequestNotifications />` is
 * safe — only requesters will actually open a Realtime channel.
 */
export default function RequesterNotifications() {
  useRequesterNotifications();
  return null;
}

import { useRequestNotifications } from '@/hooks/useRequestNotifications';

/**
 * Headless component that activates the global Realtime listener for
 * new-request toasts. Renders nothing — mount it once, inside the
 * router so its toast actions can navigate.
 */
export default function RequestNotifications() {
  useRequestNotifications();
  return null;
}

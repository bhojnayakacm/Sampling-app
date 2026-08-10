/**
 * "What's New" announcements.
 *
 * HOW IT WORKS
 *   • Each release adds one entry to ANNOUNCEMENTS with a NEW, never-reused
 *     `id`. The id IS the update-version key.
 *   • The dialog shows the newest entry (last in the array) that the current
 *     user's role is targeted by and that they haven't dismissed yet.
 *   • Dismissal is recorded in localStorage under a PER-USER key, so the
 *     popup appears exactly once per user per update — and a second user on
 *     a shared browser/kiosk still gets their own showing.
 *
 * ADDING THE NEXT ANNOUNCEMENT
 *   Append a new object. Do not edit an existing `id` after release: users
 *   who already dismissed it would be shown the new copy again (and users
 *   who haven't would never see the old one).
 */

import type { UserRole } from '@/types';

export interface Announcement {
  /** Stable, unique update key. Never reuse or rename after shipping. */
  id: string;
  /** Dialog heading. */
  title: string;
  /** Short line under the title. */
  subtitle?: string;
  /** Body paragraphs, rendered in order. */
  body: string[];
  /** Roles that should see this announcement. */
  roles: UserRole[];
  /** Label for the dismiss button. */
  ctaLabel?: string;
}

export const ANNOUNCEMENTS: Announcement[] = [
  {
    id: '2026-08-multi-image-upload',
    title: "What's New",
    subtitle: 'Multiple reference images per quality',
    body: [
      'You can now upload multiple images for specific qualities! When requesting a batch, you will see separate upload slots for each quality, and you can attach multiple photos per slot.',
    ],
    roles: ['requester'],
    ctaLabel: 'Got it',
  },
];

/** localStorage key holding the dismissed announcement ids for one user. */
function storageKey(userId: string): string {
  return `whatsNewSeen:${userId}`;
}

/** Ids this user has already dismissed. Never throws — storage may be blocked. */
export function getSeenAnnouncements(userId: string): string[] {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    // Corrupt JSON or storage disabled (private mode / blocked cookies).
    // Treat as "nothing seen" rather than breaking the dashboard.
    return [];
  }
}

/** Record a dismissal. Silently no-ops when storage is unavailable. */
export function markAnnouncementSeen(userId: string, announcementId: string): void {
  try {
    const seen = getSeenAnnouncements(userId);
    if (seen.includes(announcementId)) return;
    localStorage.setItem(storageKey(userId), JSON.stringify([...seen, announcementId]));
  } catch {
    // Worst case the popup reappears next visit — acceptable, never fatal.
  }
}

/**
 * Newest announcement this user should see, or null when they're up to date.
 * Iterates from the end so the latest relevant update wins; a user who was
 * away for several releases sees only the most recent one rather than a
 * stack of dialogs.
 */
export function getPendingAnnouncement(
  userId: string | undefined,
  role: UserRole | undefined,
): Announcement | null {
  if (!userId || !role) return null;

  const seen = getSeenAnnouncements(userId);
  for (let i = ANNOUNCEMENTS.length - 1; i >= 0; i--) {
    const announcement = ANNOUNCEMENTS[i];
    if (announcement.roles.includes(role) && !seen.includes(announcement.id)) {
      return announcement;
    }
  }
  return null;
}

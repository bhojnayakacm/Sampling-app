import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  getPendingAnnouncement,
  markAnnouncementSeen,
  type Announcement,
} from '@/lib/announcements';

/**
 * One-time "What's New" popup.
 *
 * Mount it on a dashboard; it resolves the newest announcement the signed-in
 * user's role hasn't dismissed and shows it once. Renders nothing when the
 * user is up to date, so mounting it is free.
 *
 * The lookup runs in an effect (not during render) because it touches
 * localStorage — keeping render pure and avoiding a hydration-style flash
 * for users who have already dismissed the current update.
 */
export default function WhatsNewDialog() {
  const { profile } = useAuth();
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const pending = getPendingAnnouncement(profile?.id, profile?.role);
    if (pending) {
      setAnnouncement(pending);
      setOpen(true);
    }
  }, [profile?.id, profile?.role]);

  // Mark as seen on ANY dismissal — button, overlay click, or Esc — so the
  // popup can't nag a user who closed it without pressing the CTA.
  const handleOpenChange = (next: boolean) => {
    if (!next && announcement && profile?.id) {
      markAnnouncementSeen(profile.id, announcement.id);
    }
    setOpen(next);
  };

  if (!announcement) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
              <Sparkles className="h-5 w-5 text-indigo-600" />
            </div>
            <div className="min-w-0 text-left">
              <DialogTitle className="text-lg">{announcement.title}</DialogTitle>
              {announcement.subtitle && (
                <DialogDescription className="mt-0.5">
                  {announcement.subtitle}
                </DialogDescription>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 pt-1">
          {announcement.body.map((paragraph, i) => (
            <p key={i} className="text-sm leading-relaxed text-slate-600">
              {paragraph}
            </p>
          ))}
        </div>

        <DialogFooter>
          <Button
            type="button"
            onClick={() => handleOpenChange(false)}
            className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 min-h-[44px]"
          >
            {announcement.ctaLabel ?? 'Got it'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

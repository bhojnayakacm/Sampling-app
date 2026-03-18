import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Bookmark, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useCreateTemplate } from '@/lib/api/templates';
import { useAuth } from '@/contexts/AuthContext';
import type { ProductItem } from '@/types';
import { groupTemplateItems, type TemplateGroup } from '@/lib/templateGrouping';

interface SaveTemplateDialogProps {
  products: ProductItem[];
  disabled?: boolean;
}

export function SaveTemplateDialog({ products, disabled }: SaveTemplateDialogProps) {
  const [open, setOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const { profile } = useAuth();
  const createTemplate = useCreateTemplate();

  // Count valid items (those with at least a category selected)
  const validItemCount = products.filter((p) => p.category).length;

  const handleSave = async () => {
    if (!profile?.id) {
      toast.error('You must be logged in to save templates');
      return;
    }

    if (!templateName.trim()) {
      toast.error('Please enter a template name');
      return;
    }

    if (validItemCount === 0) {
      toast.error('Add at least one item before saving');
      return;
    }

    try {
      const validProducts = products.filter((p) => p.category);

      await createTemplate.mutateAsync({
        userId: profile.id,
        input: {
          template_name: templateName.trim(),
          items: validProducts,
        },
      });

      toast.success(
        <div>
          <p className="font-semibold">Template saved!</p>
          <p className="text-sm">"{templateName}" with {validProducts.length} item{validProducts.length !== 1 ? 's' : ''}</p>
        </div>
      );

      setTemplateName('');
      setOpen(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to save template');
    }
  };

  const groups = groupTemplateItems(products.filter((p) => p.category));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || validItemCount === 0}
          className="gap-2 text-indigo-600 border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300"
        >
          <Bookmark className="h-4 w-4" />
          <span className="hidden sm:inline">Save as Template</span>
          <span className="sm:hidden">Save</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-indigo-100 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-indigo-600" />
            </div>
            Save as Template
          </DialogTitle>
          <DialogDescription>
            Save your current item list for quick reuse in future requests.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="space-y-4">
            {/* Template Name Input */}
            <div className="space-y-2">
              <Label htmlFor="template-name" className="text-slate-700 font-semibold">
                Template Name *
              </Label>
              <Input
                id="template-name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g., Standard Kitchen Set, White Marbles..."
                className="h-11"
                autoFocus
              />
            </div>

            {/* Grouped preview of what will be saved */}
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
              <p className="text-sm font-medium text-slate-700 mb-2">Will save:</p>
              <TemplateGroupList groups={groups} />
            </div>

            <p className="text-xs text-slate-500">
              Note: Images are not saved in templates. Only item specifications are stored.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={createTemplate.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={createTemplate.isPending || !templateName.trim()}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {createTemplate.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Bookmark className="h-4 w-4 mr-2" />
                Save Template
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Shared grouped rendering component
// ============================================================

export function TemplateGroupList({ groups }: { groups: TemplateGroup[] }) {
  if (groups.length === 0) {
    return <p className="text-xs text-slate-400 italic">No items</p>;
  }

  return (
    <div className="space-y-1.5">
      {groups.map((group) => (
        <div key={group.label} className="flex items-baseline gap-1.5 text-sm leading-snug">
          <span className={`font-semibold shrink-0 ${group.isKit ? 'text-amber-700' : 'text-indigo-700'}`}>
            {group.label}:
          </span>
          <span className="text-slate-500 text-xs">
            {group.qualities.join(', ')}
          </span>
        </div>
      ))}
    </div>
  );
}

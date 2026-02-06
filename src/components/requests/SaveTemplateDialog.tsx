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

interface SaveTemplateDialogProps {
  products: ProductItem[];
  disabled?: boolean;
}

export function SaveTemplateDialog({ products, disabled }: SaveTemplateDialogProps) {
  const [open, setOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const { profile } = useAuth();
  const createTemplate = useCreateTemplate();

  // Count valid products (those with at least product type selected)
  const validProductCount = products.filter((p) => p.product_type).length;

  const handleSave = async () => {
    if (!profile?.id) {
      toast.error('You must be logged in to save templates');
      return;
    }

    if (!templateName.trim()) {
      toast.error('Please enter a template name');
      return;
    }

    if (validProductCount === 0) {
      toast.error('Add at least one product before saving');
      return;
    }

    try {
      // Only save products that have a product type selected
      const validProducts = products.filter((p) => p.product_type);

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
          <p className="text-sm">"{templateName}" with {validProducts.length} product{validProducts.length !== 1 ? 's' : ''}</p>
        </div>
      );

      setTemplateName('');
      setOpen(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to save template');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || validProductCount === 0}
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
            Save your current product list for quick reuse in future requests.
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

            {/* Preview of what will be saved */}
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
              <p className="text-sm font-medium text-slate-700 mb-2">Will save:</p>
              <div className="space-y-1">
                {products.filter((p) => p.product_type).slice(0, 3).map((product, index) => {
                  const qualityCount = product.selected_qualities?.length || (product.quality ? 1 : 0);
                  return (
                    <div key={index} className="flex items-center gap-2 text-sm text-slate-600">
                      <span className="h-5 w-5 rounded bg-indigo-100 text-indigo-600 text-xs flex items-center justify-center font-medium">
                        {index + 1}
                      </span>
                      <span className="capitalize">{product.product_type.replace('_', ' ')}</span>
                      {qualityCount > 0 && (
                        <span className="text-xs text-slate-400">
                          ({qualityCount} {qualityCount === 1 ? 'quality' : 'qualities'})
                        </span>
                      )}
                    </div>
                  );
                })}
                {validProductCount > 3 && (
                  <p className="text-xs text-slate-500 pl-7">
                    +{validProductCount - 3} more product{validProductCount - 3 !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </div>

            <p className="text-xs text-slate-500">
              Note: Images are not saved in templates. Only product specifications are stored.
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

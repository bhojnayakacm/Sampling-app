import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FolderOpen, Loader2, Trash2, Plus, Replace, AlertCircle, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useTemplates, useDeleteTemplate, type ProductTemplate } from '@/lib/api/templates';
import type { ProductItem } from '@/types';
import { cn } from '@/lib/utils';
import { TemplateDrawerSkeleton } from '@/components/skeletons';
import { groupProductTemplateItems } from '@/lib/templateGrouping';
import { TemplateGroupList } from '@/components/requests/SaveTemplateDialog';

// ============================================================
// TYPES
// ============================================================

interface LoadTemplateDrawerProps {
  onLoadTemplate: (items: ProductItem[], mode: 'append' | 'replace') => void;
  hasExistingProducts: boolean;
}

// ============================================================
// HELPER: Generate new IDs for loaded items
// ============================================================

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

function hydrateTemplateItems(items: ProductTemplate['items']): ProductItem[] {
  // Thickness fields removed in 2026-06 refactor — `...item` may carry stale
  // `thickness` / `thickness_custom` keys from legacy templates; that is
  // fine, they're ignored by ProductItemCard and never re-saved.
  return items.map((item) => ({
    ...item,
    id: generateId(),
    category: item.category || '',
    sub_category: item.sub_category || '',
    selected_qualities: item.selected_qualities || [],
    quality: item.quality || '',
    sample_size_custom: item.sample_size_custom || '',
    finish_custom: item.finish_custom || '',
    is_kit: item.is_kit || false,
    image_file: null,
    image_preview: null,
    image_url: null,
  }));
}

// ============================================================
// TEMPLATE CARD COMPONENT
// ============================================================

interface TemplateCardProps {
  template: ProductTemplate;
  onSelect: (template: ProductTemplate) => void;
  onDelete: (templateId: string) => void;
  isDeleting: boolean;
}

function TemplateCard({ template, onSelect, onDelete, isDeleting }: TemplateCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const groups = groupProductTemplateItems(template);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirmDelete) {
      onDelete(template.id);
      setConfirmDelete(false);
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  };

  return (
    <div
      className={cn(
        'group relative border rounded-lg p-4 cursor-pointer transition-all',
        'hover:border-indigo-300 hover:bg-indigo-50/50 hover:shadow-sm',
        'border-slate-200 bg-white'
      )}
      onClick={() => onSelect(template)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-slate-800 truncate">{template.template_name}</h4>
          <p className="text-xs text-slate-400 mt-1">
            Saved {new Date(template.created_at).toLocaleDateString()}
          </p>
        </div>

        {/* Delete button */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          disabled={isDeleting}
          className={cn(
            'shrink-0 transition-colors',
            confirmDelete
              ? 'text-red-600 hover:text-red-700 hover:bg-red-50'
              : 'text-slate-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100'
          )}
        >
          {isDeleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : confirmDelete ? (
            <span className="text-xs font-medium">Confirm?</span>
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Grouped content preview */}
      <div className="mt-2.5">
        <TemplateGroupList groups={groups} />
      </div>
    </div>
  );
}

// ============================================================
// LOAD MODE SELECTOR
// ============================================================

interface LoadModeSelectorProps {
  template: ProductTemplate;
  hasExistingProducts: boolean;
  onConfirm: (mode: 'append' | 'replace') => void;
  onBack: () => void;
}

function LoadModeSelector({ template, hasExistingProducts, onConfirm, onBack }: LoadModeSelectorProps) {
  const groups = groupProductTemplateItems(template);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 pb-4 border-b">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-slate-500">
          &larr; Back
        </Button>
        <div className="flex-1">
          <h4 className="font-semibold text-slate-800">{template.template_name}</h4>
          <p className="text-xs text-slate-500">{template.items.length} item{template.items.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Grouped preview */}
      <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
        <TemplateGroupList groups={groups} />
      </div>

      <div className="space-y-3">
        {hasExistingProducts && (
          <button
            type="button"
            onClick={() => onConfirm('append')}
            className="w-full p-4 border rounded-lg text-left hover:border-indigo-300 hover:bg-indigo-50/50 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <Plus className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-800 group-hover:text-indigo-700">
                  Append to List
                </p>
                <p className="text-sm text-slate-500">
                  Add these items to your existing list
                </p>
              </div>
            </div>
          </button>
        )}

        <button
          type="button"
          onClick={() => onConfirm('replace')}
          className="w-full p-4 border rounded-lg text-left hover:border-indigo-300 hover:bg-indigo-50/50 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <Replace className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="font-semibold text-slate-800 group-hover:text-indigo-700">
                {hasExistingProducts ? 'Replace List' : 'Load Template'}
              </p>
              <p className="text-sm text-slate-500">
                {hasExistingProducts
                  ? 'Remove current items and use template only'
                  : 'Start with these items'
                }
              </p>
            </div>
          </div>
        </button>
      </div>

      {hasExistingProducts && (
        <p className="text-xs text-amber-600 flex items-start gap-1.5 bg-amber-50 p-2 rounded">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          "Replace" will remove your current items. This cannot be undone.
        </p>
      )}
    </div>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export function LoadTemplateDrawer({ onLoadTemplate, hasExistingProducts }: LoadTemplateDrawerProps) {
  const [open, setOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ProductTemplate | null>(null);
  const { data: templates, isLoading, error } = useTemplates();
  const deleteTemplate = useDeleteTemplate();

  const handleSelect = (template: ProductTemplate) => {
    if (!hasExistingProducts) {
      handleConfirmLoad(template, 'replace');
    } else {
      setSelectedTemplate(template);
    }
  };

  const handleConfirmLoad = (template: ProductTemplate, mode: 'append' | 'replace') => {
    const hydratedItems = hydrateTemplateItems(template.items);
    onLoadTemplate(hydratedItems, mode);

    toast.success(
      <div>
        <p className="font-semibold">Template loaded!</p>
        <p className="text-sm">
          {mode === 'append' ? 'Added' : 'Loaded'} {hydratedItems.length} item{hydratedItems.length !== 1 ? 's' : ''} from "{template.template_name}"
        </p>
      </div>
    );

    setSelectedTemplate(null);
    setOpen(false);
  };

  const handleDelete = async (templateId: string) => {
    try {
      await deleteTemplate.mutateAsync(templateId);
      toast.success('Template deleted');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete template');
    }
  };

  const hasTemplates = templates && templates.length > 0;

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      setOpen(newOpen);
      if (!newOpen) setSelectedTemplate(null);
    }}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="gap-2 border-dashed border-2 border-indigo-300 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-400"
        >
          <FolderOpen className="h-4 w-4" />
          Load from Bucket
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[480px] max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-indigo-100 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-indigo-600" />
            </div>
            {selectedTemplate ? 'Load Template' : 'Your Saved Buckets'}
          </DialogTitle>
          <DialogDescription>
            {selectedTemplate
              ? 'Choose how to load this template'
              : 'Select a saved template to quickly add items'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 -mx-6 px-6">
          {selectedTemplate ? (
            <LoadModeSelector
              template={selectedTemplate}
              hasExistingProducts={hasExistingProducts}
              onConfirm={(mode) => handleConfirmLoad(selectedTemplate, mode)}
              onBack={() => setSelectedTemplate(null)}
            />
          ) : isLoading ? (
            <TemplateDrawerSkeleton />
          ) : error ? (
            <div className="text-center py-12">
              <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
              <p className="text-sm text-red-600">Failed to load templates</p>
            </div>
          ) : !hasTemplates ? (
            <div className="text-center py-12">
              <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <FolderOpen className="h-8 w-8 text-slate-400" />
              </div>
              <h4 className="font-semibold text-slate-700 mb-2">No Templates Yet</h4>
              <p className="text-sm text-slate-500 max-w-[280px] mx-auto">
                Create your first template by adding items and clicking "Save as Template" in the form.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {templates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onSelect={handleSelect}
                  onDelete={handleDelete}
                  isDeleting={deleteTemplate.isPending}
                />
              ))}
            </div>
          )}
        </div>

        {!selectedTemplate && hasTemplates && (
          <div className="pt-4 border-t text-xs text-slate-500 text-center">
            Click a template to load it. Hover to delete.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

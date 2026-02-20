import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { ProductItem } from '@/types';

// ============================================================
// TYPES
// ============================================================

export interface ProductTemplate {
  id: string;
  user_id: string;
  template_name: string;
  items: ProductItem[];
  created_at: string;
  updated_at: string;
}

export interface CreateTemplateInput {
  template_name: string;
  items: ProductItem[];
}

// ============================================================
// API FUNCTIONS
// ============================================================

/**
 * Fetch all templates for the current user
 */
export async function fetchTemplates(): Promise<ProductTemplate[]> {
  const { data, error } = await supabase
    .from('product_templates')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching templates:', error);
    throw new Error(error.message);
  }

  return data || [];
}

/**
 * Create a new template
 */
export async function createTemplate(
  userId: string,
  input: CreateTemplateInput
): Promise<ProductTemplate> {
  // Clean the items before saving (remove file objects, previews, etc.)
  const cleanedItems = input.items.map((item) => ({
    product_type: item.product_type,
    selected_qualities: item.selected_qualities || [],
    quality: item.quality || '',
    sample_size: item.sample_size,
    sample_size_custom: item.sample_size_custom || '',
    thickness: item.thickness,
    thickness_custom: item.thickness_custom || '',
    finish: item.finish || '',
    finish_custom: item.finish_custom || '',
    quantity: item.quantity,
    // Don't save image data - templates are for specs only
  }));

  const { data, error } = await supabase
    .from('product_templates')
    .insert({
      user_id: userId,
      template_name: input.template_name.trim(),
      items: cleanedItems,
    })
    .select()
    .single();

  if (error) {
    // Handle unique constraint violation
    if (error.code === '23505') {
      throw new Error('A template with this name already exists. Please choose a different name.');
    }
    console.error('Error creating template:', error);
    throw new Error(error.message);
  }

  return data;
}

/**
 * Update an existing template
 */
export async function updateTemplate(
  templateId: string,
  input: Partial<CreateTemplateInput>
): Promise<ProductTemplate> {
  const updateData: Record<string, unknown> = {};

  if (input.template_name) {
    updateData.template_name = input.template_name.trim();
  }

  if (input.items) {
    // Clean the items before saving
    updateData.items = input.items.map((item) => ({
      product_type: item.product_type,
      selected_qualities: item.selected_qualities || [],
      quality: item.quality || '',
      sample_size: item.sample_size,
      sample_size_custom: item.sample_size_custom || '',
      thickness: item.thickness,
      thickness_custom: item.thickness_custom || '',
      finish: item.finish || '',
      finish_custom: item.finish_custom || '',
      quantity: item.quantity,
    }));
  }

  const { data, error } = await supabase
    .from('product_templates')
    .update(updateData)
    .eq('id', templateId)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('A template with this name already exists.');
    }
    console.error('Error updating template:', error);
    throw new Error(error.message);
  }

  return data;
}

/**
 * Delete a template
 */
export async function deleteTemplate(templateId: string): Promise<void> {
  const { error } = await supabase
    .from('product_templates')
    .delete()
    .eq('id', templateId);

  if (error) {
    console.error('Error deleting template:', error);
    throw new Error(error.message);
  }
}

// ============================================================
// REACT QUERY HOOKS
// ============================================================

/**
 * Hook to fetch user's templates
 */
export function useTemplates() {
  return useQuery({
    queryKey: ['product-templates'],
    queryFn: fetchTemplates,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to create a new template
 */
export function useCreateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, input }: { userId: string; input: CreateTemplateInput }) =>
      createTemplate(userId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-templates'] });
    },
  });
}

/**
 * Hook to update a template
 */
export function useUpdateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ templateId, input }: { templateId: string; input: Partial<CreateTemplateInput> }) =>
      updateTemplate(templateId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-templates'] });
    },
  });
}

/**
 * Hook to delete a template
 */
export function useDeleteTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-templates'] });
    },
  });
}

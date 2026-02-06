-- ============================================================
-- MIGRATION: Product Templates (Bucket Lists)
-- Description: Allows users to save and reuse groups of products
-- ============================================================

-- ============================================================
-- CREATE TABLE: product_templates
-- ============================================================

CREATE TABLE IF NOT EXISTS public.product_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  template_name TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure template names are unique per user
  CONSTRAINT unique_template_name_per_user UNIQUE (user_id, template_name)
);

-- Add comment for documentation
COMMENT ON TABLE public.product_templates IS
'Stores user-created product templates (bucket lists) for quick reuse in sample requests.
Each template contains an array of product items with their specifications.';

COMMENT ON COLUMN public.product_templates.items IS
'JSONB array of product objects matching the ProductItem interface:
[{product_type, selected_qualities, quality_custom, use_custom_quality, sample_size, thickness, finish, quantity, ...}]';

-- ============================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.product_templates ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES: Users can only access their own templates
-- ============================================================

-- Policy: Users can view their own templates
CREATE POLICY "Users can view own templates"
  ON public.product_templates
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Policy: Users can create their own templates
CREATE POLICY "Users can create own templates"
  ON public.product_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Policy: Users can update their own templates
CREATE POLICY "Users can update own templates"
  ON public.product_templates
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Policy: Users can delete their own templates
CREATE POLICY "Users can delete own templates"
  ON public.product_templates
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ============================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================

CREATE INDEX idx_product_templates_user_id ON public.product_templates(user_id);
CREATE INDEX idx_product_templates_created_at ON public.product_templates(created_at DESC);

-- ============================================================
-- TRIGGER: Auto-update updated_at timestamp
-- ============================================================

CREATE TRIGGER update_product_templates_updated_at
  BEFORE UPDATE ON public.product_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================

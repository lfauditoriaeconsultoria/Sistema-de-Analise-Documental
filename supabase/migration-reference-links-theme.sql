-- Add theme/subtopic/OEA columns to reference_links
ALTER TABLE public.reference_links
  ADD COLUMN IF NOT EXISTS theme_id uuid REFERENCES public.themes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subtopic_id uuid REFERENCES public.subtopics(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS oea_criteria_id uuid REFERENCES public.oea_criteria(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS oea_item_id uuid REFERENCES public.oea_items(id) ON DELETE SET NULL;

-- Indexes for filtering
CREATE INDEX IF NOT EXISTS reference_links_theme_id_idx ON public.reference_links(theme_id);
CREATE INDEX IF NOT EXISTS reference_links_subtopic_id_idx ON public.reference_links(subtopic_id);

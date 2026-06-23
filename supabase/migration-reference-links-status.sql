-- Add fetch status tracking columns to reference_links
ALTER TABLE public.reference_links
  ADD COLUMN IF NOT EXISTS fetch_status text NOT NULL DEFAULT 'pending'
    CHECK (fetch_status IN ('pending', 'success', 'failed')),
  ADD COLUMN IF NOT EXISTS last_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS fetch_error text;

-- Backfill: links that already have content are 'success', those without are 'failed'
UPDATE public.reference_links
  SET fetch_status = CASE WHEN content IS NOT NULL THEN 'success' ELSE 'failed' END,
      last_checked_at = created_at
  WHERE last_checked_at IS NULL;

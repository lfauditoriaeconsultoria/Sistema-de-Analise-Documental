-- ============================================================
-- LF Auditoria - Migration: adiciona coluna qualificador em oea_items
-- Baseado na regra linguística do Anexo II da Portaria Coana nº 154/2024:
--   "O OEA deve..." / "...devem..." → Obrigatório
--   "Recomenda-se que..."          → Recomendável
-- Execute no SQL Editor do Supabase
-- ============================================================

-- 1. Adiciona a coluna com constraint e default Obrigatório
ALTER TABLE public.oea_items
  ADD COLUMN IF NOT EXISTS qualificador text
    NOT NULL
    DEFAULT 'Obrigatório'
    CHECK (qualificador IN ('Obrigatório', 'Recomendável'));

-- 2. Atualiza os itens cujo texto indica "Recomendável":
--    - Descrição começa com "Recomenda-se" (caso mais comum)
--    - Descrição tem ", recomenda-se" após condição inicial
--      (ex: "Em caso de..., recomenda-se..." ou "Caso sistemas de câmeras..., recomenda-se...")
UPDATE public.oea_items
SET qualificador = 'Recomendável'
WHERE description ILIKE 'Recomenda-se%'
   OR description ILIKE '%, recomenda-se%';

-- 3. Verificação: lista todos os itens com qualificador para conferência
SELECT
  oi.item_number,
  oc.name         AS criterio,
  oi.qualificador,
  LEFT(oi.description, 80) AS descricao_inicio
FROM public.oea_items oi
JOIN public.oea_criteria oc ON oc.id = oi.criteria_id
ORDER BY oc.number, oi.item_number;

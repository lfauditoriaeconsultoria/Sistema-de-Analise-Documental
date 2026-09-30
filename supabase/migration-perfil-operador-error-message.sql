-- ============================================================
-- LF Auditoria - Migration Perfil Operador: coluna de erro por item
-- Execute no SQL Editor do Supabase (depois de migration-perfil-operador.sql)
-- ============================================================
-- Até agora, quando a geração de um item falhava (erro da API, sem crédito,
-- sobrecarga etc.), o item ficava marcado como "erro" mas o motivo era
-- descartado — o usuário só via um ícone vermelho sem explicação. Esta coluna
-- guarda a mensagem legível para exibição na aba Revisar.

ALTER TABLE public.perfil_operador_items
  ADD COLUMN IF NOT EXISTS error_message text;

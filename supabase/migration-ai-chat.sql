-- Tabela de conversas do Consultor IA
CREATE TABLE IF NOT EXISTS ai_chat_conversations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL DEFAULT 'Nova conversa',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_chat_conversations_user_id
  ON ai_chat_conversations(user_id);

CREATE INDEX IF NOT EXISTS idx_ai_chat_conversations_updated_at
  ON ai_chat_conversations(updated_at DESC);

ALTER TABLE ai_chat_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own ai conversations"
  ON ai_chat_conversations FOR ALL
  USING (auth.uid() = user_id);

-- Tabela de mensagens do Consultor IA
CREATE TABLE IF NOT EXISTS ai_chat_messages (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id     UUID NOT NULL REFERENCES ai_chat_conversations(id) ON DELETE CASCADE,
  role                TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content             TEXT NOT NULL,
  attachments         JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_conversation_id
  ON ai_chat_messages(conversation_id);

ALTER TABLE ai_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage messages in own ai conversations"
  ON ai_chat_messages FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM ai_chat_conversations c
      WHERE c.id = ai_chat_messages.conversation_id
        AND c.user_id = auth.uid()
    )
  );

-- Trigger: atualiza updated_at na conversa quando nova mensagem é inserida
CREATE OR REPLACE FUNCTION update_ai_conversation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE ai_chat_conversations
  SET updated_at = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_ai_conversation ON ai_chat_messages;
CREATE TRIGGER trg_update_ai_conversation
  AFTER INSERT ON ai_chat_messages
  FOR EACH ROW EXECUTE FUNCTION update_ai_conversation_updated_at();

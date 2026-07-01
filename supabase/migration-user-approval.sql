-- Adiciona campo status na tabela profiles
-- Usuários existentes ficam 'active'; novos cadastros ficam 'pending'
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- Atualiza o trigger para que novos registros iniciem como 'pending'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, status)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    'colaborador',
    'pending'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

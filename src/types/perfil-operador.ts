export type PerfilOperadorStatus = 'rascunho' | 'documentos' | 'gerando' | 'revisao' | 'concluido'
export type PerfilOperadorItemStatus = 'pendente' | 'gerado' | 'erro'
export type PerfilOperadorDocTipo = 'politica' | 'evidencia'

export interface PerfilOperadorElaboration {
  id: string
  user_id: string
  cliente: string
  status: PerfilOperadorStatus
  created_at: string
  updated_at: string
}

export interface PerfilOperadorItem {
  id: string
  elaboration_id: string
  criteria_number: number
  criteria_name: string
  oea_item_id: string | null
  item_number: string
  item_description: string
  resposta: string
  pendencias: string[]
  status: PerfilOperadorItemStatus
  error_message: string | null
  manually_edited: boolean
  generated_at: string | null
  created_at: string
  updated_at: string
  /** Preenchido pelo GET de elaboração — ids dos documentos vinculados a este item */
  document_ids?: string[]
}

export interface PerfilOperadorDocument {
  id: string
  elaboration_id: string
  tipo: PerfilOperadorDocTipo
  filename: string
  file_path: string
  file_size: number | null
  content_text: string | null
  created_at: string
  /** Preenchido pelo GET de elaboração — ids dos itens que usam este documento */
  item_ids?: string[]
}

export interface PerfilOperadorElaborationFull extends PerfilOperadorElaboration {
  items: PerfilOperadorItem[]
  documents: PerfilOperadorDocument[]
}

/** Item selecionado no passo 1 (critério + item), antes de existir no banco */
export interface SelectedOeaItem {
  criteria_number: number
  criteria_name: string
  oea_item_id: string
  item_number: string
  item_description: string
}

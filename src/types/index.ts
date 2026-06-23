export type UserRole = 'admin' | 'colaborador'

export type OeaCategory = 'geral' | 'seguranca' | 'conformidade'

export interface OeaItem {
  id: string
  criteria_id: string
  item_number: string
  description: string
  created_at: string
}

export interface OeaCriteria {
  id: string
  number: number
  name: string
  description: string | null
  category: OeaCategory
  created_at: string
  items?: OeaItem[]
}

export interface Profile {
  id: string
  full_name: string | null
  role: UserRole
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface Theme {
  id: string
  name: string
  description: string | null
  color: string
  icon: string | null
  is_active: boolean
  created_at: string
}

export interface Subtopic {
  id: string
  theme_id: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
}

export interface ReferenceDocument {
  id: string
  theme_id: string
  subtopic_id: string | null
  oea_criteria_id: string | null
  oea_item_id: string | null
  name: string
  version: string | null
  description: string | null
  file_path: string | null
  file_type: string | null
  file_size: number | null
  content: string | null
  uploaded_by: string | null
  created_at: string
  updated_at: string
  theme?: Theme
  subtopic?: Subtopic
  oea_criteria?: OeaCriteria
  oea_item?: OeaItem
}

export type LinkFetchStatus = 'pending' | 'success' | 'failed'

export interface ReferenceLink {
  id: string
  name: string
  url: string
  description: string | null
  theme_id: string | null
  subtopic_id: string | null
  oea_criteria_id: string | null
  oea_item_id: string | null
  fetch_status: LinkFetchStatus
  last_checked_at: string | null
  fetch_error: string | null
  created_at: string
  updated_at: string
  theme?: { name: string } | null
  subtopic?: { name: string } | null
  oea_criteria?: { number: number; name: string } | null
  oea_item?: { item_number: string } | null
}

export type AnalysisStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface Analysis {
  id: string
  user_id: string
  theme_id: string
  subtopic_id: string | null
  oea_criteria_id: string | null
  oea_item_id: string | null
  client_name: string | null
  document_name: string
  document_path: string | null
  document_type: string | null
  document_content: string | null
  status: AnalysisStatus
  error_message: string | null
  custom_theme_name: string | null
  custom_subtopic_name: string | null
  created_at: string
  updated_at: string
  theme?: Theme
  subtopic?: Subtopic
  oea_criteria?: OeaCriteria
  oea_item?: OeaItem
  report?: Report
  user?: Profile
}

export interface ReferencePrompt {
  id: string
  theme_id: string | null
  subtopic_id: string | null
  oea_criteria_id: string | null
  oea_item_id: string | null
  title: string
  content: string
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
  theme?: Theme
  subtopic?: Subtopic
  oea_criteria?: OeaCriteria
  oea_item?: OeaItem
}

export type ComplianceLevel = 'conforme' | 'parcialmente_conforme' | 'nao_conforme'

export interface CompliancePoint {
  item: string
  description: string
  reference?: string
}

export interface ImprovementSuggestion {
  priority: 'alta' | 'media' | 'baixa'
  item: string
  suggestion: string
  reference?: string
}

export interface PromptResponse {
  prompt: string
  response: string
}

export interface Report {
  id: string
  analysis_id: string
  overall_compliance: ComplianceLevel | null
  compliance_score: number | null
  summary: string | null
  criteria_used: string | null
  prompt_responses: PromptResponse[]
  conforming_points: CompliancePoint[]
  partial_points: CompliancePoint[]
  non_conforming_points: CompliancePoint[]
  improvement_suggestions: ImprovementSuggestion[]
  conclusion: string | null
  raw_analysis: string | null
  created_at: string
}

export interface ChatMessage {
  id: string
  analysis_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface DashboardStats {
  total_analyses: number
  completed_analyses: number
  pending_analyses: number
  conformity_rate: number
}

export interface AiChatConversation {
  id: string
  user_id: string
  title: string
  created_at: string
  updated_at: string
}

export interface AiChatAttachmentMeta {
  name: string
  type: 'text' | 'image'
  mediaType?: string
  hasContent: boolean
}

export interface AiChatMessage {
  id: string
  conversation_id: string
  role: 'user' | 'assistant'
  content: string
  attachments: AiChatAttachmentMeta[]
  created_at: string
}

export interface TeamMember {
  id: string
  email: string
  display_name: string
  role: string
  position?: string
  avatar_url?: string
  phone?: string
  start_date?: string
  status?: string
  created_at?: string
}

export interface DailyNote {
  id: string
  intern_id: string
  note_date: string
  content: string
  focus_areas: string[]
  submitted_at: string
  manager_reply?: string
}

export interface Lead {
  id: string
  intern_id: string
  contact: string
  company: string
  email: string
  phone: string
  description: string
  priority: 'low' | 'medium' | 'high'
  status: 'new' | 'contacted' | 'qualified' | 'proposal' | 'closed_won' | 'closed_lost'
  amount?: number
  needs_follow_up: boolean
  created_at: string
}

export interface LeadActivity {
  id: string
  lead_id: string
  activity_type: string
  content: string
  created_at: string
}

export interface PerformanceReview {
  id: string
  intern_id: string
  reviewer: string
  review_date: string
  overall_score: number
  feedback?: string
  scores?: PerformanceScore[]
}

export interface PerformanceScore {
  id: string
  review_id: string
  category: string
  score: number
}

export interface ChecklistItem {
  id: string
  instance_id: string
  category: string
  item_text: string
  is_completed: boolean
  completed_at: string | null
  sort_order: number
}

export interface ScheduleTemplate {
  id: string
  intern_id: string
  day_of_week: number
  focus_areas: string[]
  frequency: string
}

export interface TeamPosition {
  id: string
  name: string
  display_name: string
  color: string
  icon?: string
  created_at: string
}

export interface ReportTemplate {
  id: string
  name: string
  type: 'daily' | 'weekly' | 'checklist'
  position: string | null
  fields: TemplateField[]
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface TemplateField {
  id: string
  label: string
  type: 'text' | 'textarea' | 'number' | 'checkbox' | 'select'
  required?: boolean
  options?: string[]
  placeholder?: string
}

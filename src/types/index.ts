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
  team_id?: string
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
  is_critical?: boolean
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
  is_critical?: boolean
}

// --- New types for the expanded system ---

export interface TaskAssignment {
  id: string
  template_id: string
  intern_id: string | null
  position: string | null
  is_active: boolean
  assigned_by: string | null
  created_at: string
}

export interface PlatformMetric {
  id: string
  platform: 'instagram' | 'tiktok' | 'youtube'
  metric_date: string
  follower_count: number
  entered_by: string | null
  created_at: string
}

export interface DeliverableSubmission {
  id: string
  intern_id: string
  submission_date: string
  submission_type: string
  dropbox_url: string | null
  platform_tag: string | null
  notes: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
}

export interface Project {
  id: string
  name: string
  client_name: string | null
  project_type: 'recording' | 'mixing' | 'mastering' | 'artist_dev' | 'education' | 'internal'
  status: 'active' | 'paused' | 'completed' | 'archived'
  assigned_to: string | null
  notes: string | null
  due_date: string | null
  created_at: string
  updated_at: string
}

export interface Session {
  id: string
  project_id: string | null
  client_name: string | null
  session_date: string
  start_time: string
  end_time: string
  session_type: 'recording' | 'mixing' | 'lesson' | 'meeting'
  status: 'confirmed' | 'pending' | 'cancelled'
  room: string | null
  notes: string | null
  created_by: string | null
  created_at: string
}

export interface ArtistPipelineEntry {
  id: string
  artist_name: string
  contact_email: string | null
  contact_phone: string | null
  stage: 'inquiry' | 'onboarding' | 'active' | 'release_support' | 'alumni'
  assigned_to: string | null
  notes: string | null
  next_followup: string | null
  created_at: string
  updated_at: string
}

export interface EducationStudent {
  id: string
  student_name: string
  contact_email: string | null
  instrument: string | null
  level: string | null
  status: 'active' | 'paused' | 'completed'
  assigned_to: string | null
  notes: string | null
  created_at: string
}

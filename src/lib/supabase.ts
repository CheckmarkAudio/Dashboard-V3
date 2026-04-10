import { createClient } from '@supabase/supabase-js'

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ??
  'https://ncljfjdcyswoeitsooty.supabase.co'

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jbGpmamRjeXN3b2VpdHNvb3R5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NjE4ODMsImV4cCI6MjA5MTIzNzg4M30.bwQj5llGUCBZiE7cFYUbwu6gOqK6G8cOhzm28sUkoxs'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

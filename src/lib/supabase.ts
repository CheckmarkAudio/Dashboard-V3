import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://localhost'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'dev-placeholder'

if (!import.meta.env.DEV && import.meta.env.VITE_DEMO_MODE !== 'true' && (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY)) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill in values.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

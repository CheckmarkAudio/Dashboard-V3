/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_DEPLOY_ENV?: string
  readonly VITE_PREVIEW_LOGIN_EMAIL?: string
  readonly VITE_PREVIEW_LOGIN_PASSWORD?: string
  readonly VITE_PREVIEW_LOGIN_ALLOWED?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

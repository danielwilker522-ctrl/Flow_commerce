import { createClient } from '@supabase/supabase-js'

// Fallback direto: garante que a app funciona mesmo que as variáveis de
// ambiente não sejam carregadas corretamente pela plataforma de build.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://eruccljcqorllmaddieg.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVydWNjbGpjcW9ybGxtYWRkaWVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0MjIyMDksImV4cCI6MjA5ODk5ODIwOX0.foSyXgmJOG48yyL8pPgnK__phcRUTiAqtluN51wlaEM'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

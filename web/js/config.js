// =============================================================================
//  Conexión con tu proyecto de Supabase.
//  Los dos valores están en Supabase → Project Settings → API (o "Connect").
//
//  La "anon / publishable key" es PÚBLICA: está pensada para ir en la página.
//  La seguridad la ponen las reglas (RLS) de supabase/schema.sql.
//  NUNCA pongas acá la "service_role / secret key".
// =============================================================================

export const SUPABASE_URL = "https://TU-PROYECTO.supabase.co";
export const SUPABASE_ANON_KEY = "TU-ANON-KEY";

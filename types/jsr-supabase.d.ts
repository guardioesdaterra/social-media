/**
 * Type resolution for the Deno `jsr:` specifier used by Supabase Edge Functions.
 * TypeScript cannot resolve `jsr:` URLs natively, so alias the specifier to the
 * npm package it maps to (same major version) for type checking only — Deno
 * still resolves the real `jsr:` import at runtime.
 */
declare module 'jsr:@supabase/supabase-js@2' {
  export * from '@supabase/supabase-js'
}

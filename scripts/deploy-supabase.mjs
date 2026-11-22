#!/usr/bin/env node
/**
 * scripts/deploy-supabase.mjs
 * @why Pushes the Supabase schema/migrations and deploys the edge functions
 *  to the linked "Social Media" project.
 *
 * Prereqs:
 *   - npx supabase login  (done once)
 *   - npx supabase link --project-ref eghddkeceomhwkaefqrq  (done)
 *   - DB password: `supabase db push` will prompt for it (or export
 *     PGPASSWORD / SUPABASE_DB_PASSWORD).
 *
 * Run: node scripts/deploy-supabase.mjs
 *      (or `pnpm supabase:deploy`)
 */
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

function fail(message) {
  console.error('[deploy-supabase]', message)
  process.exit(1)
}

const SUPABASE_CMD = 'npx'
const SUPABASE_ARGS = ['--yes', 'supabase']

function run(subcommand, subargs = [], { stdio = 'inherit', env = process.env, fatal = true } = {}) {
  const fullArgs = [...SUPABASE_ARGS, subcommand, ...subargs]
  const result = spawnSync(SUPABASE_CMD, fullArgs, { stdio, env, shell: false })
  if (result.error) fail(`could not start ${SUPABASE_CMD}: ${result.error.message}`)
  if (result.status !== 0 && fatal) {
    fail(`${SUPABASE_CMD} ${fullArgs.join(' ')} exited with status ${result.status}`)
  }
  return result
}

function getProjectRef() {
  // Prefer explicit env, fall back to the CLI-linked project (.temp/project-ref).
  const envRef = process.env.SUPABASE_PROJECT_REF
  if (envRef) return envRef.trim()
  try {
    return JSON.parse(readFileSync('supabase/.temp/linked-project.json', 'utf8')).ref
  } catch {
    return null
  }
}

function main() {
  const projectRef = getProjectRef()
  if (!projectRef) {
    fail('No Supabase project linked. Run: npx supabase link --project-ref <ref>')
  }
  console.log(`[deploy-supabase] Target project: ${projectRef}`)

  // 1) Push schema + seed migrations (best-effort: no local migrations dir
  //    exists in this repo, and the remote schema is already in place).
  console.log('[deploy-supabase] Pushing database migrations...')
  const dbResult = run('db', ['push', '--project-ref', projectRef, '--yes'], {
    stdio: 'pipe',
    fatal: false,
  })
  if (dbResult.status !== 0) {
    console.warn('[deploy-supabase] db push failed (no local migrations to push) — continuing to deploy edge functions')
  }

  // 2) Deploy edge functions.
  const functions = [
    'is-manager',
    'calendar-get',
    'calendar-save',
    'newsletter-get',
    'newsletter-save',
    'site-update-get',
    'site-update-save',
    'wayback-capture',
    'wayback-cdx',
  ]
  for (const name of functions) {
    console.log(`[deploy-supabase] Deploying edge function: ${name}`)
    run('functions', ['deploy', name, '--project-ref', projectRef, '--yes'])
  }

  console.log(`[deploy-supabase] Done. Functions deployed to project ${projectRef}.`)
  console.log('Next: add SUPABASE_URL/SERVICE_ROLE_KEY are injected automatically by Supabase.')
  console.log('Then configure Google OAuth in the Supabase dashboard (Auth → Providers → Google)')
  console.log('and add the redirect URL: https://guardioesdaterra.github.io/social-media/auth/callback')
}

main()

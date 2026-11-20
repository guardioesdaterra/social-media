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

function run(cmd, args, { stdio = 'inherit', env = process.env } = {}) {
  const result = spawnSync(cmd, args, { stdio, env, shell: false })
  if (result.error) fail(`could not start ${cmd}: ${result.error.message}`)
  if (result.status !== 0) {
    fail(`${cmd} ${args.join(' ')} exited with status ${result.status}`)
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

  // 1) Push schema + seed migrations.
  console.log('[deploy-supabase] Pushing database migrations...')
  run('supabase', ['db', 'push', '--project-ref', projectRef])

  // 2) Deploy edge functions.
  const functions = ['is-manager', 'calendar-get', 'calendar-save']
  for (const name of functions) {
    console.log(`[deploy-supabase] Deploying edge function: ${name}`)
    run('supabase', ['functions', 'deploy', name, '--project-ref', projectRef])
  }

  console.log(`[deploy-supabase] Done. Functions deployed to project ${projectRef}.`)
  console.log('Next: add SUPABASE_URL/SERVICE_ROLE_KEY are injected automatically by Supabase.')
  console.log('Then configure Google OAuth in the Supabase dashboard (Auth → Providers → Google)')
  console.log('and add the redirect URL: https://guardioesdaterra.github.io/social-media/auth/callback')
}

main()

// Run isolated PostgreSQL and navigation checks without touching Supabase.
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const directory = fileURLToPath(new URL('.', import.meta.url))
for (const file of readdirSync(directory).filter(file => /^test_.*\.mjs$/.test(file)).sort()) {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL(file, import.meta.url))], { stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status || 1)
}

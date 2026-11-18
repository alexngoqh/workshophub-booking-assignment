import { execSync } from 'child_process'
import path from 'path'

// Recreate the schema and seed data once per Jest run, in the dedicated test database.
export default function globalSetup() {
  const databaseUrl =
    process.env.DATABASE_URL || 'file:../database/workshophub-test.sqlite?connection_limit=1'
  const env = { ...process.env, DATABASE_URL: databaseUrl }
  const cwd = path.resolve(__dirname, '..')
  execSync('pnpm exec prisma db push --force-reset --skip-generate', { cwd, env, stdio: 'pipe' })
  execSync('pnpm exec ts-node prisma/seed.ts', { cwd, env, stdio: 'pipe' })
}

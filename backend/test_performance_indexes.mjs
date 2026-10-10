import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'

const db = new PGlite()
try {
  await db.exec("create schema auth; create table auth.users(id uuid primary key,raw_app_meta_data jsonb default '{}',raw_user_meta_data jsonb default '{}',updated_at timestamptz); create role anon; create role authenticated; create role service_role bypassrls;")
  await db.exec(await readFile(new URL('./setup_database.sql', import.meta.url), 'utf8'))
  const migration = await readFile(new URL('./migrations/016_performance_indexes.sql', import.meta.url), 'utf8')
  await db.exec(migration)
  await db.exec(migration)
  const names = [...migration.matchAll(/create index if not exists (\w+)/g)].map(match => match[1])
  assert.equal(names.length, 12)
  const indexes = (await db.query("select indexname from pg_indexes where schemaname='public'")).rows
  for (const name of names) assert(indexes.some(index => index.indexname === name), name)
  await db.exec('set enable_seqscan=off')
  const owner = '00000000-0000-0000-0000-000000000001'
  for (const [sql, index] of [
    [`select id from store_products where store_id='${owner}' and status='Active' order by id`, 'products_active_store_id'],
    [`select * from agent_settlement_items where settlement_id='${owner}' order by id`, 'settlement_items_settlement_id'],
    [`select * from support_tickets where user_id='${owner}' order by id`, 'support_tickets_user_id'],
  ]) {
    const plan = JSON.stringify((await db.query('explain ' + sql)).rows)
    assert(plan.includes(index), plan)
  }
  console.log('12 performance indexes: repeatable migration and query plans passed.')
} finally {
  await db.close()
}

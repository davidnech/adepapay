import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import { randomUUID, createHash } from 'node:crypto'
import assert from 'node:assert/strict'

const db = new PGlite()
const hash = value => createHash('sha256').update(value).digest('hex')
const query = async (sql, args = []) => (await db.query(sql, args)).rows
const rpc = async (name, args) => (await query(`select public.${name}(${args.map((_, i) => '$' + (i + 1)).join(',')}) as value`, args))[0].value
const secret = hash('browser secret'), code = hash('first code'), replacement = hash('replacement code')
const phone = '233241234567', email = 'customer@example.test'
const begin = (id, target = phone, address = email) => rpc('signup_sms_begin', [id, target, address, 'customer', secret, code])
try {
  await db.exec("create schema auth; create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb default '{}',raw_user_meta_data jsonb default '{}',updated_at timestamptz); create role anon; create role authenticated; create role service_role bypassrls;")
  await db.exec(await readFile(new URL('./setup_database.sql', import.meta.url), 'utf8'))
  await db.exec(await readFile(new URL('./migrations/017_signup_sms.sql', import.meta.url), 'utf8'))
  const user = randomUUID(), staff = randomUUID()
  await query("insert into auth.users(id,email,raw_app_meta_data) values($1,$2,'{}')", [user, email])
  assert.equal((await query('select raw_app_meta_data from auth.users where id=$1', [user]))[0].raw_app_meta_data.sms_verification_required, true)
  await query("insert into auth.users(id,raw_app_meta_data) values($1,'{\"role\":\"Field Agent\"}')", [staff])
  assert.equal((await query('select raw_app_meta_data from auth.users where id=$1', [staff]))[0].raw_app_meta_data.sms_verification_required, undefined)
  const id = randomUUID()
  await db.exec('set role authenticated')
  await assert.rejects(begin(id), /permission denied/)
  await assert.rejects(() => query('select * from signup_sms_challenges'), /permission denied/)
  await db.exec('set role service_role')
  await begin(id)
  await assert.rejects(begin(randomUUID()), /Wait 60 seconds/)
  assert.equal((await rpc('signup_sms_verify', [id, hash('other browser'), code])).verified, false)
  assert.equal((await rpc('signup_sms_verify', [id, secret, hash('wrong')])).verified, false)
  assert.equal((await query('select attempts from signup_sms_challenges where id=$1', [id]))[0].attempts, 1)
  await assert.rejects(() => rpc('signup_sms_resend', [id, secret, replacement]), /Wait 60 seconds/)
  await db.exec('reset role')
  await query("update signup_sms_challenges set last_sent_at=now()-interval '61 seconds' where id=$1", [id])
  await db.exec('set role service_role')
  await rpc('signup_sms_resend', [id, secret, replacement])
  assert.equal((await rpc('signup_sms_verify', [id, secret, code])).verified, false, 'old code invalidated')
  assert.equal((await rpc('signup_sms_verify', [id, secret, replacement])).verified, true)
  const metadata = await rpc('signup_sms_complete', [id, secret, user])
  assert.equal(metadata.sms_verification_required, false)
  assert.equal(metadata.sms_verification.phone, phone)
  assert.deepEqual(await rpc('signup_sms_complete', [id, secret, user]), metadata, 'completion retry is idempotent')
  await assert.rejects(() => rpc('signup_sms_complete', [id, secret, staff]), /Verify your phone/)
  assert.equal((await rpc('signup_sms_verify', [id, secret, replacement])).verified, false, 'completed code cannot be replayed')
  assert.equal((await query('select code_hash from signup_sms_challenges where id=$1', [id]))[0].code_hash, null)

  const locked = randomUUID()
  await begin(locked, '233201234567', 'locked@example.test')
  for (let i = 0; i < 5; i++) assert.equal((await rpc('signup_sms_verify', [locked, secret, hash('wrong')])).verified, false)
  assert.equal((await rpc('signup_sms_verify', [locked, secret, code])).verified, false, 'five wrong attempts lock verification')
  await assert.rejects(() => rpc('signup_sms_resend', [locked, secret, replacement]), /Too many incorrect codes/)

  const expired = randomUUID()
  await begin(expired, '233501234567', 'expired@example.test')
  await db.exec('reset role')
  await query("update signup_sms_challenges set expires_at=now()-interval '1 second' where id=$1", [expired])
  await db.exec('set role service_role')
  assert.equal((await rpc('signup_sms_verify', [expired, secret, code])).verified, false)
  await assert.rejects(() => rpc('signup_sms_complete', [expired, secret, user]), /Verify your phone/)

  const limit = randomUUID()
  await begin(limit, '233551234567', 'limit@example.test')
  for (let count = 0; count < 3; count++) {
    await db.exec('reset role')
    await query("update signup_sms_challenges set last_sent_at=now()-interval '61 seconds' where id=$1", [limit])
    await db.exec('set role service_role')
    await rpc('signup_sms_resend', [limit, secret, replacement])
  }
  await assert.rejects(() => rpc('signup_sms_resend', [limit, secret, replacement]), /SMS resend limit/)
  await db.exec('reset role')
  await query("update signup_sms_challenges set last_sent_at=now()-interval '61 seconds' where id=$1", [limit])
  await db.exec('set role service_role')
  await begin(randomUUID(), '233551234567', 'limit@example.test')
  await assert.rejects(begin(randomUUID(), '233551234567', 'another@example.test'), /Wait 60 seconds/)
  await db.exec('reset role')
  await db.exec("update signup_sms_challenges set last_sent_at=now()-interval '61 seconds'")
  // Recent resends count even when the original challenge began over an hour ago.
  await query("update signup_sms_challenges set created_at=now()-interval '65 minutes' where id=$1", [limit])
  await db.exec('set role service_role')
  await assert.rejects(begin(randomUUID(), '233551234567', 'another@example.test'), /Too many SMS requests/)
  console.log('PASS: private SMS state/RPCs; required signup marker; staff exemption; browser binding; cooldown; hourly/resend/attempt limits; code rotation/expiry; atomic completion; identity binding; replay protection.')
} finally { await db.close() }

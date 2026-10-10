import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import assert from 'node:assert/strict'

const db = new PGlite()
const query = async (sql, params = []) => (await db.query(sql, params)).rows
const rpc = async (name, params) => (await query(`select public.${name}(${params.map((_, i) => `$${i + 1}`).join(',')}) as value`, params))[0].value
try {
  await db.exec("create schema auth; create table auth.users(id uuid primary key,raw_app_meta_data jsonb default '{}',raw_user_meta_data jsonb default '{}',updated_at timestamptz); create role anon; create role authenticated; create role service_role bypassrls;")
  const setup = await readFile(new URL('./setup_database.sql', import.meta.url), 'utf8')
  for (let run = 0; run < 2; run++) {
    const result = await db.exec(setup)
    assert.equal(result.at(-1).rows.length, 26)
    assert(result.at(-1).rows.every(row => row.installed_table))
  }
  const store = randomUUID(), customer = randomUUID()
  await query('insert into auth.users(id,raw_app_meta_data) values($1,$2)', [store, { role: 'Store Manager', store_id: store, store_review: { status: 'Approved', application: { storeName: 'Paid Shop' } }, store_subscription: { paid_until: '2099-01-01' } }])
  assert.equal((await query('select raw_app_meta_data from auth.users where id=$1', [store]))[0].raw_app_meta_data.store_subscription, undefined, 'fake paid metadata is stripped')
  await query('insert into auth.users(id) values($1)', [customer])
  const plan = (await query("insert into subscription_plans(name,amount_minor,duration_days,enabled) values('Monthly',15000,30,true) returning id"))[0].id
  const product = (await query("insert into store_products(store_id,name,sku,category,condition,price,stock,status,images,payment_options,swap,layaway) values($1,'Phone','SUBTEST','Phones','New',500,10,'Active','[{}]','{}','{}','{}') returning id", [store]))[0].id
  const submit = () => rpc('submit_customer_application', [{ reference: randomUUID(), request_id: randomUUID(), customer_id: customer, store_id: store, product_id: product, kind: 'layaway', details: {}, snapshot: { price: 500 }, terms: {}, total: 500, deposit: 100 }, 1])
  await assert.rejects(submit, /active subscription/)
  const order = async (mode = 'test') => {
    const reference = 'SUB-' + randomUUID().replaceAll('-', '')
    await query("insert into subscription_orders(reference,store_id,plan_id,plan_name,amount_minor,duration_days,email,environment) values($1,$2,$3,'Monthly',15000,30,'owner@example.test',$4)", [reference, store, plan, mode])
    return reference
  }
  const activate = (ref, tx, amount = 15000, mode = 'test') => rpc('activate_store_subscription', [ref, tx, amount, 'GHS', 'owner@example.test', mode, new Date().toISOString()])
  const ref = await order()
  await db.exec('set role authenticated')
  await assert.rejects(() => activate(ref, '1'), /permission denied/)
  await assert.rejects(() => query('select * from subscription_orders'), /permission denied/)
  await db.exec('set role service_role')
  await assert.rejects(() => activate(ref, '1', 1), /does not match/)
  const first = await activate(ref, '1')
  const expiry = (await query('select paid_until from store_subscriptions'))[0].paid_until
  assert.equal(first.alreadyPaid, false)
  assert.equal((await activate(ref, '1')).alreadyPaid, true)
  assert.equal(new Date((await query('select paid_until from store_subscriptions'))[0].paid_until).getTime(), new Date(expiry).getTime(), 'duplicate callback/webhook cannot extend access')
  await assert.rejects(() => activate(ref, 'DIFFERENT'), /Transaction mismatch/)
  await submit()
  const ref2 = await order()
  await activate(ref2, '2')
  const renewed = (await query('select paid_until from store_subscriptions'))[0].paid_until
  assert.equal(new Date(renewed) - new Date(expiry), 30 * 86400000, 'early renewal adds exactly one term')
  await db.exec('reset role')
  await query("update auth.users set raw_app_meta_data=raw_app_meta_data-'store_subscription' where id=$1", [store])
  assert.equal(new Date((await query('select raw_app_meta_data from auth.users where id=$1', [store]))[0].raw_app_meta_data.store_subscription.paid_until).getTime(), new Date(renewed).getTime())
  await query("update store_subscriptions set paid_until=now()-interval '1 day' where store_id=$1", [store])
  await assert.rejects(submit, /active subscription/)
  const live = await order('live')
  await activate(live, '3', 15000, 'live')
  const badTest = await order()
  await assert.rejects(() => activate(badTest, '4'), /separate database/)
  assert.equal((await query('select status from subscription_orders where reference=$1', [badTest]))[0].status, 'Pending')
  await rpc('admin_store_action', [store, 'suspend', 'Admin review', 'admin@example.test', 0, 'Approved'])
  const latePayment = await order('live')
  await activate(latePayment, '5', 15000, 'live')
  assert.equal((await query('select raw_app_meta_data from auth.users where id=$1', [store]))[0].raw_app_meta_data.store_review.status, 'Suspended', 'payment cannot undo suspension')

  const event = randomUUID(), hash = 'a'.repeat(64)
  await db.exec('set role service_role')
  await rpc('record_site_pageview', [event, hash, 'home', 'Desktop', 'direct'])
  assert.equal(await rpc('record_site_engagement', [event, 'b'.repeat(64), 2, 1, 80]), false)
  await rpc('record_site_engagement', [event, hash, 2, 1, 80])
  await rpc('record_site_engagement', [event, hash, 1, 0, 20])
  const engagement = (await query('select * from site_pageviews where id=$1', [event]))[0]
  assert.equal(engagement.active_seconds, 2)
  assert.equal(engagement.scroll_depth, 80)
  await assert.rejects(() => rpc('record_site_engagement', [event, hash, 1, 2, 100]), /Invalid engagement/)
  await rpc('record_site_engagement', [event, hash, 3600, 0, 100])
  assert((await query('select active_seconds from site_pageviews where id=$1', [event]))[0].active_seconds < 30, 'server bounds fabricated elapsed time')
  const report = await rpc('site_engagement_summary', [7])
  assert.equal(report.pages[0].views, 1)
  assert.equal(report.averageScrollDepth, 100)
  await db.exec('set role anon')
  await assert.rejects(() => rpc('record_site_engagement', [event, hash, 1, 0, 20]), /permission denied/)
  console.log('PASS: setup twice, paid-access enforcement, exact-once activation, renewal, mode isolation, metadata protection, preserved suspension, consent-event ownership, bounded/monotonic engagement and reporting.')
} finally { await db.close() }

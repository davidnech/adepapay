// Real settlement transactions in an isolated database; no live funds or records.
import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import assert from 'node:assert/strict'

const db=new PGlite()
const store=randomUUID(), otherStore=randomUUID(), customer=randomUUID(), agent=randomUUID(), otherAgent=randomUUID()
const query=async(sql,args=[]) => (await db.query(sql,args)).rows
const settle=async(ids,expected,request=randomUUID(),asAgent=agent) => (await query('select public.admin_settle_agent($1,$2,$3,$4,$5,$6,$7) as value',[asAgent,ids,request,expected,'Cash','Remittance received','admin@example.test']))[0].value
try {
  await db.exec("create schema auth; create table auth.users(id uuid primary key,raw_app_meta_data jsonb default '{}',raw_user_meta_data jsonb default '{}',updated_at timestamptz); create role anon; create role authenticated; create role service_role bypassrls;")
  await db.exec(await readFile(new URL('./setup_database.sql',import.meta.url),'utf8'))
  for(const id of [store,otherStore,customer,agent,otherAgent]) await query('insert into auth.users(id) values($1)',[id])
  for(const [id,owner] of [[agent,store],[otherAgent,otherStore]]) await query("insert into store_field_agents(id,store_id,email,profile) values($1,$2,'agent@example.test','{}')",[id,owner])
  const product=(await query("insert into store_products(store_id,name,sku,category,condition,price,stock,status,images,payment_options,swap,layaway) values($1,'Phone','FIXTURE','Phones','New',1000,10,'Active','[{}]','{}','{}','{}') returning id",[store]))[0].id
  // Fixture insertion does not invoke an unrelated subscription checkout.
  await db.exec('alter table customer_applications disable trigger require_subscription_for_application')
  const application=(await query("insert into customer_applications(reference,request_id,customer_id,store_id,product_id,kind,details,snapshot,terms,total,deposit,paid) values('APP-FIXTURE',$1,$2,$3,$4,'hire_purchase','{}','{}','{}',1000,100,200) returning id",[randomUUID(),customer,store,product]))[0].id
  await db.exec('alter table customer_applications enable trigger require_subscription_for_application')
  const receipts=[]
  for(const [index,owner,actor] of [[1,store,agent],[2,store,agent],[3,otherStore,otherAgent]]) {
    const payment=(await query("insert into application_payments(request_id,application_id,store_id,customer_id,amount,method,reference,recorded_by) values($1,$2,$3,$4,100,'Cash',$5,$6) returning id",[randomUUID(),application,owner,customer,'RECEIPT-'+index,actor]))[0].id
    receipts.push(payment)
  }
  await db.exec('set role authenticated')
  await assert.rejects(()=>settle(receipts.slice(0,2),200),/permission denied/)
  await assert.rejects(()=>query('select * from agent_settlements'),/permission denied/)
  await db.exec('set role service_role')
  await assert.rejects(()=>settle([receipts[2]],100),/belong to this agent/)
  await assert.rejects(()=>settle([receipts[0],receipts[0]],200),/distinct/)
  await assert.rejects(()=>settle([receipts[0]],99),/amount changed/)
  assert.equal((await query('select * from agent_settlements')).length,0)
  // A failed item insertion must roll back both the ledger and its receipt links.
  await db.exec("reset role; create function fail_settlement_item() returns trigger language plpgsql as $$ begin raise exception 'forced item failure'; end $$; create trigger fail_settlement_item before insert on agent_settlement_items for each row execute function fail_settlement_item(); set role service_role;")
  await assert.rejects(()=>settle(receipts.slice(0,2),200),/forced item failure/)
  assert.equal((await query('select * from agent_settlements')).length,0)
  await db.exec('reset role; drop trigger fail_settlement_item on agent_settlement_items; set role service_role;')
  const request=randomUUID(), saved=await settle(receipts.slice(0,2),200,request)
  assert.equal(Number(saved.amount),200)
  assert.equal(saved.actor,'admin@example.test')
  assert.equal((await settle(receipts.slice(0,2).reverse(),200,request)).id,saved.id,'retries are idempotent regardless of receipt order')
  await assert.rejects(()=>settle([receipts[0]],100,request),/request already used/)
  await assert.rejects(()=>settle([receipts[0]],100),/already settled/)
  assert.equal((await query('select * from agent_settlements')).length,1)
  assert.equal((await query('select * from agent_settlement_items')).length,2)
  assert.equal((await query('select * from application_payments')).length,3,'settlement retains original payment records')
  console.log('PASS: settlement permissions; cross-store receipts blocked; totals checked; duplicate receipts blocked; atomic rollback; idempotent retries; actual administrator identity; original payments retained.')
} finally { await db.close() }

// Runs the actual migrations and RPCs in an isolated PostgreSQL WASM database.
// No network, project credentials, or live customer data are used.
import { PGlite } from "@electric-sql/pglite"
import { readFile } from "node:fs/promises"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"

const db = new PGlite()
const customer = randomUUID(),
  otherCustomer = randomUUID(),
  store = randomUUID(),
  otherStore = randomUUID()
const query = async (sql, params = []) => (await db.query(sql, params)).rows
const rpc = async (name, params) =>
  (
    await query(
      `select public.${name}(${params.map((_, i) => `$${i + 1}`).join(",")}) as result`,
      params,
    )
  )[0].result
try {
  await db.exec(
    "create schema auth; create table auth.users(id uuid primary key); create role anon; create role authenticated; create role service_role bypassrls;",
  )
  for (const name of [
    "001_store_products.sql",
    "002_store_promotions.sql",
    "003_categories_trade_inventory.sql",
    "004_field_agents.sql",
    "005_customer_applications.sql",
    "006_homepage_ratings_analytics.sql",
    "011_purchase_option_prices.sql",
  ]) {
    await db.exec(
      await readFile(new URL(`./migrations/${name}`, import.meta.url), "utf8"),
    )
  }
  for (const id of [customer, otherCustomer, store, otherStore])
    await query("insert into auth.users values($1)", [id])
  const product = (
    await query(
      `insert into public.store_products(store_id,name,sku,category,condition,price,stock,status,images,payment_options,swap,layaway) values($1,'Test phone','test-1','Phones','New',1000,2,'Active','[{}]','{}','{}','{}') returning id`,
      [store],
    )
  )[0].id
  const stock = async () =>
    Number(
      (
        await query("select stock from store_products where id=$1", [product])
      )[0].stock,
    )
  const stored = async (id) =>
    (await query("select * from customer_applications where id=$1", [id]))[0]
  const submit = async (kind = "hire_purchase", uid = customer) => {
    const record = {
      reference: "APP-" + randomUUID(),
      request_id: randomUUID(),
      customer_id: uid,
      store_id: store,
      product_id: product,
      kind,
      details: {
        device: "Old phone",
        serial: randomUUID(),
        deviceCondition: "Good",
      },
      snapshot: { price: 1000 },
      terms: { months: 3, frequency: "Monthly", installments: 3, offerDays: 7 },
      total: 1000,
      deposit: 200,
    }
    const revision = (
      await query("select revision from store_products where id=$1", [product])
    )[0].revision
    const application = await rpc("submit_customer_application", [
      record,
      revision,
    ])
    assert.equal(
      (await rpc("submit_customer_application", [record, revision])).id,
      application.id,
      "submission retry returns same application",
    )
    return application
  }
  const act = (
    a,
    action,
    data = {},
    asCustomer = false,
    scope = asCustomer ? customer : store,
  ) =>
    rpc("act_on_customer_application", [
      a.id,
      scope,
      asCustomer,
      asCustomer ? customer : store,
      a.revision,
      action,
      data,
    ])
  await db.exec("set role service_role")
  let priced = await submit('hire_purchase', otherCustomer)
  let peer = await submit('layaway', customer)
  await assert.rejects(() => act(priced, 'adjust_price', {price:900,reason:'Discount'}, true, otherCustomer), /not permitted/)
  await assert.rejects(() => act(priced, 'adjust_price', {price:900,reason:'Discount'}, false, otherStore), /not found/)
  for (const price of [0,-1,1.111,10000000000]) await assert.rejects(() => act(priced,'adjust_price',{price,reason:'Discount'}), /valid price/)
  const oldPriced = priced
  priced = await act(priced, 'adjust_price', {price:900,reason:'Customer discount'})
  assert.equal(Number(priced.total),900)
  assert.equal(Number(priced.deposit),180)
  assert.equal(priced.snapshot.originalPrice,1000)
  assert.equal(priced.snapshot.price,900)
  await assert.rejects(() => act(oldPriced,'adjust_price',{price:800,reason:'Stale request'}), /changed/)
  priced = await act(priced, 'adjust_price', {price:800,reason:'Additional discount'})
  assert.equal(priced.snapshot.originalPrice,1000)
  assert.equal(Number((await stored(peer.id)).total),1000,'other applications keep their price')
  assert.equal(Number((await query('select price from store_products where id=$1',[product]))[0].price),1000,'catalogue price is unchanged')
  assert.equal(await stock(),2,'price adjustment does not reserve stock')
  priced = await act(priced, 'approve')
  await assert.rejects(() => act(priced,'adjust_price',{price:700,reason:'Too late'}), /only change during/)
  await act(priced,'cancel')
  await act(peer,'cancel')
  let pricedSwap = await submit('swap', otherCustomer)
  pricedSwap = await act(pricedSwap,'offer',{credit:300,reason:'Trade-in assessment'})
  pricedSwap = await act(pricedSwap,'adjust_price',{price:950,reason:'Revised product price'})
  assert.equal(pricedSwap.status,'Pending')
  assert.equal(Number(pricedSwap.swap_credit),0)
  assert.equal(pricedSwap.offer_expires_at,null)
  pricedSwap = await act(pricedSwap,'offer',{credit:250,reason:'New trade-in offer'})
  assert.equal(Number(pricedSwap.total),700,'swap balance uses customer-specific product price')
  await act(pricedSwap,'cancel')
  let hire = await submit()
  assert.equal(await stock(), 2, "pending applications do not reserve stock")
  await assert.rejects(() => act(hire, "approve", {}, true), /not permitted/)
  await assert.rejects(
    () => act(hire, "approve", {}, false, otherStore),
    /not found/,
  )
  hire = await act(hire, "approve")
  assert.equal(await stock(), 1)
  await assert.rejects(() => act({ ...hire, revision: 1 }, "cancel"), /changed/)
  await assert.rejects(() => act(hire, "fulfill"), /payment/)
  await assert.rejects(
    () =>
      act(hire, "payment", {
        amount: 1001,
        method: "Cash",
        reference: "excess",
        request_id: randomUUID(),
      }),
    /balance/,
  )
  const payment = {
    amount: 200,
    method: "Cash",
    reference: "cash-001",
    request_id: randomUUID(),
  }
  const stale = hire
  hire = await act(hire, "payment", payment)
  const repeat = await act(stale, "payment", payment)
  assert.equal(repeat.paid, 200, "retry must not charge twice")
  assert.equal((await query("select * from application_payments")).length, 1)
  await assert.rejects(
    () => act(hire, "payment", { ...payment, amount: 201 }),
    /already used/,
  )
  await assert.rejects(() => act(hire, "cancel", {}, true), /unpaid/)
  hire = await act(hire, "fulfill")
  assert.equal(
    hire.status,
    "Approved",
    "hire purchase remains active after deposit handover",
  )
  hire = await act(hire, "payment", {
    amount: 800,
    method: "Mobile Money",
    reference: "momo-002",
    request_id: randomUUID(),
  })
  assert.equal(hire.status, "Completed")
  assert.equal(
    (
      await query(
        "select sum(amount) as paid from application_payments where application_id=$1",
        [hire.id],
      )
    )[0].paid,
    "1000.00",
  )

  let layaway = await submit("layaway")
  const waiting = await submit("hire_purchase", otherCustomer)
  layaway = await act(layaway, "approve")
  assert.equal(await stock(), 0)
  await assert.rejects(() => act(waiting, "approve"), /no longer available/)
  assert.equal(
    (await stored(waiting.id)).status,
    "Pending",
    "failed reservation must roll back decision",
  )
  layaway = await act(layaway, "cancel", {}, true)
  assert.equal(await stock(), 1, "cancellation restores inventory exactly once")
  await assert.rejects(() => act(layaway, "cancel", {}, true), /unpaid/)
  assert.equal(await stock(), 1)
  layaway = await submit("layaway")
  layaway = await act(layaway, "approve")
  layaway = await act(layaway, "payment", {
    amount: 200,
    method: "Cash",
    reference: "layaway-1",
    request_id: randomUUID(),
  })
  await assert.rejects(() => act(layaway, "fulfill"), /payment/)
  layaway = await act(layaway, "payment", {
    amount: 800,
    method: "Cash",
    reference: "layaway-2",
    request_id: randomUUID(),
  })
  layaway = await act(layaway, "fulfill")
  assert.equal(layaway.status, "Completed")

  await query(
    "update store_products set stock=2,revision=revision+1 where id=$1",
    [product],
  )
  let swap = await submit("swap")
  await assert.rejects(() => act(swap, "approve"), /cannot be approved/)
  swap = await act(swap, "offer", {
    credit: 300,
    reason: "Device inspected; credit offered.",
  })
  assert.equal(swap.total, 700)
  assert.equal(
    await stock(),
    2,
    "offers do not reserve inventory before acceptance",
  )
  await assert.rejects(
    () => act(swap, "accept", {}, true, otherCustomer),
    /not found/,
  )
  await query(
    "update customer_applications set offer_expires_at=now()-interval '1 day' where id=$1",
    [swap.id],
  )
  await assert.rejects(() => act(swap, "accept", {}, true), /expired/)
  swap = await act(swap, "offer", { credit: 350, reason: "Revised offer." })
  swap = await act(swap, "accept", {}, true)
  assert.equal(await stock(), 1)
  swap = await act(swap, "payment", {
    amount: 650,
    method: "Bank Transfer",
    reference: "swap-1",
    request_id: randomUUID(),
  })
  await assert.rejects(() => act(swap, "fulfill"), /physical receipt/)
  swap = await act(swap, "fulfill", { device_received: true })
  assert.equal(swap.status, "Completed")
  const inventory = await query(
    "select * from store_trade_inventory where source_reference=$1",
    [swap.reference],
  )
  assert.equal(inventory.length, 1)
  assert.equal(inventory[0].acquisition_value, "350.00")
  await assert.rejects(
    () => act(swap, "fulfill", { device_received: true }),
    /payment/,
  )
  const rejected = await act(await submit("hire_purchase"), "reject", {
    reason: "Income information needs review.",
  })
  assert.equal(rejected.status, "Rejected")
  assert.equal(await stock(), 1)
  // Completed-purchase ratings cannot be supplied by a different customer.
  await assert.rejects(()=>rpc('save_purchase_rating',[waiting.id,otherCustomer,5,5]),/completed purchases/)
  await assert.rejects(()=>rpc('save_purchase_rating',[hire.id,otherCustomer,5,5]),/completed purchases/)
  await rpc('save_purchase_rating',[hire.id,customer,4,3])
  await rpc('save_purchase_rating',[hire.id,customer,5,4])
  await rpc('save_purchase_rating',[layaway.id,customer,3,2])
  await assert.rejects(()=>rpc('save_purchase_rating',[hire.id,customer,6,4]),/check constraint/)
  const ratings=await rpc('public_rating_summary',[])
  assert.equal(ratings.stores[0].count,2)
  assert.equal(ratings.stores[0].rating,4)
  assert.equal(ratings.products[0].rating,3)
  assert.equal(JSON.stringify(ratings).includes(customer),false)
  const visitor='a'.repeat(64),secondVisitor='b'.repeat(64),event=randomUUID()
  assert.equal(await rpc('record_site_pageview',[event,visitor,'home','Desktop','direct']),true)
  await rpc('record_site_pageview',[event,visitor,'home','Desktop','direct'])
  await rpc('record_site_pageview',[randomUUID(),secondVisitor,'browse-products','Mobile','example.com'])
  let report=await rpc('site_traffic_summary',[7])
  assert.equal(report.pageviews,2)
  assert.equal(report.visitors,2)
  assert.equal(report.daily.length,7)
  assert.equal(report.daily.reduce((sum,row)=>sum+row.views,0),2)
  await query("insert into site_pageviews(id,visitor_hash,page,device,source,created_at) values($1,$2,'home','Desktop','direct',now()-interval '91 days')",[randomUUID(),visitor])
  for(let i=0;i<29;i++) await rpc('record_site_pageview',[randomUUID(),visitor,'home','Desktop','direct'])
  assert.equal(await rpc('record_site_pageview',[randomUUID(),visitor,'home','Desktop','direct']),false)
  assert.equal((await query("select count(*) as count from site_pageviews where created_at<now()-interval '90 days'"))[0].count,0)
  report=await rpc('site_traffic_summary',[30])
  assert.equal(report.pageviews,31)
  await assert.rejects(()=>rpc('site_traffic_summary',[999]),/Choose/)
  await db.exec("reset role; set role authenticated;")
  await assert.rejects(
    () => query("select * from customer_applications"),
    /permission denied/,
  )
  await assert.rejects(
    () =>
      rpc("act_on_customer_application", [
        hire.id,
        store,
        false,
        store,
        hire.revision,
        "cancel",
        {},
      ]),
    /permission denied/,
  )
  await assert.rejects(()=>query('select * from site_pageviews'),/permission denied/)
  await assert.rejects(()=>rpc('public_rating_summary',[]),/permission denied/)
  await assert.rejects(()=>rpc('record_site_pageview',[randomUUID(),visitor,'home','Desktop','direct']),/permission denied/)
  console.log(
    "PASS: migrations, scoped RPCs, reservations, rejection, cancellation, stale revisions, payment idempotency, installment handover, swap acceptance/expiry/inventory browser-role denial, verified purchase ratings, traffic deduplication/rate limits/retention and aggregate reports.",
  )
} finally {
  await db.close()
}

import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import vm from "node:vm"
import ts from "typescript"
import { PGlite } from "@electric-sql/pglite"
import { randomUUID } from "node:crypto"

const code = ts.transpileModule(await readFile(new URL("../src/lib/portalNavigation.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const exports = {}
vm.runInNewContext(code, { exports, URLSearchParams })
const { portalPages, portalHref, parsePortalRoute } = exports
// Hooks must remain at component scope when adding route and data effects.
for (const file of ["StoreTeam", "StorePromotions", "StoreProducts", "StoreCatalogue", "StoreAgents", "Marketplace", "ApplicationWorkspace", "StoreNotifications", "StoreAgentAccounts"]) {
  const source = ts.createSourceFile(file + ".tsx", await readFile(new URL(`../src/pages/${file}.tsx`, import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const visit = (node, depth = 0) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && /^use(Effect|State|Ref)$/.test(node.expression.text)) assert.equal(depth, 1, `${file}: hooks must be called at component scope`)
    ts.forEachChild(node, child => visit(child, depth + (ts.isFunctionLike(node) ? 1 : 0)))
  }
  visit(source)
}
for (const portal of ["customer", "store"]) {
  for (const page of portalPages[portal]) {
    const route = parsePortalRoute(portalHref(portal, page, "record?x=a&b=#value", "Customer & receipt"), portal)
    assert.equal(route.page, page)
    assert.equal(route.record, "record?x=a&b=#value")
    assert.equal(route.query, "Customer & receipt")
  }
  for (const bad of ["", "#admin/products", "#store/logout", "#customer/javascript:alert(1)"]) assert.equal(parsePortalRoute(bad, portal).page, "dashboard")
}
assert.equal(parsePortalRoute("#store/applications?record=private", "store", ["products"]).page, "products")
assert.equal(parsePortalRoute("#store/applications?record=private", "store", ["products"]).record, "")
assert.equal(parsePortalRoute("#store/swap-settings", "store").page, "products")
const history = [portalHref("customer", "products"), portalHref("customer", "products", "saved-product"), portalHref("customer", "notifications")]
assert.equal(parsePortalRoute(history.at(-2), "customer").record, "saved-product")
assert.equal(parsePortalRoute(history.at(-1), "customer").page, "notifications")

const db = new PGlite()
const query = async (sql, args = []) => (await db.query(sql, args)).rows
try {
  await db.exec("create schema auth; create table auth.users(id uuid primary key,raw_app_meta_data jsonb default '{}',raw_user_meta_data jsonb default '{}',updated_at timestamptz); create role anon; create role authenticated; create role service_role bypassrls;")
  await db.exec(await readFile(new URL("./setup_database.sql", import.meta.url), "utf8"))
  const customer = randomUUID(), other = randomUUID()
  for (const user of [customer, other]) await query("insert into auth.users(id) values($1)", [user])
  await query("insert into admin_notification_reads(actor,notification_key) values($1,'event:shared'),($2,'event:shared'),('admin@example.test','event:shared')", ["customer:" + customer, "customer:" + other])
  const migration = await readFile(new URL("./migrations/015_customer_notifications.sql", import.meta.url), "utf8")
  await db.exec(migration); await db.exec(migration)
  assert.equal((await query("select * from customer_notification_reads where user_id=$1", [customer])).length, 1)
  assert.equal((await query("select * from customer_notification_reads")).length, 2)
  await db.exec("set role authenticated")
  await assert.rejects(() => query("select * from customer_notification_reads"), /permission denied/)
  await assert.rejects(() => query("insert into customer_notification_reads(user_id,notification_key) values($1,'forged')", [customer]), /permission denied/)
  await db.exec("set role service_role")
  await query("insert into customer_notification_reads(user_id,notification_key) values($1,'support:reply') on conflict(user_id,notification_key) do nothing", [customer])
  assert.equal((await query("select * from customer_notification_reads where user_id=$1", [customer])).length, 2)
  assert.equal((await query("select * from customer_notification_reads where user_id=$1", [other])).length, 1)
  console.log("PASS: customer/store routes, escaped records, staff route limits, history, repeatable migration, read-marker backfill, user isolation and database permissions.")
} finally { await db.close() }

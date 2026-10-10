// Exercise actual route code for refresh, record links and browser history URLs.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import ts from 'typescript'

const code = ts.transpileModule(await readFile(new URL('../src/lib/adminNavigation.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const exports = {}
vm.runInNewContext(code, { exports, URLSearchParams })
const { adminPages, adminHref, parseAdminRoute, isAdminPage } = exports
for (const page of adminPages) {
  const route = parseAdminRoute(adminHref(page))
  assert.equal(route.page, page)
  assert.equal(route.record, '')
}
const store = '11111111-1111-4111-8111-111111111111'
assert.equal(parseAdminRoute(adminHref('stores', store)).record, store)
assert.equal(parseAdminRoute('#admin-stores').page, 'stores')
for (const record of ['payment:receipt-123', 'platform:log-321', 'support-ticket-1', 'SKU?a=b&c=#value']) {
  const route = parseAdminRoute(adminHref('transactions', record, 'Real name & email'))
  assert.equal(route.page, 'transactions')
  assert.equal(route.record, record)
  assert.equal(route.query, 'Real name & email')
}
const history = [adminHref('dashboard'), adminHref('products'), adminHref('products', 'product-1'), adminHref('notifications')]
assert.equal(parseAdminRoute(history.at(-2)).record, 'product-1', 'Back restores the open product')
assert.equal(parseAdminRoute(history.at(-1)).page, 'notifications', 'Forward restores notifications')
for (const hash of ['#admin/unknown', '#admin/logout', '#admin/javascript:alert(1)', '#unrelated', '']) assert.equal(parseAdminRoute(hash).page, 'dashboard')
assert.equal(isAdminPage('settings'), true)
assert.equal(isAdminPage('javascript:alert(1)'), false)
console.log('PASS: all admin routes; legacy store profile URLs; refreshable records; escaped references/search; Back/Forward URLs; invalid routes rejected.')

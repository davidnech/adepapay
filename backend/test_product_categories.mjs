import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import vm from "node:vm"
import ts from "typescript"
const code = ts.transpileModule(await readFile(new URL("../src/lib/productCategories.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const exports = {}
vm.runInNewContext(code, { exports })
const { categoryChoices, productCategoryGroups } = exports
const presets = Object.values(productCategoryGroups).flat()
assert(presets.length > 200)
assert.equal(new Set(presets.map(name => name.toLowerCase())).size, presets.length)
const saved = [{ name: "phones", status: "Active" }, { name: "Laptops", status: "Archived" }, { name: "My Custom Product", status: "Active" }]
const choices = categoryChoices(saved).flatMap(([, names]) => names)
assert.equal(choices.filter(name => name.toLowerCase() === "phones").length, 1)
assert(!choices.includes("Laptops"), "Archived store categories must not reappear through presets")
assert(choices.includes("My Custom Product"))
assert(categoryChoices(saved, "Laptops").flatMap(([, names]) => names).includes("Laptops"), "Existing products keep their current category")
assert(categoryChoices(saved, "Legacy Product Category").flatMap(([, names]) => names).includes("Legacy Product Category"))
console.log(`PASS: ${presets.length} grouped suggestions; custom categories; case-insensitive deduplication; archived category exclusion; existing category preservation.`)

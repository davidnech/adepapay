import { formatMoney } from "../lib/applicationsApi"

export type OptionPrices = { hire_purchase?: number | string; layaway?: number | string; swap?: number | string }

export default function ProductPrices({ cash, prices, regularCash, availability }: {
  cash: number | string
  prices?: OptionPrices
  regularCash?: number | string
  availability?: { payNow?: boolean; hirePurchase?: boolean; layaway?: boolean; swap?: boolean }
}) {
  const rows = [
    { label: "Cash", value: cash, offered: availability?.payNow },
    { label: "Hire Purchase", value: prices?.hire_purchase ?? cash, offered: availability?.hirePurchase },
    { label: "Layaway", value: prices?.layaway ?? cash, offered: availability?.layaway },
    { label: "Swap", value: prices?.swap ?? cash, offered: availability?.swap },
  ]
  return <dl aria-label="Product prices" className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">{rows.map(row => <div key={row.label}><dt className="text-xs text-slate-500">{row.label}{row.offered === false && <span className="ml-1 text-[10px]">(Not offered)</span>}</dt><dd className="mt-0.5 font-semibold text-blue-700">{formatMoney(row.value)}{row.label === "Cash" && regularCash !== undefined && Number(regularCash) !== Number(cash) && <del className="ml-1 text-xs font-normal text-slate-400">{formatMoney(regularCash)}</del>}</dd></div>)}</dl>
}

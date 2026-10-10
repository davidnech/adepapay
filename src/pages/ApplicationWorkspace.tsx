import PurchaseRating from './PurchaseRating'
import ApplicationTerms from "./ApplicationTerms"

import { useEffect, useState, type FormEvent } from "react"

import {
  applicationRequest,
  applicationKinds,
  formatMoney,
  type ApplicationKind,
} from "../lib/applicationsApi"

type Application = {
  id: string
  reference: string
  customer_id: string
  kind: ApplicationKind
  status: string
  revision: number
  created_at: string
  approved_at: string | null

  total: number
  deposit: number
  paid: number
  swap_credit: number
  fulfilled: boolean
  decision_reason: string
  offer_expires_at: string | null

  details: {
    fullName: string
    email: string
    phone: string
    address: string
    ghanaCard: string
    employment?: string
    monthlyIncome?: number
    deliveryNote?: string
    device?: string
    serial?: string
    deviceCondition?: string
    acceptedAt: string
    guarantors: Record<string, string>[]
    documents: Record<string, { url: string }>
  }

  snapshot: {
    productName: string
    storeName: string
    originalPrice?: number
    price: number
    rules: Record<string, unknown>
    rulesRevision: number
    layaway: Record<string, unknown>
    swap?: Record<string, unknown>
  }

  terms: { months: number; frequency: string; installments: number }
  schedule: { date: string; amount: number; remaining: number; label: string }[]
}

type Payment = {
  id: string
  application_id: string
  amount: number
  method: string
  reference: string
  created_at: string
}

type Change = {
  id: string
  application_id: string
  event: string
  message: string
  created_at: string
}

type Data = { applications: Application[]; payments: Payment[]; events: Change[] }

const button =
  "rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold disabled:opacity-50"

const input = "w-full rounded-xl border border-slate-200 bg-white p-3 text-sm"

const titles: Record<string, string> = {
  dashboard: "Account overview",
  applications: "Applications",
  swap: "Swap applications",
  layaway: "Layaway plans",
  plans: "My payment plans",
  purchases: "Purchases",
  payments: "Payments",
  receipts: "Receipts",
  notifications: "Notifications",
  customers: "Customers",
  reports: "Application reports",
}

const stamp = (value: string) => new Date(value).toLocaleString("en-GH")

function downloadReceipt(payment: Payment, application: Application) {
  const body = [
    "ADEPAPAY",
    "PAYMENT RECEIPT",
    `Receipt: ${payment.id}`,
    `Store: ${application.snapshot.storeName}`,
    `Customer: ${application.details.fullName}`,
    `Application: ${application.reference}`,
    `Product: ${application.snapshot.productName}`,
    `Amount received: ${formatMoney(payment.amount)}`,
    `Method: ${payment.method}`,
    `Payment reference: ${payment.reference}`,
    `Recorded: ${stamp(payment.created_at)}`,
    "",
    "Recorded by the store after confirming receipt of payment.",
  ].join("\n")

  const url = URL.createObjectURL(
    new Blob([body], { type: "text/plain;charset=utf-8" }),
  )
  const link = document.createElement("a")
  link.href = url
  link.download = `AdepaPay-receipt-${payment.id}.txt`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function ApplicationWorkspace({
  view = "applications",
  storeView,
  onBrowse,
  initialRecord = "",
  initialQuery = "",
  onRecordChange,
}: {
  view?: string
  storeView?: string
  initialRecord?: string
  initialQuery?: string
  onRecordChange?: (record: string) => void
  onBrowse?: () => void
}) {
  const [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [reload, setReload] = useState(0)

  const [selected, setSelected] = useState<string | null>(null),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [kind, setKind] = useState(""),
    [page, setPage] = useState(1)

  const [action, setAction] = useState(""),
    [form, setForm] = useState<Record<string, string>>({}),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [actionError, setActionError] = useState(""),
    [notice, setNotice] = useState(""),
    [requestId, setRequestId] = useState(""),
    [actionRevision, setActionRevision] = useState(0)

  const endpoint = storeView
    ? `store/customer-applications/${storeView}`
    : "customer/applications"

  useEffect(() => {
    setData(null)
    setSelected(initialRecord || null)
    setSearch(initialQuery)
    setStatus("")
    setKind("")
    setPage(1)
    setAction("")
    setNotice("")
  }, [endpoint, view])
  useEffect(() => { setSelected(initialRecord || null); setAction(""); setActionError("") }, [initialRecord])
  useEffect(() => { setSearch(initialQuery); setStatus(""); setKind(""); setPage(1) }, [initialQuery])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError("")

    applicationRequest(endpoint)
      .then((result) => {
        if (active) setData(result)
      })
      .catch((error) => {
        if (active) setError(error.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [endpoint, view, reload])

  useEffect(() => {
    const refresh = () => {
      if (!document.hidden) setReload((value) => value + 1)
    }
    const timer = setInterval(refresh, 60000)
    window.addEventListener("focus", refresh)
    window.addEventListener("applications-changed", refresh)
    return () => {
      clearInterval(timer)
      window.removeEventListener("focus", refresh)
      window.removeEventListener("applications-changed", refresh)
    }
  }, [])

  const applications = data?.applications || [],
    payments = data?.payments || [],
    events = data?.events || []

  const current = applications.find((item) => item.id === selected)

  const filtered = applications.filter(
    (item) =>
      (view !== "swap" || item.kind === "swap") &&
      (view !== "layaway" || item.kind === "layaway") &&
      (!["plans", "purchases"].includes(view) ||
        ["Approved", "Completed"].includes(item.status)) &&
      (!status || item.status === status) &&
      (!kind || item.kind === kind) &&
      `${item.reference} ${item.snapshot.productName} ${item.snapshot.storeName} ${item.details.fullName} ${item.details.phone} ${item.details.email} ${["payments", "receipts"].includes(view) ? payments.filter(payment => payment.application_id === item.id).map(payment => `${payment.id} ${payment.reference} ${payment.method}`).join(" ") : ""}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  )

  const ids = new Set(filtered.map((item) => item.id))

  const visiblePayments = payments.filter((item) =>
    ids.has(item.application_id),
  )

  const visibleEvents = events.filter((item) => ids.has(item.application_id))

  const customerRows = Array.from(
    new Map(filtered.map((item) => [item.customer_id, item])).values(),
  )

  const listCount =
    view === "notifications"
      ? visibleEvents.length
      : ["payments", "receipts"].includes(view)
        ? visiblePayments.length
        : view === "customers"
          ? customerRows.length
          : filtered.length

  const pages = Math.max(1, Math.ceil(listCount / 12)),
    safePage = Math.min(page, pages),
    slice = <T,>(rows: T[]) => rows.slice((safePage - 1) * 12, safePage * 12)

  const open = (id: string) => {
    setSelected(id)
    onRecordChange?.(id)
    setAction("")
    setActionError("")
    setNotice("")
  }

  const begin = (value: string, row: Application | undefined = current) => {
    if (!row) return
    setActionRevision(row.revision)
    setAction(value)
    setForm({
      method: "Cash",
      amount: "",
      credit: "",
      price: String(row.snapshot.price),
      reason: "",
      reference: "",
    })
    setConfirmed(false)
    setActionError("")
    setRequestId(crypto.randomUUID())
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!current || busy) return
    setBusy(true)
    setActionError("")

    try {
      await applicationRequest(endpoint, {
        ...form,
        id: current.id,
        revision: actionRevision,
        action,
        requestId,
        confirmedReceived: confirmed,
        deviceReceived: confirmed,
        handoverConfirmed: confirmed,
      })
      setAction("")
      setNotice("Saved. The customer and store records have been updated.")
      setReload((value) => value + 1)
      window.dispatchEvent(new Event("applications-changed"))
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Unable to save. Refresh before retrying.",
      )
    } finally {
      setBusy(false)
    }
  }

  const actionsAllowed =
    !!storeView &&
    ["applications", "layaway", "swap", "purchases"].includes(storeView)

  const balances = applications
    .filter((item) => item.status === "Approved")
    .reduce((sum, item) => sum + Number(item.total) - Number(item.paid), 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {titles[view] || "Applications"}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {storeView
              ? "Applications and confirmed payments belonging to your store."
              : "Track your requests, store decisions and confirmed payments."}
          </p>
        </div>
        <div className="flex gap-2">
          {onBrowse && (
            <button
              className={`${button} bg-blue-600 text-white`}
              onClick={onBrowse}
            >
              Browse products / apply
            </button>
          )}
          <button
            className={button}
            disabled={loading || busy}
            onClick={() => setReload((value) => value + 1)}
          >
            Refresh
          </button>
        </div>
      </div>
      {notice && (
        <p
          role="status"
          className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800"
        >
          {notice}
        </p>
      )}
      {error ? (
        <div role="alert" className="rounded-xl bg-red-50 p-5 text-red-700">
          {error}
          <button
            className={`${button} ml-3`}
            onClick={() => setReload((value) => value + 1)}
          >
            Retry
          </button>
        </div>
      ) : !data ? (
        <p role="status">Loading your records...</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Applications", applications.length],
              [
                "Awaiting review",
                applications.filter((item) =>
                  ["Pending", "Offered"].includes(item.status),
                ).length,
              ],
              [
                "Confirmed payments",
                formatMoney(
                  payments.reduce((sum, item) => sum + Number(item.amount), 0),
                ),
              ],
              ["Active balance", formatMoney(balances)],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-2xl border border-slate-200 bg-white p-5"
              >
                <p className="text-sm text-slate-500">{label}</p>
                <p className="mt-3 text-2xl font-bold">{value}</p>
              </div>
            ))}
          </div>
          {["payments", "receipts", "plans"].includes(view) && (
            <p className="rounded-xl bg-blue-50 p-4 text-sm">
              Arrange payment with the store. Receipts and balances update after
              authorized store staff confirm receipt. No money is charged
              through this page.
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <input
              aria-label="Search applications"
              className={`${input} flex-1 min-w-48`}
              placeholder="Search reference, product, store or customer"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
            />
            <select
              aria-label="Filter status"
              className={`${input} sm:w-auto`}
              value={status}
              onChange={(event) => {
                setStatus(event.target.value)
                setPage(1)
              }}
            >
              <option value="">All statuses</option>
              {[
                "Pending",
                "Offered",
                "Approved",
                "Completed",
                "Rejected",
                "Cancelled",
              ].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
            <select
              aria-label="Filter application type"
              className={`${input} sm:w-auto`}
              value={kind}
              onChange={(event) => {
                setKind(event.target.value)
                setPage(1)
              }}
            >
              <option value="">All types</option>
              {Object.entries(applicationKinds).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-3">
            {["payments", "receipts"].includes(view) ? (
              <>
                {storeView === "payments" && (
                  <details className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                    <summary className="cursor-pointer font-semibold">
                      Record a received payment
                    </summary>
                    <div className="mt-3 space-y-2">
                      {filtered
                        .filter(
                          (item) =>
                            item.status === "Approved" &&
                            Number(item.paid) < Number(item.total),
                        )
                        .map((item) => (
                          <button
                            className={`${button} block w-full bg-white text-left`}
                            key={item.id}
                            onClick={() => {
                              open(item.id)
                              begin("payment", item)
                            }}
                          >
                            {item.reference} · {item.details.fullName} · Balance{" "}
                            {formatMoney(
                              Number(item.total) - Number(item.paid),
                            )}
                          </button>
                        ))}
                      {!filtered.some(
                        (item) =>
                          item.status === "Approved" &&
                          Number(item.paid) < Number(item.total),
                      ) && (
                        <p className="text-sm">
                          No approved applications with an outstanding balance
                          match these filters.
                        </p>
                      )}
                    </div>
                  </details>
                )}
                {slice(visiblePayments).map((payment) => {
                  const item = applications.find(
                    (item) => item.id === payment.application_id,
                  )!
                  return (
                    <div
                      key={payment.id}
                      className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5"
                    >
                      <div>
                        <p className="font-semibold">
                          {formatMoney(payment.amount)} · {payment.method}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {item.reference} · {item.snapshot.productName} ·{" "}
                          {stamp(payment.created_at)}
                        </p>
                        <p className="mt-1 break-all text-xs">
                          Payment reference: {payment.reference}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          className={button}
                          onClick={() => open(item.id)}
                        >
                          View plan
                        </button>
                        <button
                          className={button}
                          onClick={() => downloadReceipt(payment, item)}
                        >
                          Download receipt
                        </button>
                      </div>
                    </div>
                  )
                })}
              </>
            ) : view === "notifications" ? (
              slice(visibleEvents).map((event) => (
                <button
                  key={event.id}
                  className="block w-full rounded-xl border border-slate-200 bg-white p-5 text-left"
                  onClick={() => open(event.application_id)}
                >
                  <p className="font-semibold">{event.message}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    {
                      applications.find(
                        (item) => item.id === event.application_id,
                      )?.reference
                    }{" "}
                    · {stamp(event.created_at)}
                  </p>
                </button>
              ))
            ) : view === "customers" ? (
              slice(customerRows).map((item) => (
                <div
                  key={item.customer_id}
                  className="rounded-xl border border-slate-200 bg-white p-5"
                >
                  <h2 className="font-bold">{item.details.fullName}</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {item.details.email} · {item.details.phone}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {filtered
                      .filter((row) => row.customer_id === item.customer_id)
                      .map((row) => (
                        <button
                          key={row.id}
                          className={button}
                          onClick={() => open(row.id)}
                        >
                          {row.reference} · {row.status}
                        </button>
                      ))}
                  </div>
                </div>
              ))
            ) : (
              slice(filtered).map((item) => (
                <article
                  key={item.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <div className="flex flex-wrap justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold text-blue-700">
                        {item.reference} · {applicationKinds[item.kind]}
                      </p>
                      <h2 className="mt-2 text-lg font-bold">
                        {item.snapshot.productName}
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        {storeView
                          ? item.details.fullName
                          : item.snapshot.storeName}{" "}
                        · {stamp(item.created_at)}
                      </p>
                    </div>
                    <span className="h-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">
                      {item.status}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                    <p className="text-sm">
                      Total {formatMoney(item.total)} · Paid{" "}
                      {formatMoney(item.paid)} · Balance{" "}
                      {formatMoney(Number(item.total) - Number(item.paid))}
                    </p>
                    <button className={button} onClick={() => open(item.id)}>
                      View details
                    </button>
                  </div>
                  {item.offer_expires_at && item.status === "Offered" && (
                    <p className="mt-2 text-sm text-blue-700">
                      Swap offer expires {stamp(item.offer_expires_at)}
                    </p>
                  )}
                </article>
              ))
            )}
            {listCount === 0 && (
              <p className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-500">
                No records match this view yet.
              </p>
            )}
          </div>
          <div className="flex justify-between text-sm">
            <span>
              Page {safePage} of {pages} · {listCount} records
            </span>
            <div className="flex gap-2">
              <button
                className={button}
                disabled={safePage <= 1}
                onClick={() => setPage(safePage - 1)}
              >
                Previous
              </button>
              <button
                className={button}
                disabled={safePage >= pages}
                onClick={() => setPage(safePage + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
      {current && !error && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="record-title"
            className="max-h-[92vh] w-full max-w-4xl space-y-5 overflow-y-auto rounded-3xl bg-white p-6"
          >
            <div className="flex justify-between gap-3">
              <div>
                <h2 id="record-title" className="text-xl font-bold">
                  {current.reference}
                </h2>
                <p className="mt-1 text-sm">
                  {applicationKinds[current.kind]} · {current.status}
                </p>
              </div>
              <button
                className={button}
                disabled={busy}
                onClick={() => { setSelected(null); onRecordChange?.("") }}
              >
                Close
              </button>
            </div>
            <h3 className="font-bold">
              {current.snapshot.productName} · {current.snapshot.storeName}
            </h3>
            <div className="grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-3">
              {[
                ["Total", formatMoney(current.total)],
                ["Deposit required", formatMoney(current.deposit)],
                ["Paid", formatMoney(current.paid)],
                [
                  "Balance",
                  formatMoney(Number(current.total) - Number(current.paid)),
                ],
                ["Swap credit", formatMoney(current.swap_credit)],
                [
                  "Product handover",
                  current.fulfilled ? "Confirmed" : "Awaiting handover",
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="mt-1 font-semibold">{value}</p>
                </div>
              ))}
            </div>
            {current.decision_reason && (
              <p className="rounded-xl bg-blue-50 p-4 text-sm">
                Store response: {current.decision_reason}
              </p>
            )}
            {current.offer_expires_at && current.status === "Offered" && (
              <p className="text-sm">
                Offer expires: {stamp(current.offer_expires_at)}
              </p>
            )}
            <details className="rounded-xl border border-slate-200 p-4">
              <summary className="cursor-pointer font-semibold">
                Application and accepted terms
              </summary>
              <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                {Object.entries(current.details)
                  .filter(
                    ([key, value]) =>
                      !["documents", "guarantors"].includes(key) &&
                      typeof value !== "object",
                  )
                  .map(([key, value]) => (
                    <p className="break-words" key={key}>
                      <span className="font-semibold capitalize">
                        {key.replace(/([A-Z])/g, " $1")}:{" "}
                      </span>
                      {String(value)}
                    </p>
                  ))}
              </div>
              {current.details.guarantors?.map((person, index) => (
                <p key={index} className="mt-3 text-sm">
                  Guarantor {index + 1}: {Object.values(person).join(" · ")}
                </p>
              ))}
              {(!storeView || actionsAllowed) && (
                <div className="mt-4 flex flex-wrap gap-3">
                  {Object.entries(current.details.documents || {}).map(
                    ([slot, image]) => (
                      <a
                        key={slot}
                        href={
                          image.url + (storeView ? `&view=${storeView}` : "")
                        }
                        target="_blank"
                        rel="noreferrer"
                        className={button}
                      >
                        View{" "}
                        {slot === "front"
                          ? "Ghana Card front"
                          : slot === "back"
                            ? "Ghana Card back"
                            : "device photo"}
                      </a>
                    ),
                  )}
                </div>
              )}
              <p className="mt-4 text-sm">
                Application price: {formatMoney(current.snapshot.price)}. Requested
                plan: {current.terms.months} month(s), {current.terms.frequency}
                . Terms version {current.snapshot.rulesRevision}.
              </p>
              <ApplicationTerms
                rules={current.snapshot.rules}
                layaway={current.snapshot.layaway}
                swap={current.snapshot.swap}
              />
            </details>
            {!!current.schedule.length && (
              <details open className="rounded-xl border border-slate-200 p-4">
                <summary className="cursor-pointer font-semibold">
                  Payment schedule
                </summary>
                <div className="mt-3 max-h-72 overflow-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr>
                        <th className="py-2">Due date</th>
                        <th>Installment</th>
                        <th>Amount</th>
                        <th>Unpaid</th>
                      </tr>
                    </thead>
                    <tbody>
                      {current.schedule.map((item, index) => (
                        <tr key={index} className="border-t border-slate-100">
                          <td className="py-2">{item.date}</td>
                          <td>{item.label}</td>
                          <td>{formatMoney(item.amount)}</td>
                          <td>{formatMoney(item.remaining)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  Payments are allocated to the earliest unpaid installment.
                  Late charges are not automatically added.
                </p>
              </details>
            )}
            {payments
              .filter((item) => item.application_id === current.id)
              .map((payment) => (
                <div
                  key={payment.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 text-sm"
                >
                  <span>
                    {formatMoney(payment.amount)} · {payment.method} ·{" "}
                    {stamp(payment.created_at)}
                  </span>
                  <button
                    className={button}
                    onClick={() => downloadReceipt(payment, current)}
                  >
                    Receipt
                  </button>
                </div>
              ))}
            {!storeView && current.status === "Completed" && <PurchaseRating key={current.id} application={current.id} />}
            {current.snapshot.originalPrice !== undefined && <p className="text-sm text-slate-600">Originally requested price: {formatMoney(current.snapshot.originalPrice)}. Current application price: {formatMoney(current.snapshot.price)}.</p>}
            {!action && (
              <div className="flex flex-wrap gap-3">
                {actionsAllowed && ["Pending", "Offered"].includes(current.status) && Number(current.paid) === 0 && !current.fulfilled && <button className={button} onClick={() => begin("adjust_price")}>Change price for this customer</button>}
                {actionsAllowed &&
                  current.status === "Pending" &&
                  current.kind !== "swap" && (
                    <button
                      className={`${button} bg-emerald-600 text-white`}
                      onClick={() => begin("approve")}
                    >
                      Approve application
                    </button>
                  )}
                {actionsAllowed &&
                  ["Pending", "Offered"].includes(current.status) &&
                  current.kind === "swap" && (
                    <button
                      className={`${button} bg-blue-600 text-white`}
                      onClick={() => begin("offer")}
                    >
                      Send swap offer
                    </button>
                  )}
                {actionsAllowed &&
                  ["Pending", "Offered"].includes(current.status) && (
                    <button className={button} onClick={() => begin("reject")}>
                      Reject
                    </button>
                  )}
                {!storeView &&
                  current.status === "Offered" &&
                  current.offer_expires_at &&
                  new Date(current.offer_expires_at) > new Date() && (
                    <button
                      className={`${button} bg-blue-600 text-white`}
                      onClick={() => begin("accept")}
                    >
                      Accept swap offer
                    </button>
                  )}
                {(!storeView || actionsAllowed) &&
                  ["Pending", "Offered", "Approved"].includes(current.status) &&
                  Number(current.paid) === 0 &&
                  !current.fulfilled && (
                    <button className={button} onClick={() => begin("cancel")}>
                      Cancel application
                    </button>
                  )}
                {storeView === "payments" &&
                  current.status === "Approved" &&
                  Number(current.paid) < Number(current.total) && (
                    <button
                      className={`${button} bg-blue-600 text-white`}
                      onClick={() => begin("payment")}
                    >
                      Record received payment
                    </button>
                  )}
                {actionsAllowed &&
                  current.status === "Approved" &&
                  !current.fulfilled &&
                  Number(current.paid) >=
                    Number(
                      current.kind === "hire_purchase"
                        ? current.deposit
                        : current.total,
                    ) && (
                    <button
                      className={`${button} bg-blue-600 text-white`}
                      onClick={() => begin("fulfill")}
                    >
                      Confirm product handover
                    </button>
                  )}
              </div>
            )}
            {action && (
              <form
                onSubmit={submit}
                className="space-y-4 rounded-xl border border-blue-200 bg-blue-50 p-5"
              >
                <h3 className="font-bold">
                  {
                    ({
                      adjust_price: "Change this customer application price",
                      approve: "Approve and reserve one unit",
                      reject: "Reject application",
                      offer: "Send a swap offer",
                      accept: "Accept offer and reserve product",
                      cancel: "Cancel this application",
                      payment: "Record payment received",
                      fulfill: "Confirm completed product handover",
                    } as Record<string, string>)[action]
                  }
                </h3>
                <fieldset disabled={busy} className="space-y-4">
                  {["offer", "reject", "adjust_price"].includes(action) && (
                    <label className="block text-sm">
                      Message / reason
                      <textarea
                        required
                        minLength={3}
                        maxLength={1000}
                        className={`${input} mt-2`}
                        value={form.reason}
                        onChange={(event) =>
                          setForm({ ...form, reason: event.target.value })
                        }
                      />
                    </label>
                  )}
                  {action === "adjust_price" && <div className="space-y-3"><p className="text-sm text-slate-600">This changes only this application. The product listing and other customers keep their prices. The deposit keeps the same percentage and instalments are recalculated. For swaps, any previous offer is withdrawn and you must send a new offer.</p><label className="block text-sm">Product price for this customer (GHS)<input required type="number" min=".01" max="9999999999.99" step=".01" className={`${input} mt-2`} value={form.price} onChange={event => setForm({ ...form, price: event.target.value })} /></label></div>}
                  {action === "offer" && (
                    <label className="block text-sm">
                      Trade-in credit (GHS)
                      <input
                        required
                        type="number"
                        min="0"
                        max={current.snapshot.price}
                        step=".01"
                        className={`${input} mt-2`}
                        value={form.credit}
                        onChange={(event) =>
                          setForm({ ...form, credit: event.target.value })
                        }
                      />
                      <span className="mt-2 block">
                        Customer balance:{" "}
                        {formatMoney(
                          Number(current.snapshot.price) -
                            Number(form.credit || 0),
                        )}
                      </span>
                    </label>
                  )}
                  {action === "payment" && (
                    <>
                      <label className="block text-sm">
                        Amount received (GHS)
                        <input
                          required
                          type="number"
                          min=".01"
                          max={Number(current.total) - Number(current.paid)}
                          step=".01"
                          className={`${input} mt-2`}
                          value={form.amount}
                          onChange={(event) =>
                            setForm({ ...form, amount: event.target.value })
                          }
                        />
                      </label>
                      <select
                        aria-label="Payment method"
                        className={input}
                        value={form.method}
                        onChange={(event) =>
                          setForm({ ...form, method: event.target.value })
                        }
                      >
                        {["Cash", "Mobile Money", "Bank Transfer"].map(
                          (value) => (
                            <option key={value}>{value}</option>
                          ),
                        )}
                      </select>
                      <label className="block text-sm">
                        Transaction / cash receipt reference
                        <input
                          required
                          maxLength={100}
                          className={`${input} mt-2`}
                          value={form.reference}
                          onChange={(event) =>
                            setForm({ ...form, reference: event.target.value })
                          }
                        />
                      </label>
                      <label className="flex gap-2 text-sm">
                        <input
                          required
                          type="checkbox"
                          checked={confirmed}
                          onChange={(event) =>
                            setConfirmed(event.target.checked)
                          }
                        />
                        I have verified that the store received this payment.
                      </label>
                    </>
                  )}
                  {action === "accept" && (
                    <p className="text-sm">
                      You accept a trade-in credit of{" "}
                      {formatMoney(current.swap_credit)} and a balance of{" "}
                      {formatMoney(current.total)}. The store must receive your
                      device and payment before completing the exchange.
                    </p>
                  )}
                  {action === "fulfill" && (
                    <label className="flex gap-2 text-sm">
                      <input
                        required
                        type="checkbox"
                        checked={confirmed}
                        onChange={(event) => setConfirmed(event.target.checked)}
                      />
                      {current.kind === "swap"
                        ? "The store has received and inspected the trade-in device, and handed over the replacement."
                        : "The product has been handed over to this customer."}
                    </label>
                  )}
                  {action === "cancel" && (
                    <p className="text-sm">
                      This closes the unpaid application and releases any
                      reserved stock.
                    </p>
                  )}
                  {actionError && (
                    <p role="alert" className="text-sm text-red-700">
                      {actionError}
                    </p>
                  )}
                  <div className="flex gap-3">
                    <button className={`${button} bg-blue-600 text-white`}>
                      {busy ? "Saving..." : "Confirm"}
                    </button>
                    <button
                      type="button"
                      className={button}
                      onClick={() => setAction("")}
                    >
                      Back
                    </button>
                  </div>
                </fieldset>
              </form>
            )}
            <details className="rounded-xl border border-slate-200 p-4">
              <summary className="cursor-pointer font-semibold">
                Activity history
              </summary>
              <div className="mt-3 space-y-3">
                {events
                  .filter((event) => event.application_id === current.id)
                  .map((event) => (
                    <p key={event.id} className="text-sm">
                      {event.message}
                      <span className="mt-1 block text-xs text-slate-500">
                        {stamp(event.created_at)}
                      </span>
                    </p>
                  ))}
              </div>
            </details>
          </div>
        </div>
      )}
    </div>
  )
}

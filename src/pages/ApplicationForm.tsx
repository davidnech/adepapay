import ApplicationTerms from "./ApplicationTerms"

import { useEffect, useState, type FormEvent } from "react"

import uploadImage, {
  type UploadedImage,
  type UploadProgress,
} from "../lib/imageUploader"

import {
  applicationRequest,
  applicationKinds,
  ApplicationError,
  formatMoney,
  type ApplicationKind,
} from "../lib/applicationsApi"

type Quote = {
  token: string
  productName: string
  storeName: string
  price: number
  minimumDeposit: number
  minMonths: number
  maxMonths: number
  frequencies: string[]
  guarantorsRequired: boolean
  rules: Record<string, unknown>
  layaway: Record<string, unknown>
  swap: Record<string, unknown>
}

const button =
  "rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold disabled:opacity-50"

const input =
  "mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm"

export default function ApplicationForm({
  productId,
  kind,
  onClose,
  onSubmitted,
  onLogin,
}: {
  productId: string
  kind: ApplicationKind
  onClose: () => void
  onSubmitted: () => void
  onLogin?: () => void
}) {
  const [quote, setQuote] = useState<Quote | null>(null)

  const [form, setForm] = useState<Record<string, string>>({
    fullName: "",
    phone: "",
    address: "",
    ghanaCard: "",
    employment: "",
    monthlyIncome: "",
    deliveryNote: "",
    months: "",
    deposit: "",
    frequency: "Monthly",
    device: "",
    serial: "",
    deviceCondition: "Good",
  })

  const [guarantors, setGuarantors] = useState([
    { name: "", phone: "", relationship: "", address: "" },
    { name: "", phone: "", relationship: "", address: "" },
  ])

  const [documents, setDocuments] = useState<Record<string, UploadedImage>>({})

  const [accepted, setAccepted] = useState(false)

  const [consent, setConsent] = useState(false)

  const [error, setError] = useState("")

  const [needLogin, setNeedLogin] = useState(false)

  const [saving, setSaving] = useState(false)

  const [uploading, setUploading] = useState("")

  const [progress, setProgress] = useState<UploadProgress>({
    percent: 0,
    phase: "uploading",
  })

  const [requestId] = useState(() => crypto.randomUUID())

  const [reload, setReload] = useState(0)

  useEffect(() => {
    let active = true
    setError("")
    setQuote(null)
    setAccepted(false)

    Promise.all([
      applicationRequest(
        `customer/quote?product=${encodeURIComponent(productId)}&kind=${kind}`,
      ),
      applicationRequest("customer/account"),
    ])
      .then(([result, account]) => {
        if (!active) return

        setQuote(result.quote)
        setNeedLogin(false)

        setForm((current) => ({
          ...current,
          fullName:
            current.fullName ||
            [account.account.firstName, account.account.lastName]
              .filter(Boolean)
              .join(" "),
          phone: current.phone || account.account.phone,
          address: current.address || account.account.address,
          months: String(result.quote.minMonths),
          deposit: String(result.quote.minimumDeposit),
          frequency: result.quote.frequencies[0],
        }))
      })
      .catch((error) => {
        if (active) {
          setError(error.message)
          setNeedLogin(
            error instanceof ApplicationError && error.status === 401,
          )
        }
      })

    return () => {
      active = false
    }
  }, [productId, kind, reload])

  const busy = saving || !!uploading

  const upload = async (slot: string, file?: File) => {
    if (!file || busy) return
    setUploading(slot)
    setError("")
    setProgress({ percent: 0, phase: "uploading" })

    try {
      const image = await uploadImage(file, setProgress, "customer-application")
      setDocuments((current) => ({ ...current, [slot]: image }))
    } catch (error) {
      setError(error instanceof Error ? error.message : "Upload failed.")
    } finally {
      setUploading("")
    }
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy || !quote) return
    setSaving(true)
    setError("")

    try {
      await applicationRequest("customer/applications", {
        ...form,
        action: "submit",
        productId,
        kind,
        requestId,
        expectedPrice: quote.price,
        quoteToken: quote.token,
        documents,
        guarantors,
        acceptedTerms: accepted,
        guarantorConsent: consent,
      })
      onSubmitted()
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to submit.")
    } finally {
      setSaving(false)
    }
  }

  const field = (
    key: string,
    label: string,
    type = "text",
    required = true,
  ) => (
    <label key={key} className="text-sm font-semibold">
      {label}
      <input
        required={required}
        type={type}
        min={type === "number" ? 0 : undefined}
        step={type === "number" ? ".01" : undefined}
        maxLength={300}
        value={form[key] || ""}
        onChange={(event) => setForm({ ...form, [key]: event.target.value })}
        className={input}
      />
    </label>
  )

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/60 p-4">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="application-title"
        onSubmit={submit}
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6"
      >
        <div className="flex justify-between gap-3">
          <h2 id="application-title" className="text-xl font-bold">
            Apply for {applicationKinds[kind]}
          </h2>
          <button
            type="button"
            disabled={busy}
            className={button}
            onClick={onClose}
          >
            Close
          </button>
        </div>
        {error && (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
          </p>
        )}
        {needLogin && onLogin && (
          <button type="button" className={`${button} mt-4`} onClick={onLogin}>
            Sign in to apply
          </button>
        )}
        {!quote && !error && (
          <p role="status" className="mt-5">
            Loading the store's current terms...
          </p>
        )}
        {error && (
          <button
            type="button"
            disabled={busy}
            className={`${button} mt-3`}
            onClick={() => setReload((value) => value + 1)}
          >
            Reload quote
          </button>
        )}
        {quote && (
          <fieldset disabled={busy} className="mt-5 space-y-6">
            <div className="rounded-xl bg-blue-50 p-4">
              <h3 className="font-bold">{quote.productName}</h3>
              <p className="text-sm">
                {quote.storeName} · {applicationKinds[kind]} price: {formatMoney(quote.price)}
              </p>
              <p className="mt-2 text-xs text-slate-600">
                One product per application. Submission does not take payment or
                reserve stock. Stock is reserved when approved
                {kind === "swap" ? " and the offer is accepted" : ""}.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {field("fullName", "Full name")}
              {field("phone", "Phone")}
              {field("address", "Residential address")}
              {field("ghanaCard", "Ghana Card number")}
              {field("deliveryNote", "Delivery / pickup note", "text", false)}
              {kind === "hire_purchase" && (
                <>
                  {field("employment", "Employment / source of income")}
                  {field("monthlyIncome", "Monthly income (GHS)", "number")}
                </>
              )}
            </div>
            {kind === "swap" ? (
              <section className="space-y-4">
                <h3 className="font-bold">Your trade-in device</h3>
                <p className="text-sm text-slate-500">{`Accepted devices: ${quote.swap.categories}. Minimum condition: ${quote.swap.minimumCondition}. ${quote.swap.instructions || "The store will assess your device before making an offer."}`}</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  {field("device", "Device / model")}
                  {field("serial", "Serial number / IMEI")}
                  <label className="text-sm font-semibold">
                    Condition
                    <select
                      value={form.deviceCondition}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          deviceCondition: event.target.value,
                        })
                      }
                      className={input}
                    >
                      {[
                        "Like New",
                        "Excellent",
                        "Good",
                        "Fair",
                        "Needs Repair",
                      ].map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </section>
            ) : (
              <section>
                <h3 className="font-bold">Requested payment plan</h3>
                <div className="mt-3 grid gap-4 sm:grid-cols-3">
                  <label className="text-sm font-semibold">
                    Deposit (GHS)
                    <input
                      required
                      type="number"
                      min={quote.minimumDeposit}
                      max={quote.price}
                      step=".01"
                      value={form.deposit}
                      onChange={(event) =>
                        setForm({ ...form, deposit: event.target.value })
                      }
                      className={input}
                    />
                  </label>
                  <label className="text-sm font-semibold">
                    Duration (months)
                    <input
                      required
                      type="number"
                      min={quote.minMonths}
                      max={quote.maxMonths}
                      value={form.months}
                      onChange={(event) =>
                        setForm({ ...form, months: event.target.value })
                      }
                      className={input}
                    />
                  </label>
                  <label className="text-sm font-semibold">
                    Frequency
                    <select
                      value={form.frequency}
                      onChange={(event) =>
                        setForm({ ...form, frequency: event.target.value })
                      }
                      className={input}
                    >
                      {quote.frequencies.map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  Balance:{" "}
                  {formatMoney(
                    Math.max(0, quote.price - Number(form.deposit || 0)),
                  )}
                  . The schedule starts on approval. Weekly plans use four
                  payments per month; daily plans use thirty. No additional
                  interest or automatic late charges are added by this
                  application.
                </p>
              </section>
            )}
            {quote.guarantorsRequired && (
              <section className="space-y-4">
                <h3 className="font-bold">
                  Two guarantors required by the store
                </h3>
                {guarantors.map((guarantor, index) => (
                  <div
                    key={index}
                    className="grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-2"
                  >
                    {Object.keys(guarantor).map((key) => (
                      <label
                        key={key}
                        className="text-sm font-semibold capitalize"
                      >
                        Guarantor {index + 1}: {key}
                        <input
                          required
                          maxLength={300}
                          value={guarantor[(key as keyof typeof guarantor)]}
                          onChange={(event) =>
                            setGuarantors((items) =>
                              items.map((item, i) =>
                                i === index
                                  ? { ...item, [key]: event.target.value }
                                  : item,
                              ),
                            )
                          }
                          className={input}
                        />
                      </label>
                    ))}
                  </div>
                ))}
                <label className="flex gap-3 text-sm">
                  <input
                    required
                    type="checkbox"
                    checked={consent}
                    onChange={(event) => setConsent(event.target.checked)}
                  />
                  My guarantors consent to sharing these details with the store.
                </label>
              </section>
            )}
            <section>
              <h3 className="font-bold">Private documents</h3>
              <p className="mt-1 text-xs text-slate-500">
                Only you and authorized staff at the receiving store can view
                these application images.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {[
                  ["front", "Ghana Card front"],
                  ["back", "Ghana Card back"],
                  ...(kind === "swap" ? [["devicePhoto", "Device photo"]] : []),
                ].map(([slot, label]) => (
                  <div
                    key={slot}
                    className="rounded-xl border border-slate-200 p-3"
                  >
                    <p className="text-sm font-semibold">{label}</p>
                    {documents[slot] && (
                      <img
                        src={documents[slot].url}
                        alt={label}
                        className="mt-2 h-28 w-full object-contain"
                      />
                    )}
                    <label
                      className={`${button} mt-2 block cursor-pointer border-2 border-blue-300 text-center`}
                    >
                      Upload image
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0]
                          event.target.value = ""
                          void upload(slot, file)
                        }}
                      />
                    </label>
                  </div>
                ))}
              </div>
            </section>
            <details className="rounded-xl border border-slate-200 p-4">
              <summary className="cursor-pointer font-semibold">
                Review store terms
              </summary>
              <ApplicationTerms
                rules={quote.rules}
                layaway={quote.layaway}
                swap={quote.swap}
              />
            </details>
            <label className="flex gap-3 text-sm">
              <input
                required
                type="checkbox"
                checked={accepted}
                onChange={(event) => setAccepted(event.target.checked)}
              />
              I confirm these details are accurate and accept the product price,
              requested plan and store terms.
            </label>
            <button className={`${button} w-full bg-blue-600 text-white`}>
              {saving ? "Submitting..." : "Submit application"}
            </button>
          </fieldset>
        )}
        {uploading && (
          <div role="status" className="mt-4 rounded-xl bg-blue-50 p-4 text-sm">
            {progress.phase === "processing"
              ? "Processing image..."
              : `Uploading ${progress.percent ?? 0}%`}
            <progress
              max={100}
              value={
                progress.phase === "uploading"
                  ? (progress.percent ?? undefined)
                  : undefined
              }
              className="mt-2 w-full"
            />
          </div>
        )}
      </form>
    </div>
  )
}

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"

export type SwapStatus = "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "MORE_INFORMATION_REQUIRED" | "INSPECTION_REQUIRED" | "OFFER_SENT" | "AWAITING_PAYMENT" | "READY_FOR_EXCHANGE" | "COMPLETED" | "REJECTED" | "DECLINED" | "CANCELLED" | "EXPIRED"

type SwapOffer = {
  version: number
  replacementPrice: number
  credit: number
  fees: number
  payable: number
  expiresAt: string
  note: string
}

type SwapDocumentRequest = {
  id: string
  title: string
  note: string
  requestedAt: string
  fileName?: string
  status: "Requested" | "Uploaded"
}

export type SwapApplication = {
  id: string
  customer: string
  customerPhone: string
  store: string
  product: string
  productPrice: number
  device: string
  category: string
  condition: string
  identifier: string
  submittedAt: string
  status: SwapStatus
  photos: string[]
  proofOfPurchase?: string
  ownership: boolean
  lawfulOwnership: boolean
  financing: boolean
  inspection: "Pending" | "Passed" | "Needs Attention" | "Rejected"
  payment: "Not required" | "Unpaid" | "Paid" | "Failed"
  custody: "Not received" | "Received" | "Handed over"
  offer?: SwapOffer
  request?: string
  documentRequests?: SwapDocumentRequest[]
  timeline: string[]
  customerAcknowledged?: boolean
  replacementHandedOver?: boolean
}

type SwapInventoryItem = {
  id: string
  applicationId: string
  device: string
  condition: string
  value: number
  status: "HELD_FOR_SWAP" | "AVAILABLE" | "RESOLD" | "RETURNED" | "DISPOSED"
  receivedAt: string
}

type SwapSettings = {
  enabled: boolean
  categories: string
  minimumCondition: string
  instructions: string
  validityDays: number
  feeName: string
  feeAmount: number
}

type SwapData = {
  applications: SwapApplication[]
  inventory: SwapInventoryItem[]
  settings: SwapSettings
  notifications: string[]
}

const STORAGE_KEY = "adepapay.swap.demo.v2"
const statuses: Record<SwapStatus, { label: string tone: string }> = {
  DRAFT: { label: "Draft", tone: "bg-slate-100 text-slate-700" },
  SUBMITTED: { label: "Submitted", tone: "bg-blue-50 text-blue-700" },
  UNDER_REVIEW: { label: "Under review", tone: "bg-amber-50 text-amber-700" },
  MORE_INFORMATION_REQUIRED: {
    label: "Information requested",
    tone: "bg-violet-50 text-violet-700",
  },
  INSPECTION_REQUIRED: {
    label: "Inspection required",
    tone: "bg-amber-50 text-amber-700",
  },
  OFFER_SENT: { label: "Offer sent", tone: "bg-indigo-50 text-indigo-700" },
  AWAITING_PAYMENT: {
    label: "Awaiting payment",
    tone: "bg-orange-50 text-orange-700",
  },
  READY_FOR_EXCHANGE: {
    label: "Ready for exchange",
    tone: "bg-emerald-50 text-emerald-700",
  },
  COMPLETED: { label: "Completed", tone: "bg-emerald-100 text-emerald-800" },
  REJECTED: { label: "Rejected", tone: "bg-red-50 text-red-700" },
  DECLINED: { label: "Declined", tone: "bg-slate-100 text-slate-700" },
  CANCELLED: { label: "Cancelled", tone: "bg-slate-100 text-slate-700" },
  EXPIRED: { label: "Expired", tone: "bg-red-50 text-red-700" },
}

const money = (value: number) =>
  new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    minimumFractionDigits: 2,
  }).format(value)

const seedApplication = (
  id: string,
  status: SwapStatus,
  device: string,
  product: string,
  price: number,
  offer?: Partial<SwapOffer>,
): SwapApplication => {
  const issuedOffer = offer
    ? {
        version: 1,
        replacementPrice: price,
        credit: 2800,
        fees: 0,
        payable: price - 2800,
        expiresAt: new Date(Date.now() + 6 * 86400000).toISOString(),
        note: "Final credit follows a physical inspection at CYTECH Gadgets.",
        ...offer,
      }
    : undefined
  return {
    id,
    customer: "Emmanuel Agyeman",
    customerPhone: "+233 24 555 0182",
    store: "CYTECH Gadgets",
    product,
    productPrice: price,
    device,
    category: "Phone",
    condition: "Good",
    identifier: "DEMO-IMEI-8821",
    submittedAt: "August 28, 2026",
    status,
    photos: ["Front device photo", "Back device photo"],
    proofOfPurchase: id.endsWith("102")
      ? "Original purchase receipt.pdf"
      : undefined,
    ownership: true,
    lawfulOwnership: true,
    financing: false,
    inspection:
      status === "OFFER_SENT" ||
      status === "AWAITING_PAYMENT" ||
      status === "READY_FOR_EXCHANGE" ||
      status === "COMPLETED"
        ? "Passed"
        : "Pending",
    payment:
      status === "READY_FOR_EXCHANGE" || status === "COMPLETED"
        ? "Paid"
        : issuedOffer
          ? "Unpaid"
          : "Not required",
    custody: status === "COMPLETED" ? "Handed over" : "Not received",
    offer: issuedOffer,
    documentRequests:
      status === "MORE_INFORMATION_REQUIRED"
        ? [
            {
              id: `DOC-${id}`,
              title: "Device finance clearance letter",
              note: "Please confirm that any previous device financing has been fully settled.",
              requestedAt: "2026-08-29T10:00:00.000Z",
              status: "Requested",
            },
          ]
        : [],
    timeline: ["Application created", `Status: ${statuses[status].label}`],
  }
}

const defaultData = (): SwapData => ({
  applications: [
    seedApplication(
      "SWA-2026-00101",
      "DRAFT",
      "iPhone 13 Pro 256GB",
      "Samsung Galaxy S25",
      9450,
    ),
    seedApplication(
      "SWA-2026-00102",
      "SUBMITTED",
      "Samsung Galaxy S22",
      "MacBook Pro 14-inch M3",
      18500,
    ),
    seedApplication(
      "SWA-2026-00103",
      "UNDER_REVIEW",
      "iPhone 14",
      "Samsung Galaxy S25",
      9450,
    ),
    seedApplication(
      "SWA-2026-00104",
      "MORE_INFORMATION_REQUIRED",
      "Tecno Camon 20",
      "Samsung Galaxy S25",
      9450,
    ),
    seedApplication(
      "SWA-2026-00105",
      "INSPECTION_REQUIRED",
      "iPhone 12 Pro",
      "MacBook Pro 14-inch M3",
      18500,
    ),
    seedApplication(
      "SWA-2026-00106",
      "OFFER_SENT",
      "Samsung Galaxy S23",
      "Samsung Galaxy S25",
      9450,
    ),
    seedApplication(
      "SWA-2026-00107",
      "AWAITING_PAYMENT",
      "iPhone 13",
      "Samsung Galaxy S25",
      9450,
    ),
    seedApplication(
      "SWA-2026-00108",
      "READY_FOR_EXCHANGE",
      "iPhone 14 Pro",
      "MacBook Pro 14-inch M3",
      18500,
    ),
    seedApplication(
      "SWA-2026-00109",
      "COMPLETED",
      "Samsung Galaxy S22 Ultra",
      "Samsung Galaxy S25",
      9450,
    ),
    seedApplication(
      "SWA-2026-00110",
      "REJECTED",
      "Infinix Hot 12",
      "Samsung Galaxy S25",
      9450,
    ),
    seedApplication(
      "SWA-2026-00111",
      "DECLINED",
      "iPhone 11",
      "Samsung Galaxy S25",
      9450,
    ),
    seedApplication(
      "SWA-2026-00112",
      "CANCELLED",
      "Samsung Galaxy A52",
      "Samsung Galaxy S25",
      9450,
    ),
    seedApplication(
      "SWA-2026-00113",
      "EXPIRED",
      "iPhone 12",
      "Samsung Galaxy S25",
      9450,
    ),
  ],
  inventory: [
    {
      id: "STI-2026-0009",
      applicationId: "SWA-2026-00109",
      device: "Samsung Galaxy S22 Ultra",
      condition: "Good",
      value: 2800,
      status: "AVAILABLE",
      receivedAt: "August 20, 2026",
    },
  ],
  settings: {
    enabled: true,
    categories: "Phones, Tablets, Laptops",
    minimumCondition: "Fair",
    instructions:
      "Bring the device, a valid ID, and remove all linked accounts before inspection.",
    validityDays: 7,
    feeName: "",
    feeAmount: 0,
  },
  notifications: ["Swap offer SWA-2026-00106 is awaiting your response."],
})

type SwapContextValue = {
  data: SwapData
  reset: () => void
  createApplication: (
    input: Pick<SwapApplication, "device" | "category" | "condition" | "identifier" | "photos" | "proofOfPurchase" | "ownership" | "lawfulOwnership" | "financing">,
  ) => void
  update: (id: string, patch: Partial<SwapApplication>, event: string) => void
  saveSettings: (settings: SwapSettings) => void
}

const SwapContext = createContext<SwapContextValue | null>(null)

export function SwapDemoProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<SwapData>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) as SwapData : defaultData()
    } catch {
      return defaultData()
    }
  })
  useEffect(
    () => localStorage.setItem(STORAGE_KEY, JSON.stringify(data)),
    [data],
  )
  const update = (id: string, patch: Partial<SwapApplication>, event: string) =>
    setData((current) => ({
      ...current,
      notifications: [event, ...current.notifications].slice(0, 20),
      applications: current.applications.map((item) =>
        item.id === id
          ? { ...item, ...patch, timeline: [...item.timeline, event] }
          : item,
      ),
    }))
  const createApplication: SwapContextValue["createApplication"] = (input) => {
    const id = `SWA-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`
    const application: SwapApplication = {
      ...seedApplication(
        id,
        "SUBMITTED",
        input.device,
        "Samsung Galaxy S25",
        9450,
      ),
      ...input,
      submittedAt: new Date().toLocaleDateString("en-GH", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
      timeline: ["Draft submitted by customer", "Awaiting store review"],
    }
    setData((current) => ({
      ...current,
      applications: [application, ...current.applications],
      notifications: [
        `New Swap application ${id} submitted to CYTECH Gadgets.`,
        ...current.notifications,
      ],
    }))
  }
  return (
    <SwapContext.Provider
      value={{
        data,
        reset: () => setData(defaultData()),
        createApplication,
        update,
        saveSettings: (settings) =>
          setData((current) => ({ ...current, settings })),
      }}
    >
      {children}
    </SwapContext.Provider>
  )
}

const useSwap = () => {
  const context = useContext(SwapContext)
  if (!context) throw new Error("SwapDemoProvider is required")
  return context
}

function StatusBadge({ status }: { status: SwapStatus }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-[11px] font-bold ${statuses[status].tone}`}
    >
      {statuses[status].label}
    </span>
  )
}

function PageTitle({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-2xl font-bold text-slate-950">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      {action}
    </div>
  )
}

const button =
  "rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-45"
const secondary =
  "rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
const input =
  "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"

export function SwapApplicationPage({
  onNavigate,
}: {
  onNavigate: (page: string) => void
}) {
  const { data, createApplication } = useSwap()
  const [step, setStep] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState({
    category: "Phone",
    brand: "",
    model: "",
    storage: "",
    colour: "",
    identifier: "",
    condition: "Good",
    front: "",
    back: "",
    proofOfPurchase: "",
    ownership: false,
    lawfulOwnership: false,
    financing: false,
    accountsRemoved: false,
    terms: false,
  })
  const next = () => {
    if (step === 1 && (!form.brand || !form.model || !form.identifier)) return
    if (
      step === 2 &&
      (!form.front ||
        !form.back ||
        !form.ownership ||
        !form.lawfulOwnership ||
        !form.accountsRemoved)
    )
      return
    if (step === 3) {
      if (!form.terms) return
      createApplication({
        device: `${form.brand} ${form.model}`,
        category: form.category,
        condition: form.condition,
        identifier: form.identifier,
        photos: [form.front, form.back],
        proofOfPurchase: form.proofOfPurchase || undefined,
        ownership: form.ownership,
        lawfulOwnership: form.lawfulOwnership,
        financing: form.financing,
      })
      setSubmitted(true)
      return
    }
    setStep((value) => value + 1)
  }
  if (submitted)
    return (
      <div className="rounded-[28px] border border-emerald-200 bg-emerald-50 p-8 text-center">
        <h2 className="text-2xl font-bold text-emerald-900">
          Swap application submitted
        </h2>
        <p className="mt-3 text-sm text-emerald-800">
          The store will review your device and arrange physical inspection
          before issuing any offer.
        </p>
        <button
          onClick={() => onNavigate("my-swaps")}
          className={`${button} mt-6`}
        >
          View My Swaps
        </button>
      </div>
    )
  const steps = ["Product", "Your device", "Photos & ownership", "Review"]
  return (
    <div className="space-y-6">
      <PageTitle
        title="Apply for Swap"
        description="Trade in your device toward an eligible product. No payment is taken at this stage."
      />
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
        <div className="flex gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-100 text-lg">
            ⚠
          </span>
          <div>
            <div className="font-black">Stolen products are strictly prohibited</div>
            <p className="mt-1 text-xs leading-5 text-red-800">
              Do not submit a stolen, fraudulently obtained, or unauthorized product.
              Device identifiers and ownership documents may be verified, and suspicious
              applications may be rejected or referred to the appropriate authorities.
            </p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {steps.map((label, index) => (
          <div
            key={label}
            className={`rounded-xl px-2 py-3 text-center text-xs font-bold ${
              index === step
                ? "bg-blue-600 text-white"
                : index < step
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-slate-100 text-slate-500"
            }`}
          >
            {index + 1}. {label}
          </div>
        ))}
      </div>
      <div className="rounded-[28px] border border-slate-200 bg-white p-5 sm:p-7">
        {step === 0 && (
          <div className="grid gap-6 md:grid-cols-[180px_1fr]">
            <img
              src="https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=420&h=340&fit=crop&auto=format"
              alt="Samsung Galaxy S25"
              className="h-44 w-full rounded-2xl object-cover"
            />
            <div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                Swap Available
              </span>
              <h3 className="mt-3 text-xl font-bold">Samsung Galaxy S25</h3>
              <p className="mt-1 text-sm text-slate-500">
                CYTECH Gadgets · {money(9450)}
              </p>
              <div className="mt-5 rounded-2xl bg-blue-50 p-4 text-sm text-blue-900">
                <b>Accepted devices:</b> {data.settings.categories}. Minimum
                condition: {data.settings.minimumCondition}. Final trade-in
                value is confirmed by the store after physical inspection.
              </div>
              <p className="mt-4 text-sm text-slate-600">
                {data.settings.instructions}
              </p>
            </div>
          </div>
        )}
        {step === 1 && (
          <div>
            <h3 className="text-lg font-bold">Tell us about your device</h3>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {[
                ["Brand", "brand"],
                ["Model", "model"],
                ["Storage", "storage"],
                ["Colour", "colour"],
                ["IMEI or serial number", "identifier"],
              ].map(([label, key]) => (
                <label key={key}>
                  <span className="text-xs font-bold text-slate-600">
                    {label} *
                  </span>
                  <input
                    value={form[(key as keyof typeof form)] as string}
                    onChange={(event) =>
                      setForm({ ...form, [key]: event.target.value })
                    }
                    className={input}
                  />
                </label>
              ))}
              <label>
                <span className="text-xs font-bold text-slate-600">
                  Device category
                </span>
                <select
                  value={form.category}
                  onChange={(event) =>
                    setForm({ ...form, category: event.target.value })
                  }
                  className={input}
                >
                  <option>Phone</option>
                  <option>Tablet</option>
                  <option>Laptop</option>
                </select>
              </label>
              <label>
                <span className="text-xs font-bold text-slate-600">
                  Condition
                </span>
                <select
                  value={form.condition}
                  onChange={(event) =>
                    setForm({ ...form, condition: event.target.value })
                  }
                  className={input}
                >
                  <option>Like New</option>
                  <option>Excellent</option>
                  <option>Good</option>
                  <option>Fair</option>
                </select>
              </label>
            </div>
            <p className="mt-4 text-xs text-slate-500">
              Describe faults, repairs, or damage during inspection. Never
              provide passwords, PINs, or account credentials.
            </p>
          </div>
        )}
        {step === 2 && (
          <div>
            <h3 className="text-lg font-bold">Photos and ownership</h3>
            <p className="mt-1 text-sm text-slate-500">
              Local demo previews only. Upload labels are kept after refresh;
              files must be selected again.
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {[
                ["Front photo", "front"],
                ["Back photo", "back"],
              ].map(([label, key]) => (
                <label
                  key={key}
                  className="rounded-2xl border border-dashed border-slate-300 p-5"
                >
                  <span className="text-sm font-bold">{label} *</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (file && file.size <= 5 * 1024 * 1024)
                        setForm({ ...form, [key]: file.name })
                    }}
                    className="mt-3 block w-full text-xs"
                  />
                  {form[(key as "front" | "back")] && (
                    <span className="mt-2 block text-xs font-bold text-emerald-700">
                      {form[(key as "front" | "back")]}
                    </span>
                  )}
                </label>
              ))}
            </div>
            <label className="mt-5 block rounded-2xl border border-dashed border-blue-200 bg-blue-50/50 p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <span className="text-sm font-bold text-slate-900">
                    Original proof-of-purchase receipt
                  </span>
                  <span className="ml-2 rounded-full bg-white px-2 py-1 text-[10px] font-bold text-blue-700">
                    Optional
                  </span>
                  <p className="mt-1 text-xs text-slate-500">
                    Upload a scanned copy or clear photo. PDF, JPG, PNG · Maximum 5 MB.
                  </p>
                </div>
                <input
                  type="file"
                  accept="application/pdf,image/png,image/jpeg,image/webp"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file && file.size <= 5 * 1024 * 1024)
                      setForm({ ...form, proofOfPurchase: file.name })
                  }}
                  className="text-xs"
                />
              </div>
              {form.proofOfPurchase && (
                <span className="mt-3 block text-xs font-bold text-emerald-700">
                  ✓ {form.proofOfPurchase}
                </span>
              )}
            </label>
            <div className="mt-5 space-y-3 text-sm">
              <label className="flex gap-3">
                <input
                  type="checkbox"
                  checked={form.ownership}
                  onChange={(event) =>
                    setForm({ ...form, ownership: event.target.checked })
                  }
                />
                I own this device or am authorized to trade it in.
              </label>
              <label className="flex gap-3 rounded-xl border border-red-100 bg-red-50 p-3 text-red-950">
                <input
                  type="checkbox"
                  checked={form.lawfulOwnership}
                  onChange={(event) =>
                    setForm({ ...form, lawfulOwnership: event.target.checked })
                  }
                />
                I confirm this product is not stolen, fraudulently obtained, or subject
                to an ownership dispute. *
              </label>
              <label className="flex gap-3">
                <input
                  type="checkbox"
                  checked={form.financing}
                  onChange={(event) =>
                    setForm({ ...form, financing: event.target.checked })
                  }
                />
                This device has outstanding financing to disclose for review.
              </label>
              <label className="flex gap-3">
                <input
                  type="checkbox"
                  checked={form.accountsRemoved}
                  onChange={(event) =>
                    setForm({ ...form, accountsRemoved: event.target.checked })
                  }
                />
                I understand linked accounts and activation locks must be
                removed before handover.
              </label>
            </div>
          </div>
        )}
        {step === 3 && (
          <div className="space-y-5">
            <h3 className="text-lg font-bold">Review application</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Summary
                label="Target product"
                value={`Samsung Galaxy S25 · ${money(9450)}`}
              />
              <Summary
                label="Your device"
                value={`${form.brand} ${form.model} · ${form.condition}`}
              />
              <Summary label="Device identifier" value={form.identifier} />
              <Summary
                label="Uploaded previews"
                value={[form.front, form.back].filter(Boolean).join(", ")}
              />
              <Summary
                label="Proof of purchase"
                value={form.proofOfPurchase || "Not provided (optional)"}
              />
            </div>
            <label className="flex gap-3 rounded-2xl bg-blue-50 p-4 text-sm text-blue-950">
              <input
                type="checkbox"
                checked={form.terms}
                onChange={(event) =>
                  setForm({ ...form, terms: event.target.checked })
                }
              />
              I agree to the Swap terms and understand trade-in credit requires
              store review and physical inspection.
            </label>
          </div>
        )}
        <div className="mt-7 flex justify-between gap-3">
          {step > 0 ? (
            <button onClick={() => setStep(step - 1)} className={secondary}>
              Back
            </button>
          ) : (
            <span />
          )}
          {step < 3 && (
            <button
              onClick={() => onNavigate("my-swaps")}
              className={secondary}
            >
              Save Draft
            </button>
          )}
          <button onClick={next} className={button}>
            {step === 3 ? "Submit application" : "Continue"}
          </button>
        </div>
      </div>
    </div>
  )
}

function Summary({ label, value }: { label: string value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className="mt-2 text-sm font-bold text-slate-900">{value}</div>
    </div>
  )
}

export function MySwapsPage({
  onNavigate,
}: {
  onNavigate: (page: string) => void
}) {
  const { data } = useSwap()
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<SwapApplication | null>(null)
  const visible = data.applications.filter((item) =>
    `${item.id} ${item.device} ${item.product} ${item.store}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  )
  return (
    <div className="space-y-6">
      <PageTitle
        title="My Swaps"
        description="Track trade-in applications, offers, demo payments, and exchange handovers."
        action={
          <button
            onClick={() => onNavigate("swap-application")}
            className={button}
          >
            Apply for Swap
          </button>
        }
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Summary
          label="In progress"
          value={String(
            data.applications.filter(
              (a) =>
                ![
                  "COMPLETED",
                  "CANCELLED",
                  "REJECTED",
                  "DECLINED",
                  "EXPIRED",
                ].includes(a.status),
            ).length,
          )}
        />
        <Summary
          label="Offers awaiting response"
          value={String(
            data.applications.filter((a) => a.status === "OFFER_SENT").length,
          )}
        />
        <Summary
          label="Ready for exchange"
          value={String(
            data.applications.filter((a) => a.status === "READY_FOR_EXCHANGE")
              .length,
          )}
        />
      </div>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search reference, device, product, or store"
        className={input}
      />
      <div className="space-y-3">
        {visible.map((item) => (
          <button
            key={item.id}
            onClick={() => setSelected(item)}
            className="w-full rounded-2xl border border-slate-200 bg-white p-5 text-left transition hover:border-blue-300"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold">{item.id}</h3>
                  <StatusBadge status={item.status} />
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  {item.device} toward {item.product}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {item.store} · {item.submittedAt}
                </p>
              </div>
              <div className="text-sm font-bold text-blue-700">
                {item.offer
                  ? `${money(item.offer.payable)} payable`
                  : "View details"}
              </div>
            </div>
          </button>
        ))}
      </div>
      {selected && (
        <SwapDetailsModal
          application={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}

function SwapDetailsModal({
  application,
  onClose,
  storeMode = false,
}: {
  application: SwapApplication
  onClose: () => void
  storeMode?: boolean
}) {
  const { data, update } = useSwap()
  const item =
    data.applications.find((entry) => entry.id === application.id) ??
    application
  const [paying, setPaying] = useState(false)
  const [working, setWorking] = useState(false)
  const [reason, setReason] = useState("")
  const [checks, setChecks] = useState({
    received: item.custody !== "Not received",
    lock: false,
    replacement: item.replacementHandedOver ?? false,
    acknowledgement: item.customerAcknowledged ?? false,
  })
  const offer = item.offer
  const accept = () => {
    if (!offer || new Date(offer.expiresAt) < new Date()) return
    update(
      item.id,
      {
        status: offer.payable > 0 ? "AWAITING_PAYMENT" : "READY_FOR_EXCHANGE",
        payment: offer.payable > 0 ? "Unpaid" : "Not required",
      },
      "Customer accepted the current offer.",
    )
  }
  const complete = () => {
    if (
      !checks.received ||
      !checks.lock ||
      !checks.replacement ||
      !checks.acknowledgement
    )
      return
    update(
      item.id,
      {
        status: "COMPLETED",
        custody: "Handed over",
        customerAcknowledged: true,
        replacementHandedOver: true,
      },
      "Exchange completed. Trade-in received and replacement handed over.",
    )
  }
  const uploadRequestedDocument = (requestId: string, file?: File) => {
    if (!file || file.size > 5 * 1024 * 1024) return
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"]
    if (!allowed.includes(file.type)) return
    const nextRequests = (item.documentRequests ?? []).map((request) =>
      request.id === requestId
        ? { ...request, fileName: file.name, status: "Uploaded" as const }
        : request,
    )
    update(
      item.id,
      { documentRequests: nextRequests },
      `Customer uploaded requested document: ${file.name}.`,
    )
  }
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4">
      <button
        aria-label="Close swap details"
        className="absolute inset-0"
        onClick={onClose}
      />
      <div className="relative max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[28px] bg-white p-5 shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap gap-2">
              <h2 className="text-xl font-bold">{item.id}</h2>
              <StatusBadge status={item.status} />
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {item.device} toward {item.product}
            </p>
          </div>
          <button onClick={onClose} className={secondary}>
            Close
          </button>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Summary
            label="Target product"
            value={`${item.product} · ${money(item.productPrice)}`}
          />
          <Summary
            label="Offered device"
            value={`${item.device} · ${item.condition}`}
          />
          <Summary label="Device identifier" value={item.identifier} />
          <Summary label="Inspection" value={item.inspection} />
        </div>
        <div className="mt-6 rounded-2xl bg-slate-50 p-5">
          <h3 className="font-bold">Submitted photos and ownership</h3>
          <p className="mt-2 text-sm text-slate-600">
            {item.photos.join(" · ") || "No photo labels available"}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Ownership declaration: {item.ownership ? "Confirmed" : "Missing"} ·
            Outstanding financing:{" "}
            {item.financing ? "Disclosed for review" : "Not disclosed"}
          </p>
          <div className="mt-4 grid gap-2 border-t border-slate-200 pt-4 text-sm text-slate-600 sm:grid-cols-2">
            <div>
              Lawful ownership: <span className={item.lawfulOwnership ? "font-bold text-emerald-700" : "font-bold text-red-600"}>{item.lawfulOwnership ? "Confirmed — declared not stolen" : "Missing"}</span>
            </div>
            <div>
              Proof of purchase: <span className="font-semibold text-slate-900">{item.proofOfPurchase || "Not provided (optional)"}</span>
            </div>
          </div>
        </div>
        {item.request && (
          <div className="mt-5 rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-900">
            <b>Information requested:</b> {item.request}
          </div>
        )}
        {(item.documentRequests?.length ?? 0) > 0 && (
          <div className="mt-5 rounded-[24px] border border-violet-200 bg-violet-50/60 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-bold text-violet-950">Additional documents requested</h3>
                <p className="mt-1 text-xs text-violet-700">Upload only the documents listed by the store. PDF, JPG, PNG or WEBP · Maximum 5 MB.</p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-[10px] font-bold text-violet-700">
                {(item.documentRequests ?? []).filter((request) => request.status === "Uploaded").length}/{item.documentRequests?.length} uploaded
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {(item.documentRequests ?? []).map((request) => (
                <div key={request.id} className="rounded-2xl border border-violet-100 bg-white p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{request.title}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${request.status === "Uploaded" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{request.status}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{request.note || "Requested to support the store's review."}</p>
                      {request.fileName && <p className="mt-1 text-xs font-bold text-emerald-700">✓ {request.fileName}</p>}
                    </div>
                    {!storeMode && (
                      <label className="cursor-pointer rounded-xl bg-violet-600 px-4 py-2.5 text-center text-xs font-bold text-white">
                        {request.status === "Uploaded" ? "Replace document" : "Upload document"}
                        <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => uploadRequestedDocument(request.id, event.target.files?.[0])} />
                      </label>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {offer && (
          <div className="mt-6 rounded-[24px] border border-blue-200 bg-blue-50 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-bold text-blue-950">
                Offer v{offer.version}
              </h3>
              <span className="text-xs font-bold text-blue-700">
                Expires {new Date(offer.expiresAt).toLocaleString()}
              </span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              <Summary
                label="Replacement price"
                value={money(offer.replacementPrice)}
              />
              <Summary label="Trade-in credit" value={money(offer.credit)} />
              <Summary label="Disclosed fees" value={money(offer.fees)} />
              <Summary label="You pay" value={money(offer.payable)} />
            </div>
            <p className="mt-4 text-sm text-blue-900">{offer.note}</p>
          </div>
        )}
        <div className="mt-6 rounded-2xl border border-slate-200 p-5">
          <h3 className="font-bold">Timeline</h3>
          <ol className="mt-3 space-y-2 text-sm text-slate-600">
            {item.timeline.map((event, index) => (
              <li
                key={`${event}-${index}`}
                className="border-l-2 border-blue-200 pl-3"
              >
                {event}
              </li>
            ))}
          </ol>
        </div>
        {!storeMode && (
          <div className="mt-6 flex flex-wrap gap-3">
            {item.status === "OFFER_SENT" && (
              <>
                <button onClick={accept} className={button}>
                  Accept Offer
                </button>
                <button
                  onClick={() =>
                    update(
                      item.id,
                      { status: "DECLINED" },
                      "Customer declined the offer.",
                    )
                  }
                  className={secondary}
                >
                  Decline
                </button>
              </>
            )}
            {item.status === "AWAITING_PAYMENT" && (
              <button onClick={() => setPaying(true)} className={button}>
                Proceed to Demo Payment
              </button>
            )}
            {[
              "DRAFT",
              "SUBMITTED",
              "UNDER_REVIEW",
              "MORE_INFORMATION_REQUIRED",
              "INSPECTION_REQUIRED",
            ].includes(item.status) && (
              <button
                onClick={() =>
                  update(
                    item.id,
                    { status: "CANCELLED" },
                    "Customer cancelled unpaid Swap application.",
                  )
                }
                className={secondary}
              >
                Cancel application
              </button>
            )}
            {item.status === "READY_FOR_EXCHANGE" && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={checks.acknowledgement}
                  onChange={(event) => {
                    setChecks({
                      ...checks,
                      acknowledgement: event.target.checked,
                    })
                    update(
                      item.id,
                      { customerAcknowledged: event.target.checked },
                      "Customer handover acknowledgement updated.",
                    )
                  }}
                />
                Demo customer handover acknowledgement
              </label>
            )}
            {item.status === "COMPLETED" && (
              <button onClick={() => window.print()} className={secondary}>
                Print demo receipt
              </button>
            )}
          </div>
        )}
        {storeMode && (
          <>
            <StoreDocumentRequestPanel item={item} />
            <StoreActions
              item={item}
              reason={reason}
              setReason={setReason}
              checks={checks}
              setChecks={setChecks}
              complete={complete}
            />
          </>
        )}
        {paying && (
          <DemoPayment
            item={item}
            onClose={() => setPaying(false)}
            working={working}
            setWorking={setWorking}
          />
        )}
      </div>
    </div>
  )
}

function DemoPayment({
  item,
  onClose,
  working,
  setWorking,
}: {
  item: SwapApplication
  onClose: () => void
  working: boolean
  setWorking: (value: boolean) => void
}) {
  const { update } = useSwap()
  const finish = (success: boolean) => {
    setWorking(true)
    window.setTimeout(() => {
      update(
        item.id,
        success
          ? { status: "READY_FOR_EXCHANGE", payment: "Paid" }
          : { payment: "Failed" },
        success
          ? `Demo payment successful. Reference DEMO-PAY-${Date.now().toString().slice(-6)}.`
          : "Demo payment failed. No money was charged.",
      )
      setWorking(false)
      if (success) onClose()
    }, 700)
  }
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/70 p-4">
      <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl">
        <div className="rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-900">
          Demo payment - no money will be charged.
        </div>
        <h3 className="mt-5 text-xl font-bold">
          Pay {money(item.offer?.payable ?? 0)}
        </h3>
        <p className="mt-2 text-sm text-slate-500">
          {item.id} · {item.product}
        </p>
        <div className="mt-5 grid gap-3">
          <button
            disabled={working}
            onClick={() => finish(true)}
            className={button}
          >
            {working
              ? "Processing demo payment..."
              : "Simulate Successful Payment"}
          </button>
          <button
            disabled={working}
            onClick={() => finish(false)}
            className={secondary}
          >
            Simulate Failed Payment
          </button>
          <button
            disabled={working}
            onClick={onClose}
            className="text-sm font-bold text-slate-500"
          >
            Cancel / Return
          </button>
        </div>
      </div>
    </div>
  )
}

function StoreDocumentRequestPanel({ item }: { item: SwapApplication }) {
  const { update } = useSwap()
  const [title, setTitle] = useState("")
  const [note, setNote] = useState("")
  const [open, setOpen] = useState(false)
  const requests = item.documentRequests ?? []
  const canRequest = !["COMPLETED", "REJECTED", "DECLINED", "CANCELLED", "EXPIRED"].includes(item.status)
  const submit = () => {
    if (!title.trim()) return
    const request: SwapDocumentRequest = {
      id: `DOC-${Date.now()}`,
      title: title.trim(),
      note: note.trim(),
      requestedAt: new Date().toISOString(),
      status: "Requested",
    }
    update(
      item.id,
      {
        status: "MORE_INFORMATION_REQUIRED",
        documentRequests: [...requests, request],
      },
      `Store requested additional document: ${request.title}.`,
    )
    setTitle("")
    setNote("")
    setOpen(false)
  }
  const cancelRequest = (request: SwapDocumentRequest) =>
    update(
      item.id,
      { documentRequests: requests.filter((entry) => entry.id !== request.id) },
      `Store cancelled document request: ${request.title}.`,
    )
  return (
    <div className="mt-6 rounded-[24px] border border-violet-200 bg-violet-50/50 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-bold text-violet-950">Further document requests</h3>
          <p className="mt-1 text-xs leading-5 text-violet-700">
            Optional: request only documents necessary to verify this swap. The customer will see the request in My Swaps.
          </p>
        </div>
        {canRequest && <button onClick={() => setOpen((value) => !value)} className="rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-bold text-white">{open ? "Cancel" : "+ Request document"}</button>}
      </div>
      {open && (
        <div className="mt-4 grid gap-3 rounded-2xl border border-violet-100 bg-white p-4 sm:grid-cols-2">
          <label><span className="text-xs font-bold text-slate-600">Document name *</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Warranty card or finance clearance letter" className={input} /></label>
          <label><span className="text-xs font-bold text-slate-600">Reason / instructions</span><input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Explain what is needed and why" className={input} /></label>
          <div className="sm:col-span-2"><button onClick={submit} disabled={!title.trim()} className={button}>Send document request</button></div>
        </div>
      )}
      {requests.length > 0 && (
        <div className="mt-4 space-y-2">
          {requests.map((request) => (
            <div key={request.id} className="flex flex-col gap-3 rounded-xl border border-violet-100 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div><div className="flex items-center gap-2"><span className="text-sm font-bold">{request.title}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${request.status === "Uploaded" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{request.status}</span></div><p className="mt-1 text-xs text-slate-500">{request.fileName || request.note || "Waiting for customer upload"}</p></div>
              {request.status === "Requested" && <button onClick={() => cancelRequest(request)} className="text-xs font-bold text-red-600">Cancel request</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StoreActions({
  item,
  reason,
  setReason,
  checks,
  setChecks,
  complete,
}: {
  item: SwapApplication
  reason: string
  setReason: (value: string) => void
  checks: {
    received: boolean
    lock: boolean
    replacement: boolean
    acknowledgement: boolean
  }
  setChecks: (value: {
    received: boolean
    lock: boolean
    replacement: boolean
    acknowledgement: boolean
  }) => void
  complete: () => void
}) {
  const { data, update } = useSwap()
  const issueOffer = () => {
    const credit = 2800
    const fees = data.settings.feeAmount
    if (credit > item.productPrice) return
    update(
      item.id,
      {
        status: "OFFER_SENT",
        inspection: "Passed",
        payment: "Unpaid",
        offer: {
          version: (item.offer?.version ?? 0) + 1,
          replacementPrice: item.productPrice,
          credit,
          fees,
          payable: item.productPrice - credit + fees,
          expiresAt: new Date(
            Date.now() + data.settings.validityDays * 86400000,
          ).toISOString(),
          note: "Bring the device with activation locks and linked accounts removed for handover.",
        },
      },
      "Store issued an inspected trade-in offer.",
    )
  }
  return (
    <div className="mt-6 space-y-4 rounded-[24px] border border-slate-200 p-5">
      <h3 className="font-bold">Store review actions</h3>
      {item.status === "SUBMITTED" && (
        <button
          onClick={() =>
            update(
              item.id,
              { status: "UNDER_REVIEW" },
              "Store started application review.",
            )
          }
          className={button}
        >
          Start Review
        </button>
      )}
      {item.status === "UNDER_REVIEW" && (
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() =>
              update(
                item.id,
                { status: "INSPECTION_REQUIRED" },
                "Store requested physical inspection.",
              )
            }
            className={button}
          >
            Schedule Inspection
          </button>
          <button
            onClick={() =>
              reason.trim() &&
              update(
                item.id,
                { status: "MORE_INFORMATION_REQUIRED", request: reason },
                `Store requested information: ${reason}`,
              )
            }
            className={secondary}
          >
            Request information
          </button>
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Required customer-facing request"
            className="flex-1 rounded-xl border border-slate-200 px-3 text-sm"
          />
        </div>
      )}
      {item.status === "INSPECTION_REQUIRED" && (
        <button onClick={issueOffer} className={button}>
          Record Passed Inspection & Send Offer
        </button>
      )}
      {item.status === "READY_FOR_EXCHANGE" && (
        <div>
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            {[
              ["received", "Old device formally received"],
              ["lock", "Activation lock/accounts removed"],
              ["replacement", "Replacement device handed over"],
              ["acknowledgement", "Customer acknowledgment recorded"],
            ].map(([key, label]) => (
              <label key={key} className="flex gap-2">
                <input
                  type="checkbox"
                  checked={checks[(key as keyof typeof checks)]}
                  onChange={(event) =>
                    setChecks({ ...checks, [key]: event.target.checked })
                  }
                />
                {label}
              </label>
            ))}
          </div>
          <button
            onClick={complete}
            disabled={
              !checks.received ||
              !checks.lock ||
              !checks.replacement ||
              !checks.acknowledgement
            }
            className={`${button} mt-5`}
          >
            Complete Swap
          </button>
        </div>
      )}
      {["SUBMITTED", "UNDER_REVIEW", "INSPECTION_REQUIRED"].includes(
        item.status,
      ) && (
        <button
          onClick={() =>
            reason.trim() &&
            update(
              item.id,
              { status: "REJECTED" },
              `Store rejected application: ${reason}`,
            )
          }
          className="ml-3 text-sm font-bold text-red-600"
        >
          Reject with reason
        </button>
      )}
    </div>
  )
}

export function SwapManagementPage({
  onNavigate,
}: {
  onNavigate: (page: string) => void
}) {
  const { data } = useSwap()
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<SwapApplication | null>(null)
  const apps = data.applications.filter((item) =>
    `${item.id} ${item.customer} ${item.device}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  )
  const completed = data.applications.filter(
    (item) => item.status === "COMPLETED",
  )
  return (
    <div className="space-y-6">
      <PageTitle
        title="Swap Management"
        description="Review incoming trade-ins, issue offers, and coordinate confirmed exchanges."
        action={
          <div className="flex gap-2">
            <button
              onClick={() => onNavigate("swap-settings")}
              className={secondary}
            >
              Swap Settings
            </button>
            <button
              onClick={() => onNavigate("trade-in-inventory")}
              className={button}
            >
              Trade-in Inventory
            </button>
          </div>
        }
      />
      <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-6">
        {[
          [
            "New",
            data.applications.filter((a) => a.status === "SUBMITTED").length,
          ],
          [
            "Under review",
            data.applications.filter((a) => a.status === "UNDER_REVIEW").length,
          ],
          [
            "Awaiting payment",
            data.applications.filter((a) => a.status === "AWAITING_PAYMENT")
              .length,
          ],
          [
            "Ready",
            data.applications.filter((a) => a.status === "READY_FOR_EXCHANGE")
              .length,
          ],
          ["Completed", completed.length],
          [
            "Trade-in value",
            money(
              completed.reduce((sum, a) => sum + (a.offer?.credit ?? 0), 0),
            ),
          ],
        ].map(([label, value]) => (
          <Summary
            key={String(label)}
            label={String(label)}
            value={String(value)}
          />
        ))}
      </div>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search reference, customer, or device"
        className={input}
      />
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              {[
                "Reference",
                "Customer",
                "Device",
                "Target product",
                "Approved value",
                "Payable",
                "Status",
                "Action",
              ].map((label) => (
                <th key={label} className="px-4 py-3">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {apps.map((item) => (
              <tr key={item.id} className="border-t border-slate-100">
                <td className="px-4 py-4 font-bold">{item.id}</td>
                <td className="px-4 py-4">{item.customer}</td>
                <td className="px-4 py-4">{item.device}</td>
                <td className="px-4 py-4">{item.product}</td>
                <td className="px-4 py-4">
                  {item.offer ? money(item.offer.credit) : "-"}
                </td>
                <td className="px-4 py-4">
                  {item.offer ? money(item.offer.payable) : "-"}
                </td>
                <td className="px-4 py-4">
                  <StatusBadge status={item.status} />
                </td>
                <td className="px-4 py-4">
                  <button
                    onClick={() => setSelected(item)}
                    className="font-bold text-blue-600"
                  >
                    Review
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selected && (
        <SwapDetailsModal
          application={selected}
          onClose={() => setSelected(null)}
          storeMode
        />
      )}
    </div>
  )
}

export function SwapSettingsPage() {
  const { data, saveSettings, reset } = useSwap()
  const [settings, setSettings] = useState(data.settings)
  const [saved, setSaved] = useState(false)
  return (
    <div className="space-y-6">
      <PageTitle
        title="Swap Settings"
        description="These frontend demo settings apply to future Swap applications and offers."
        action={
          <button onClick={reset} className={secondary}>
            Reset demo data
          </button>
        }
      />
      {saved && (
        <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
          Swap settings saved for future demo offers.
        </div>
      )}
      <div className="rounded-[28px] border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="font-bold">Accept new Swap applications</h3>
            <p className="mt-1 text-sm text-slate-500">
              Turning this off preserves existing commitments but stops new demo
              applications and offers.
            </p>
          </div>
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(event) =>
              setSettings({ ...settings, enabled: event.target.checked })
            }
            className="h-5 w-5"
          />
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {[
            ["Accepted categories", "categories"],
            ["Minimum condition", "minimumCondition"],
            ["Offer validity (days)", "validityDays"],
            ["Disclosed fee name", "feeName"],
            ["Disclosed fee (GHS)", "feeAmount"],
          ].map(([label, key]) => (
            <label key={key}>
              <span className="text-xs font-bold text-slate-600">{label}</span>
              <input
                value={settings[(key as keyof SwapSettings)] as string | number}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    [key]:
                      key === "validityDays" || key === "feeAmount"
                        ? Number(event.target.value)
                        : event.target.value,
                  })
                }
                type={
                  key === "validityDays" || key === "feeAmount"
                    ? "number"
                    : "text"
                }
                className={input}
              />
            </label>
          ))}
          <label className="sm:col-span-2">
            <span className="text-xs font-bold text-slate-600">
              Instructions
            </span>
            <textarea
              value={settings.instructions}
              onChange={(event) =>
                setSettings({ ...settings, instructions: event.target.value })
              }
              rows={3}
              className={input}
            />
          </label>
        </div>
        <p className="mt-5 rounded-2xl bg-blue-50 p-4 text-sm text-blue-900">
          Final trade-in value is confirmed by the store after physical
          inspection. No automatic platform, verification, or processing fees
          are added.
        </p>
        <button
          onClick={() => {
            saveSettings(settings)
            setSaved(true)
          }}
          className={`${button} mt-6`}
        >
          Save Swap Settings
        </button>
      </div>
    </div>
  )
}

export function TradeInInventoryPage() {
  const { data, update } = useSwap()
  const [selected, setSelected] = useState<SwapInventoryItem | null>(null)
  const completed = data.applications.filter(
    (item) => item.status === "COMPLETED",
  )
  const inventory = [
    ...data.inventory,
    ...completed
      .filter(
        (app) =>
          !data.inventory.some((stock) => stock.applicationId === app.id),
      )
      .map((app) => ({
        id: `STI-${app.id.slice(-6)}`,
        applicationId: app.id,
        device: app.device,
        condition: app.condition,
        value: app.offer?.credit ?? 0,
        status: "HELD_FOR_SWAP" as const,
        receivedAt: app.submittedAt,
      })),
  ]
  return (
    <div className="space-y-6">
      <PageTitle
        title="Trade-in Inventory"
        description="Devices stay held for the completed exchange until staff make them available for resale."
      />
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          [
            "Held",
            inventory.filter((item) => item.status === "HELD_FOR_SWAP").length,
          ],
          [
            "Available",
            inventory.filter((item) => item.status === "AVAILABLE").length,
          ],
          [
            "Resold",
            inventory.filter((item) => item.status === "RESOLD").length,
          ],
          [
            "Acquisition value",
            money(inventory.reduce((sum, item) => sum + item.value, 0)),
          ],
        ].map(([label, value]) => (
          <Summary
            key={String(label)}
            label={String(label)}
            value={String(value)}
          />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {inventory.map((item) => (
          <div
            key={item.id}
            className="rounded-2xl border border-slate-200 bg-white p-5"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold">{item.device}</h3>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">
                {item.status.replaceAll("_", " ")}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-500">
              {item.id} · {item.condition} · {money(item.value)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Source: {item.applicationId}
            </p>
            <button
              onClick={() => setSelected(item)}
              className="mt-4 text-sm font-bold text-blue-600"
            >
              View actions
            </button>
          </div>
        ))}
      </div>
      {selected && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-md rounded-[28px] bg-white p-6">
            <h3 className="text-xl font-bold">{selected.device}</h3>
            <p className="mt-2 text-sm text-slate-500">
              Only completed Swap devices can be published or resold in this
              demo.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              {selected.status === "HELD_FOR_SWAP" && (
                <button
                  onClick={() => {
                    update(
                      selected.applicationId,
                      {},
                      "Trade-in checks completed; inventory is available for resale.",
                    )
                    setSelected({ ...selected, status: "AVAILABLE" })
                  }}
                  className={button}
                >
                  Mark available
                </button>
              )}
              {selected.status === "AVAILABLE" && (
                <button
                  onClick={() => setSelected({ ...selected, status: "RESOLD" })}
                  className={button}
                >
                  Record demo resale
                </button>
              )}
              <button onClick={() => setSelected(null)} className={secondary}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function SwapAdminOverviewPage() {
  const { data, saveSettings } = useSwap()
  const [filter, setFilter] = useState("All")
  const apps = data.applications.filter(
    (item) => filter === "All" || item.status === filter,
  )
  const paid = data.applications
    .filter((item) => item.payment === "Paid")
    .reduce((sum, item) => sum + (item.offer?.payable ?? 0), 0)
  return (
    <div className="space-y-6">
      <PageTitle
        title="Swap Overview"
        description="Platform-level frontend demo oversight across stores, offers, payments, and exchange activity."
        action={
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold">
            <input
              type="checkbox"
              checked={data.settings.enabled}
              onChange={(event) =>
                saveSettings({
                  ...data.settings,
                  enabled: event.target.checked,
                })
              }
            />
            Accept new Swap applications
          </label>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Summary
          label="Applications"
          value={String(data.applications.length)}
        />
        <Summary
          label="Completed swaps"
          value={String(
            data.applications.filter((item) => item.status === "COMPLETED")
              .length,
          )}
        />
        <Summary label="Demo top-up collections" value={money(paid)} />
        <Summary
          label="Trade-in inventory"
          value={String(data.inventory.length)}
        />
      </div>
      <select
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
        className={input}
      >
        <option>All</option>
        {Object.keys(statuses).map((status) => (
          <option key={status}>{status}</option>
        ))}
      </select>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              {[
                "Reference",
                "Store",
                "Customer",
                "Device",
                "Offer",
                "Payment",
                "Status",
              ].map((label) => (
                <th key={label} className="px-4 py-3">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {apps.map((item) => (
              <tr key={item.id} className="border-t border-slate-100">
                <td className="px-4 py-4 font-bold">{item.id}</td>
                <td className="px-4 py-4">{item.store}</td>
                <td className="px-4 py-4">{item.customer}</td>
                <td className="px-4 py-4">{item.device}</td>
                <td className="px-4 py-4">
                  {item.offer ? money(item.offer.payable) : "-"}
                </td>
                <td className="px-4 py-4">{item.payment}</td>
                <td className="px-4 py-4">
                  <StatusBadge status={item.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">
        Browser-only demo: expiry, reservations, payments, notifications,
        inventory updates, and role access are simulated locally.
      </p>
    </div>
  )
}

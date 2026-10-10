import ProductPrices from "../components/ProductPrices"
import { useEffect, useRef, useState } from "react"

import ApplicationForm from "./ApplicationForm"

import { applicationKinds, type ApplicationKind } from "../lib/applicationsApi"

type Store = {
  id: string
  name: string
  description: string
  region: string
  city: string
  address: string
  phone: string
  contactEmail: string
  website: string
  openingHours: string
  gpsAddress: string
  logo: string | null
  cover: string | null
  categories: string[]
  productCount: number
  terms: Record<string, unknown> | null
  termsRevision: number
}

type Product = {
  id: string
  storeId: string
  storeName: string
  name: string
  category: string
  description: string
  condition: string
  price: number
  currentPrice: number
  prices?: Record<string, number>
  inStock: boolean
  images: string[]
  paymentOptions: Record<string, boolean>
  swapAvailable: boolean
  promotion: { name: string; percent: number; endsAt: string } | null
}

type Catalogue = {
  items: (Store | Product)[]
  total: number
  page: number
  pageSize: number
  facets: {
    categories: string[]
    regions: string[]
    stores: { id: string; name: string }[]
  }
}

const button =
  "rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold disabled:opacity-50"

const input = "w-full rounded-xl border border-slate-200 bg-white p-3 text-sm"

const paymentLabels: Record<string, string> = {
  payNow: "Pay Now",
  hirePurchase: "Hire Purchase",
  layaway: "Layaway",
}

const money = (value: number) =>
  new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" }).format(
    value,
  )

const defaults = {
  q: "",
  category: "",
  region: "",
  store: "",
  condition: "",
  payment: "",
  min: "",
  max: "",
  inStock: "",
  sort: "",
}

async function get(path: string, signal: AbortSignal) {
  const response = await fetch(`/api/public/${path}`, {
    signal,
    credentials: "same-origin",
  })

  const result = await response.json().catch(() => null)

  if (!response.ok || !result)
    throw new Error(result?.error || "Cannot load the catalogue. Please retry.")

  return result
}

export default function Marketplace({
  mode = "stores",
  initialStore = "",
  initialProduct = "",
  initialQuery = "",
  onRecordChange,
  onStoreDetails,
  applyKind,
  onLogin,
}: {
  mode?: "stores" | "products"
  initialStore?: string
  initialProduct?: string
  initialQuery?: string
  onRecordChange?: (record: string) => void
  onStoreDetails?: (id: string) => void
  applyKind?: ApplicationKind
  onLogin?: () => void
}) {
  const [application, setApplication] = useState<{
    productId: string
    kind: ApplicationKind
  } | null>(null)

  const [notice, setNotice] = useState("")
  const [focusProduct,setFocusProduct]=useState(initialProduct)
  const openedProduct=useRef('')

  const [storeId, setStoreId] = useState(initialStore)

  const [store, setStore] = useState<Store | null>(null)

  const [filters, setFilters] = useState(defaults)

  const [search, setSearch] = useState("")

  const [page, setPage] = useState(1)

  const [data, setData] = useState<Catalogue | null>(null)

  const [loading, setLoading] = useState(true)

  const [error, setError] = useState("")

  const [reload, setReload] = useState(0)

  const [selected, setSelected] = useState<Product | null>(null)

  const [imageIndex, setImageIndex] = useState(0)

  const productsMode = mode === "products" || !!storeId

  useEffect(() => {
    setStoreId(initialStore)
    setFilters(defaults)
    setPage(1)
    setSearch("")
    setSelected(null)
  }, [mode, initialStore])
  useEffect(() => { setSearch(initialQuery); setFilters(current => ({ ...current, q: initialQuery })); setPage(1) }, [initialQuery, mode, initialStore])
  useEffect(()=>{setFocusProduct(initialProduct);openedProduct.current='';setPage(1)},[initialProduct])

  useEffect(() => {
    const refresh = () => {
      if (!document.hidden) setReload((value) => value + 1)
    }

    const timer = window.setInterval(refresh, 60000)

    window.addEventListener("focus", refresh)

    return () => {
      window.clearInterval(timer)
      window.removeEventListener("focus", refresh)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    const timer = window.setTimeout(() => controller.abort(), 30000)

    let active = true

    setLoading(true)
    setError("")

    const params = new URLSearchParams({
      product:focusProduct,
      ...filters,
      ...(applyKind
        ? {
            payment:
              applyKind === "hire_purchase"
                ? "hirePurchase"
                : applyKind === "layaway"
                  ? "layaway"
                  : "",
            swap: applyKind === "swap" ? "true" : "",
          }
        : {}),
      sort: filters.sort || (productsMode ? "newest" : "name"),
      store: storeId || filters.store,
      page: String(page),
    })

    Promise.all([
      get(
        `${productsMode ? "products" : "stores"}?${params}`,
        controller.signal,
      ),
      storeId
        ? get(`stores/${encodeURIComponent(storeId)}`, controller.signal)
        : Promise.resolve(null),
    ])

      .then(([result, detail]) => {
        if (!active) return

        setData(result)
        if(focusProduct&&openedProduct.current!==focusProduct){setSelected(result.items[0]||null);openedProduct.current=focusProduct;setImageIndex(0)}
        setStore(detail?.store || null)

        setSelected((current) =>
          current
            ? result.items.find((item: Product) => item.id === current.id) ||
              null
            : null,
        )
      })
      .catch((error) => {
        if (active) {
          setError(
            error.name === "AbortError"
              ? "The catalogue request timed out. Please retry."
              : error.message,
          )
          setSelected(null)
        }
      })

      .finally(() => {
        window.clearTimeout(timer)
        if (active) setLoading(false)
      })

    return () => {
      active = false
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [filters, page, productsMode, storeId, reload, applyKind, focusProduct])

  const change = (key: keyof typeof defaults, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }))
    setPage(1)
  }

  const openStore = (id: string) => {
    setFocusProduct('')
    setSelected(null)

    if (onStoreDetails) {
      onStoreDetails(id)
      return
    }

    setStoreId(id)
    setFilters(defaults)
    setSearch("")
    setPage(1)
  }

  const reset = () => {
    setFocusProduct('')
    setFilters(defaults)
    setSearch("")
    setPage(1)
  }

  const select = (
    key: keyof typeof defaults,
    label: string,
    choices: { value: string; label: string }[],
  ) => (
    <label key={key} className="text-xs font-semibold text-slate-600">
      {label}
      <select
        value={filters[key]}
        onChange={(event) => change(key, event.target.value)}
        className={`${input} mt-1`}
      >
        <option value="">All {label.toLowerCase()}</option>
        {choices.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )

  return (
    <div className="space-y-6">
      {focusProduct && <p className="rounded-xl bg-blue-50 p-4 text-sm">Showing your selected product. Use Clear filters to browse the full catalogue.</p>}
      {applyKind && (
        <p className="rounded-xl bg-blue-50 p-4 text-sm">
          Choose a product below to apply for{" "}
          {applicationKinds[applyKind].toLowerCase()} with its store.
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-xl bg-emerald-50 p-4 text-emerald-800"
        >
          {notice}
        </p>
      )}
      {application && (
        <ApplicationForm
          {...application}
          onLogin={onLogin}
          onClose={() => setApplication(null)}
          onSubmitted={() => {
            setApplication(null)
            setSelected(null)
            onRecordChange?.("")
            setNotice(
              "Application submitted. Track the store decision under My Applications or My Swaps.",
            )
            window.dispatchEvent(new Event("applications-changed"))
          }}
        />
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-blue-600">
            AdepaPay Marketplace
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">
            {storeId
              ? "Store catalogue"
              : productsMode
                ? "Browse Products"
                : "Browse Stores"}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {productsMode
              ? "Explore available listings from approved stores across Ghana."
              : "Find approved stores and explore their latest products."}
          </p>
        </div>
        <div className="flex gap-2">
          {storeId && (
            <button
              className={button}
              onClick={() => {
                setStoreId("")
                onStoreDetails?.("")
                reset()
              }}
            >
              Back to browsing
            </button>
          )}
          <button
            className={button}
            disabled={loading}
            onClick={() => setReload((value) => value + 1)}
          >
            Refresh
          </button>
        </div>
      </div>
      {store && !loading && !error && (
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
          {store.cover && (
            <img
              src={store.cover}
              alt={`${store.name} cover`}
              className="h-44 w-full object-cover sm:h-60"
            />
          )}
          <div className="space-y-5 p-6">
            <div className="flex items-center gap-4">
              {store.logo && (
                <img
                  src={store.logo}
                  alt={`${store.name} logo`}
                  className="h-20 w-20 rounded-2xl border border-slate-200 object-cover"
                />
              )}
              <div>
                <h2 className="text-2xl font-bold">{store.name}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {[store.city, store.region].filter(Boolean).join(", ")} ·
                  Approved store
                </p>
              </div>
            </div>
            <p className="whitespace-pre-wrap text-sm text-slate-600">
              {store.description}
            </p>
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              {[
                ["Address", store.address],
                ["GhanaPost GPS", store.gpsAddress],
                ["Opening hours", store.openingHours],
              ]
                .filter(([, value]) => !!value)
                .map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs text-slate-500">{label}</dt>
                    <dd className="mt-1">{value}</dd>
                  </div>
                ))}
            </dl>
            <div className="flex flex-wrap gap-3">
              {store.phone && (
                <a
                  className={button}
                  href={`tel:${store.phone.replace(/[^\d+]/g, "")}`}
                >
                  Call {store.phone}
                </a>
              )}
              {store.contactEmail && (
                <a
                  className={button}
                  href={`mailto:${encodeURIComponent(store.contactEmail)}`}
                >
                  Email store
                </a>
              )}
              {store.website && (
                <a
                  className={button}
                  href={store.website}
                  target="_blank"
                  rel="noreferrer"
                >
                  Visit website
                </a>
              )}
            </div>
            {store.terms && (
              <details className="rounded-xl border border-slate-200 p-4">
                <summary className="cursor-pointer text-sm font-semibold">
                  Shop rules & terms · Version {store.termsRevision}
                </summary>
                <div className="mt-4 space-y-4 text-sm">
                  <dl className="grid gap-3 sm:grid-cols-2">
                    {[
                      ["minimumDeposit", "Minimum deposit (%)"],
                      ["minimumDuration", "Minimum duration (months)"],
                      ["maximumDuration", "Maximum duration (months)"],
                      ["gracePeriod", "Grace period (days)"],
                      ["lateFee", "Late charge (%)"],
                      ["returns", "Return window (days)"],
                      ["warranty", "Warranty (months)"],
                      ["delivery", "Delivery timeframe"],
                    ].map(([key, label]) => (
                      <div key={key}>
                        <dt className="text-xs text-slate-500">{label}</dt>
                        <dd>{String(store.terms?.[key] ?? "")}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="whitespace-pre-wrap">
                    {String(store.terms.returnConditions || "")}
                  </p>
                  <ol className="list-decimal space-y-2 pl-5">
                    {Array.isArray(store.terms.clauses) &&
                      store.terms.clauses.map((clause, index) => (
                        <li key={index}>{String(clause)}</li>
                      ))}
                  </ol>
                </div>
              </details>
            )}
          </div>
        </section>
      )}
      <form
        className="flex gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          change("q", search.trim())
        }}
      >
        <input
          aria-label="Search catalogue"
          maxLength={160}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={
            productsMode
              ? "Search products or stores"
              : "Search stores or cities"
          }
          className={input}
        />
        <button className={`${button} bg-blue-600 text-white`}>Search</button>
      </form>
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        {select(
          "category",
          "Categories",
          (data?.facets.categories || []).map((value) => ({
            value,
            label: value,
          })),
        )}
        {!storeId &&
          select(
            "region",
            "Regions",
            (data?.facets.regions || []).map((value) => ({
              value,
              label: value,
            })),
          )}
        {productsMode && (
          <>
            {!storeId &&
              select(
                "store",
                "Stores",
                (data?.facets.stores || []).map((store) => ({
                  value: store.id,
                  label: store.name,
                })),
              )}
            {select(
              "condition",
              "Conditions",
              ["New", "Used"].map((value) => ({ value, label: value })),
            )}
            {!applyKind &&
              select(
                "payment",
                "Payment options",
                Object.entries(paymentLabels).map(([value, label]) => ({
                  value,
                  label,
                })),
              )}
            <label className="text-xs font-semibold text-slate-600">
              Minimum price (GHS)
              <input
                type="number"
                min={0}
                step=".01"
                value={filters.min}
                onChange={(event) => change("min", event.target.value)}
                className={`${input} mt-1`}
              />
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Maximum price (GHS)
              <input
                type="number"
                min={0}
                step=".01"
                value={filters.max}
                onChange={(event) => change("max", event.target.value)}
                className={`${input} mt-1`}
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={filters.inStock === "true"}
                onChange={(event) =>
                  change("inStock", event.target.checked ? "true" : "")
                }
              />
              In stock only
            </label>
          </>
        )}
        <label className="text-xs font-semibold text-slate-600">
          Sort by
          <select
            value={filters.sort || (productsMode ? "newest" : "name")}
            onChange={(event) => change("sort", event.target.value)}
            className={`${input} mt-1`}
          >
            {(productsMode
              ? [
                  ["newest", "Newest"],
                  ["name", "Name"],
                  ["price-low", "Price: low to high"],
                  ["price-high", "Price: high to low"],
                ]
              : [
                  ["name", "Name"],
                  ["newest", "Newest stores"],
                  ["products", "Most products"],
                ]
            ).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className={button} onClick={reset}>
          Clear filters
        </button>
      </div>
      {error ? (
        <div role="alert" className="rounded-2xl bg-red-50 p-6 text-red-700">
          <p>{error}</p>
          <button
            className={`${button} mt-4`}
            onClick={() => setReload((value) => value + 1)}
          >
            Retry
          </button>
        </div>
      ) : loading ? (
        <p role="status" className="p-8 text-center text-slate-500">
          Loading live catalogue...
        </p>
      ) : (
        data && (
          <>
            <p className="text-sm text-slate-500">
              {data.total} {productsMode ? "products" : "stores"} found
            </p>
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {data.items.map((item) =>
                productsMode
                  ? (() => {
                      const product = item as Product
                      return (
                        <article
                          key={product.id}
                          className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
                        >
                          <button
                            className="block w-full text-left"
                            onClick={() => {
                              setSelected(product)
                              setImageIndex(0)
                            }}
                          >
                            {product.images[0] ? (
                              <img
                                src={product.images[0]}
                                alt={product.name}
                                loading="lazy"
                                className="h-52 w-full bg-slate-50 object-contain p-3"
                              />
                            ) : (
                              <div className="grid h-52 place-items-center bg-slate-50 text-slate-400">
                                No image
                              </div>
                            )}
                            <div className="p-5">
                              <p className="text-xs text-slate-500">
                                {product.category} · {product.condition}
                              </p>
                              <h2 className="mt-2 text-lg font-bold">
                                {product.name}
                              </h2>
                              <div className="mt-3"><ProductPrices cash={product.currentPrice} prices={product.prices} regularCash={product.promotion ? product.price : undefined} availability={{ ...product.paymentOptions, swap: product.swapAvailable }} /></div>
                              {product.promotion && (
                                <p className="mt-1 text-xs font-semibold text-emerald-700">
                                  {product.promotion.percent}% off ·{" "}
                                  {product.promotion.name}
                                </p>
                              )}
                              <p className="mt-2 text-xs text-slate-500">
                                {Object.keys(paymentLabels)
                                  .filter((key) => product.paymentOptions[key])
                                  .map((key) => paymentLabels[key])
                                  .join(" · ")}
                              </p>
                              <p
                                className={`mt-2 text-xs ${
                                  product.inStock
                                    ? "text-emerald-700"
                                    : "text-red-600"
                                }`}
                              >
                                {product.inStock ? "In stock" : "Out of stock"}
                              </p>
                            </div>
                          </button>
                          <button
                            className="w-full border-t border-slate-100 px-5 py-3 text-left text-sm font-semibold text-blue-700"
                            onClick={() => openStore(product.storeId)}
                          >
                            {product.storeName} →
                          </button>
                        </article>
                      )
                    })()
                  : (() => {
                      const store = item as Store
                      return (
                        <article
                          key={store.id}
                          className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
                        >
                          {store.cover ? (
                            <img
                              src={store.cover}
                              alt={store.name}
                              loading="lazy"
                              className="h-40 w-full object-cover"
                            />
                          ) : (
                            <div className="h-40 bg-gradient-to-r from-blue-950 to-blue-600" />
                          )}
                          <div className="space-y-3 p-5">
                            <div className="flex items-center gap-3">
                              {store.logo && (
                                <img
                                  src={store.logo}
                                  alt=""
                                  className="h-12 w-12 rounded-xl object-cover"
                                />
                              )}
                              <h2 className="text-lg font-bold">
                                {store.name}
                              </h2>
                            </div>
                            <p className="text-xs font-semibold text-emerald-700">
                              Approved store
                            </p>
                            <p className="text-sm text-slate-500">
                              {[store.city, store.region]
                                .filter(Boolean)
                                .join(", ")}
                            </p>
                            <p className="line-clamp-2 text-sm text-slate-600">
                              {store.description}
                            </p>
                            <p className="text-xs text-slate-500">
                              {store.productCount} active products ·{" "}
                              {store.categories.join(", ")}
                            </p>
                            <button
                              className={`${button} w-full bg-blue-600 text-white`}
                              onClick={() => openStore(store.id)}
                            >
                              Visit store
                            </button>
                          </div>
                        </article>
                      )
                    })(),
              )}
            </div>
            {!data.items.length && (
              <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center">
                <h2 className="font-semibold">No matches yet</h2>
                <p className="mt-2 text-sm text-slate-500">
                  Try another search or clear the filters.
                </p>
              </div>
            )}
            <div className="flex items-center justify-between gap-3 text-sm">
              <span>
                Page {data.page} of{" "}
                {Math.max(1, Math.ceil(data.total / data.pageSize))}
              </span>
              <div className="flex gap-2">
                <button
                  className={button}
                  disabled={data.page <= 1}
                  onClick={() => setPage(data.page - 1)}
                >
                  Previous
                </button>
                <button
                  className={button}
                  disabled={data.page * data.pageSize >= data.total}
                  onClick={() => setPage(data.page + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )
      )}
      {selected && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-detail-title"
            className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6"
          >
            <div className="flex justify-between gap-4">
              <h2 id="product-detail-title" className="text-xl font-bold">
                {selected.name}
              </h2>
              <button className={button} onClick={() => { setSelected(null); setFocusProduct(""); onRecordChange?.("") }}>
                Close
              </button>
            </div>
            <div className="mt-5 grid gap-6 sm:grid-cols-2">
              <div>
                {selected.images[imageIndex] && (
                  <img
                    src={selected.images[imageIndex]}
                    alt={selected.name}
                    className="h-64 w-full rounded-xl bg-slate-50 object-contain"
                  />
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {selected.images.map((url, index) => (
                    <button
                      key={url}
                      aria-label={`View image ${index + 1}`}
                      aria-pressed={imageIndex === index}
                      onClick={() => setImageIndex(index)}
                      className={`rounded-lg border-2 ${
                        imageIndex === index
                          ? "border-blue-600"
                          : "border-slate-200"
                      }`}
                    >
                      <img
                        src={url}
                        alt=""
                        className="h-12 w-12 object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                <p className="text-sm text-slate-500">
                  {selected.category} · {selected.condition}
                </p>
                <ProductPrices cash={selected.currentPrice} prices={selected.prices} regularCash={selected.promotion ? selected.price : undefined} availability={{ ...selected.paymentOptions, swap: selected.swapAvailable }} />
                {selected.promotion && (
                  <p className="text-sm text-emerald-700">
                    {selected.promotion.name}: {selected.promotion.percent}% off
                    through {selected.promotion.endsAt}. Regular price{" "}
                    {money(selected.price)}.
                  </p>
                )}
                <p className="whitespace-pre-wrap break-words text-sm">
                  {selected.description}
                </p>
                <p className="text-sm">
                  {selected.inStock ? "In stock" : "Currently out of stock"}
                </p>
                <p className="text-sm">
                  Payment options:{" "}
                  {Object.keys(paymentLabels)
                    .filter((key) => selected.paymentOptions[key])
                    .map((key) => paymentLabels[key])
                    .join(", ")}
                </p>
                {selected.swapAvailable && (
                  <p className="text-sm">
                    Trade-in enquiries accepted by this store.
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(applicationKinds) as ApplicationKind[])
                    .filter(
                      (kind) =>
                        (!applyKind || kind === applyKind) &&
                        (kind === "swap"
                          ? selected.swapAvailable
                          : selected.paymentOptions[
                              kind === "hire_purchase"
                                ? "hirePurchase"
                                : "layaway"
                            ]),
                    )
                    .map((kind) => (
                      <button
                        key={kind}
                        disabled={!selected.inStock}
                        className={`${button} bg-blue-600 text-white`}
                        onClick={() =>
                          setApplication({ productId: selected.id, kind })
                        }
                      >
                        Apply for {applicationKinds[kind]}{selected.prices?.[kind] !== undefined ? ` - ${money(selected.prices[kind])}` : ""}
                      </button>
                    ))}
                </div>
                <button
                  className={`${button} bg-blue-600 text-white`}
                  onClick={() => openStore(selected.storeId)}
                >
                  Contact {selected.storeName}
                </button>
                <p className="text-xs text-slate-500">
                  Select an available plan to submit an application. Pay-now
                  purchases can be arranged directly with the store.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

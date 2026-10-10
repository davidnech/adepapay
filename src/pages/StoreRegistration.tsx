import { authRequest, type SMSVerification } from '../lib/auth'
import OTPVerification from './OTPVerification'
import { useState, type FormEvent, type ReactNode } from "react"
import { GHANA_REGIONS, getGhanaRegionalCapital, isValidGhanaPhoneNumber } from "../lib/localization"

type StoreApplication = {
  storeName: string
  registeredName: string
  categories: string[]
  registrationNumber: string
  storeType: string
  officeClassification: string
  ownerName: string
  phone: string
  email: string
  region: string
  city: string
  password: string
}

const INITIAL: StoreApplication = {
  storeName: "",
  registeredName: "",
  categories: [],
  registrationNumber: "",
  storeType: "",
  officeClassification: "",
  ownerName: "",
  phone: "",
  email: "",
  region: "",
  city: "",
  password: "",
}

const fieldClass = (error?: string) =>
  `mt-1.5 w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 ${
    error ? "border-red-400" : "border-slate-200"
  }`

const CATEGORY_GROUPS: Record<string, string[]> = {
  "Building Materials": [
    "Cement & blocks",
    "Roofing sheets",
    "Tiles & flooring",
    "Paints & coatings",
    "Plumbing materials",
    "Electrical fittings",
    "Doors, windows & glass",
    "Steel, iron rods & aggregates",
  ],
  "Construction Equipment & Tools": [
    "Construction equipment",
    "Power tools (drills, mixers & saws)",
    "Hand tools & hardware",
    "Safety gear (helmets, boots & gloves)",
    "Generators & compressors",
    "Scaffolding & ladders",
  ],
  "Interior & Finishing": [
    "Kitchen fittings",
    "Bathroom sets & sanitary ware",
    "Lighting & fixtures",
    "Ceiling designs & materials",
    "Wardrobes & cabinets",
    "Furniture & home décor",
    "Curtains, blinds & carpets",
  ],
  "Education & Work Tools": [
    "Textbooks & learning materials",
    "E-learning devices",
    "School supplies & stationery",
    "Printers, scanners & copiers",
    "Projectors & presentation equipment",
    "Office furniture & supplies",
  ],
  "Health & Wellness": [
    "Medical equipment",
    "Diagnostic devices (BP monitors & thermometers)",
    "Sterilizers & clinic supplies",
    "Fitness gear & exercise equipment",
    "Mobility & rehabilitation aids",
    "Personal care & wellness products",
  ],
  "Agriculture & Small Business Tools": [
    "Farm equipment (sprayers & trimmers)",
    "Irrigation & water pumps",
    "Poultry & livestock equipment",
    "Sewing & embroidery machines",
    "Barbering & salon kits",
    "Food processing equipment",
    "Commercial refrigeration",
  ],
  "Children & Family": [
    "Baby products (strollers & cribs)",
    "Toys & educational games",
    "Children's clothing & footwear",
    "School bags & lunch accessories",
    "Maternity & nursing products",
  ],
  "Electronics & Appliances": [
    "Phones, tablets & accessories",
    "Computers & laptops",
    "TVs, audio & entertainment",
    "Home & kitchen appliances",
    "Cameras & photography equipment",
    "Smart home & security systems",
  ],
  "Energy, Transport & Utilities": [
    "Solar panels, inverters & batteries",
    "Water tanks & filtration systems",
    "Automobiles & vehicle accessories",
    "Motorcycles, bicycles & parts",
    "Industrial machines & spare parts",
  ],
  "Fashion, Beauty & General Retail": [
    "Fashion & apparel",
    "Footwear, bags & accessories",
    "Beauty, cosmetics & skincare",
    "Jewellery & watches",
    "Groceries & household essentials",
    "Hospitality & restaurant equipment",
  ],
}

function CategoryMultiSelect({
  selected,
  onChange,
  error,
}: {
  selected: string[]
  onChange: (categories: string[]) => void
  error?: string
}) {
  const [query, setQuery] = useState("")
  const normalized = query.trim().toLowerCase()
  const visibleGroups = Object.entries(CATEGORY_GROUPS)
    .map(
      ([group, categories]) =>
        [
          group,
          categories.filter(
            (category) =>
              !normalized ||
              `${group} ${category}`.toLowerCase().includes(normalized),
          ),
        ] as const,
    )
    .filter(([, categories]) => categories.length)
  const toggle = (category: string) =>
    onChange(
      selected.includes(category)
        ? selected.filter((item) => item !== category)
        : [...selected, category],
    )
  return (
    <div className="sm:col-span-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-slate-600">
          Business categories *
        </span>
        <span className="text-[10px] font-bold text-blue-700">
          Multiple selection allowed
        </span>
      </div>
      <div
        className={`mt-1.5 overflow-hidden rounded-2xl border bg-white ${
          error ? "border-red-400" : "border-slate-200"
        }`}
      >
        <div className="border-b border-slate-100 p-3">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search cement, tools, health, electronics…"
            className="w-full rounded-xl bg-slate-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-2 border-b border-slate-100 p-3">
            {selected.map((category) => (
              <button
                type="button"
                key={category}
                onClick={() => toggle(category)}
                className="flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1.5 text-[11px] font-bold text-blue-700"
              >
                {category}
                <span className="text-blue-400">×</span>
              </button>
            ))}
          </div>
        )}
        <div className="max-h-80 space-y-5 overflow-y-auto p-4">
          {visibleGroups.map(([group, categories]) => (
            <div key={group}>
              <div className="mb-2 text-[11px] font-black uppercase tracking-wider text-slate-400">
                {group}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {categories.map((category) => (
                  <label
                    key={category}
                    className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-xs transition ${
                      selected.includes(category)
                        ? "border-blue-300 bg-blue-50 text-blue-900"
                        : "border-slate-100 hover:border-blue-200 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(category)}
                      onChange={() => toggle(category)}
                      className="mt-0.5 accent-blue-600"
                    />
                    <span className="font-semibold leading-5">{category}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
          {visibleGroups.length === 0 && (
            <div className="py-8 text-center text-sm text-slate-500">
              No matching category found.
            </div>
          )}
        </div>
      </div>
      <div className="mt-1.5 flex items-center justify-between text-xs">
        <span className={error ? "text-red-600" : "text-slate-400"}>
          {error ||
            "Select every category that accurately describes products you sell."}
        </span>
        <span className="font-bold text-slate-500">
          {selected.length} selected
        </span>
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  error,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
  error?: string
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-slate-600">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={fieldClass(error)}
      />
      {error && (
        <span className="mt-1 block text-xs text-red-600">{error}</span>
      )}
    </label>
  )
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  hint,
  error,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: string[]
  placeholder: string
  hint?: string
  error?: string
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-slate-600">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={fieldClass(error)}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      {hint && !error && (
        <span className="mt-1 block text-xs leading-5 text-slate-400">
          {hint}
        </span>
      )}
      {error && (
        <span className="mt-1 block text-xs text-red-600">{error}</span>
      )}
    </label>
  )
}

function SectionHeading({
  title,
  description,
  icon,
}: {
  title: string
  description: string
  icon: ReactNode
}) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
        {icon}
      </div>
      <div>
        <h2 className="font-bold">{title}</h2>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
    </div>
  )
}

export default function StoreRegistration({
  onBack,
  onLogin,
  onCustomerRegister,
}: {
  onBack: () => void
  onLogin: () => void
  onCustomerRegister: () => void
}) {
  const [form, setForm] = useState(INITIAL)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState('')
  const [complete, setComplete] = useState(false)
  const [confirmationRequired, setConfirmationRequired] = useState(false)
  const [verification, setVerification] = useState<SMSVerification | null>(null)
  const [welcomeSent, setWelcomeSent] = useState(true)
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [confirmPassword, setConfirmPassword] = useState('')
  const [reference, setReference] = useState("")
  const set =
    (key: Exclude<keyof StoreApplication, "categories">) => (value: string) =>
      setForm({ ...form, [key]: value })

  const finishRegistration = async () => {
    const result = await authRequest('store-signup', { ...form, agreeTerms })
    if (result.verification_required && result.verification) {
      setVerification(result.verification)
      return
    }
    setVerification(null)
    setWelcomeSent(result.welcome_sms_sent !== false)
    setReference(result.application_reference || '')
    setConfirmationRequired(Boolean(result.confirmation_required))
    setForm(current => ({ ...current, password: '' }))
    setConfirmPassword('')
    sessionStorage.removeItem('adepapay-store-application')
    setComplete(true)
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (submitting) return
    const required = Object.entries(form).filter(([, value]) =>
      Array.isArray(value) ? value.length === 0 : !value.trim(),
    )
    const nextErrors = Object.fromEntries(
      required.map(([key]) => [key, "This field is required"]),
    )
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email))
      nextErrors.email = "Enter a valid email address"
    if (form.password && form.password.length < 8)
      nextErrors.password = "Use at least 8 characters"
    if (!isValidGhanaPhoneNumber(form.phone)) nextErrors.phone = 'Enter a valid Ghanaian phone number'
    if (form.password !== confirmPassword) nextErrors.confirmPassword = 'Passwords do not match'
    if (!agreeTerms) nextErrors.agreeTerms = 'Accept the Terms and Privacy Policy to continue'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    setSubmitting(true)
    setServerError('')
    try {
      await finishRegistration()
    } catch (error) {
      setServerError(error instanceof Error ? error.message : 'Unable to register your store. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (verification) return <OTPVerification verification={verification} onVerified={finishRegistration} onBack={() => setVerification(null)} />
  if (complete)
    return (
      <div className="login-scene relative flex min-h-screen items-center justify-center overflow-hidden px-4">
        <div className="login-grid absolute inset-0" />
        <div className="relative z-10 w-full max-w-lg rounded-[30px] border border-white/60 bg-white/95 p-8 text-center shadow-2xl sm:p-10">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-amber-600">
            <svg
              className="h-8 w-8"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              viewBox="0 0 24 24"
            >
              <circle cx="12" cy="12" r="9" />
              <path strokeLinecap="round" d="M12 7v5l3 2" />
            </svg>
          </div>
          <span className="mt-5 inline-block rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
            Pending approval
          </span>
          <h1 className="mt-3 text-2xl font-bold text-slate-950">
            Store registration successful
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {confirmationRequired ? 'Check your email for a confirmation link, then sign in. If you already have an account, sign in instead.' : `Thanks, ${form.ownerName}. Your application for ${form.storeName} has been saved. Sign in to view its status. Store management access is pending approval.`}
          </p>
          {!welcomeSent && <p role="status" className="mt-3 text-sm text-amber-700">Registration succeeded, but the confirmation SMS could not be confirmed.</p>}
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Application reference
            </div>
            <div className="mt-1 font-mono text-lg font-bold text-slate-900">
              {reference || "Available after sign in"}
            </div>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button
              onClick={onBack}
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700"
            >
              Return home
            </button>
            <button
              onClick={onLogin}
              className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white"
            >
              Go to login
            </button>
          </div>
        </div>
      </div>
    )

  return (
    <div className="login-scene relative min-h-screen overflow-hidden px-4 py-10">
      <div className="login-grid absolute inset-0" />
      <div className="login-orb login-orb-one" />
      <div className="login-orb login-orb-two" />
      <button
        onClick={onBack}
        className="absolute left-5 top-5 z-20 flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold text-white/80 backdrop-blur-xl"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 19l-7-7 7-7"
          />
        </svg>
        Back home
      </button>
      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-5rem)] max-w-3xl items-center">
        <form
          onSubmit={submit}
          className="w-full rounded-[30px] border border-white/60 bg-white/95 p-6 shadow-2xl backdrop-blur-2xl sm:p-8"
        >
          <div className="text-center">
            <img
              src="/images/adepa_pay_logo.png"
              alt="AdepaPay"
              className="mx-auto h-16 w-auto"
            />
            <h1 className="mt-2 text-2xl font-bold text-slate-950">
              Become a store partner
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Verify your phone by SMS, then submit your store application for approval.
            </p>
          </div>
          <div className="mt-5 flex justify-center gap-4 text-sm font-semibold text-blue-600"><button type="button" onClick={onCustomerRegister}>Register as a customer</button><button type="button" onClick={onLogin}>Already registered? Sign in</button></div>
          {serverError && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">{serverError}</p>}
          <fieldset disabled={submitting} className="mt-7 grid gap-6 disabled:opacity-70">
            <section>
              <SectionHeading
                title="Store information"
                description="Tell us about your business and how it operates."
                icon={
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    viewBox="0 0 24 24"
                  >
                    <path d="M3 9l2-5h14l2 5M4 9v11h16V9M9 20v-6h6v6" />
                  </svg>
                }
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Public store name"
                  value={form.storeName}
                  onChange={set("storeName")}
                  error={errors.storeName}
                />
                <Field
                  label="Registered business name"
                  value={form.registeredName}
                  onChange={set("registeredName")}
                  error={errors.registeredName}
                />
                <Field
                  label="Registration number"
                  value={form.registrationNumber}
                  onChange={set("registrationNumber")}
                  error={errors.registrationNumber}
                />
                <SelectField
                  label="Store type"
                  value={form.storeType}
                  onChange={set("storeType")}
                  placeholder="Select how your store operates"
                  options={[
                    "Physical store",
                    "Online store",
                    "Physical & online store",
                  ]}
                  error={errors.storeType}
                />
                <CategoryMultiSelect
                  selected={form.categories}
                  onChange={(categories) => {
                    setForm({ ...form, categories })
                    setErrors({ ...errors, categories: "" })
                  }}
                  error={errors.categories}
                />
              </div>
            </section>
            <section className="border-t border-slate-100 pt-6">
              <SectionHeading
                title="Office classification"
                description="Tell us where this store sits in your business network."
                icon={
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    viewBox="0 0 24 24"
                  >
                    <path d="M4 20V8l8-4 8 4v12M8 20v-6h8v6M9 10h.01M15 10h.01" />
                  </svg>
                }
              />
              <SelectField
                label="This location is a"
                value={form.officeClassification}
                onChange={set("officeClassification")}
                placeholder="Select main office or branch"
                options={["Main head office", "Branch"]}
                hint="Choose Main head office for your primary business location. Choose Branch for an additional location."
                error={errors.officeClassification}
              />
            </section>
            <section className="border-t border-slate-100 pt-6">
              <SectionHeading
                title="Manager and account"
                description="We’ll use these details during verification."
                icon={
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    viewBox="0 0 24 24"
                  >
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 21a8 8 0 0116 0" />
                  </svg>
                }
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Owner or manager name"
                  value={form.ownerName}
                  onChange={set("ownerName")}
                  error={errors.ownerName}
                />
                <Field
                  label="Phone number"
                  value={form.phone}
                  onChange={set("phone")}
                  type="tel"
                  error={errors.phone}
                />
                <Field
                  label="Business email"
                  value={form.email}
                  onChange={set("email")}
                  type="email"
                  error={errors.email}
                />
                <Field
                  label="Create password"
                  value={form.password}
                  onChange={set("password")}
                  type="password"
                  error={errors.password}
                />
                <SelectField
                  label="Region"
                  value={form.region}
                  onChange={(region) => {
                    setForm({
                      ...form,
                      region,
                      city: getGhanaRegionalCapital(region),
                    })
                    setErrors({ ...errors, region: "", city: "" })
                  }}
                  placeholder="Select one of Ghana's 16 regions"
                  options={GHANA_REGIONS}
                  error={errors.region}
                />
                <Field
                  label="City or town"
                  value={form.city}
                  onChange={set("city")}
                  error={errors.city}
                />
              </div>
            </section>
          </fieldset>
          <div className="mt-7 rounded-2xl bg-blue-50 p-4 text-xs leading-5 text-blue-800">
            Submitting creates a pending store account. Our team reviews your
            business information before enabling Store Manager access.
          </div>
          <div className="mt-5">
            <label htmlFor="store-confirm-password" className="text-sm font-semibold text-slate-700">Confirm password</label>
            <input id="store-confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} disabled={submitting} required className={fieldClass(errors.confirmPassword)} />
            {errors.confirmPassword && <p role="alert" className="mt-1 text-xs text-red-600">{errors.confirmPassword}</p>}
            <label className="mt-4 flex gap-2 text-sm text-slate-600"><input type="checkbox" checked={agreeTerms} onChange={event => setAgreeTerms(event.target.checked)} disabled={submitting} />I accept the Terms of Service and Privacy Policy.</label>
            {errors.agreeTerms && <p role="alert" className="mt-1 text-xs text-red-600">{errors.agreeTerms}</p>}
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-600/20 disabled:opacity-70"
          >
            {submitting ? "Submitting application…" : "Submit for approval"}
          </button>
        </form>
      </main>
    </div>
  )
}

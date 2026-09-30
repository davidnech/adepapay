import { useEffect, useMemo, useState, type FormEvent } from "react"
import {
  assignCustomerToAgent,
  closeAgentAccount,
  createFieldAgent,
  FIELD_AGENT_EVENT,
  loadFieldAgentData,
  saveFieldAgentData,
  type AgentSettlement,
  type FieldAgent,
} from "../lib/fieldAgents"
import {
  formatCurrency,
  GHANA_REGIONS,
  getGhanaRegionalCapital,
} from "../lib/localization"

const input =
  "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500"
const primary =
  "rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40"
const secondary =
  "rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700"

function useAgentData() {
  const [data, setData] = useState(loadFieldAgentData)
  useEffect(() => {
    const refresh = () => setData(loadFieldAgentData())
    window.addEventListener(FIELD_AGENT_EVENT, refresh)
    return () => window.removeEventListener(FIELD_AGENT_EVENT, refresh)
  }, [])
  return { data, refresh: () => setData(loadFieldAgentData()) }
}

export function StoreFieldAgentsPage({ storeId }: { storeId: string }) {
  const { data } = useAgentData()
  const [query, setQuery] = useState("")
  const [registering, setRegistering] = useState(false)
  const [selected, setSelected] = useState<FieldAgent | null>(null)
  const [notice, setNotice] = useState("")
  const agents = data.agents.filter(
    (agent) =>
      agent.storeId === storeId &&
      `${agent.fullName} ${agent.email} ${agent.phone} ${agent.area}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  )
  const metrics = data.agents.filter((agent) => agent.storeId === storeId)
  const unsettled = (agentId?: string) =>
    data.collections
      .filter(
        (item) =>
          item.storeId === storeId &&
          item.status === "Unsettled" &&
          (!agentId || item.agentId === agentId),
      )
      .reduce((sum, item) => sum + item.amount, 0)
  const toggleStatus = (agent: FieldAgent) => {
    saveFieldAgentData({
      ...data,
      agents: data.agents.map((item) =>
        item.id === agent.id
          ? {
              ...item,
              status: item.status === "Active" ? "Suspended" : "Active",
            }
          : item,
      ),
    })
    setNotice(
      `${agent.fullName} ${
        agent.status === "Active" ? "suspended" : "reactivated"
      }.`,
    )
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Field Agents</h2>
          <p className="mt-1 text-sm text-slate-500">
            Register agents, assign customers, monitor collections, and control
            login access.
          </p>
        </div>
        <button onClick={() => setRegistering(true)} className={primary}>
          + Register Field Agent
        </button>
      </div>
      {notice && (
        <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
          {notice}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Registered agents", metrics.length],
          [
            "Active agents",
            metrics.filter((item) => item.status === "Active").length,
          ],
          [
            "Assigned customers",
            data.customers.filter((item) => item.storeId === storeId).length,
          ],
          ["Unsettled collections", formatCurrency(unsettled())],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-2xl border border-slate-200 bg-white p-5"
          >
            <div className="text-sm text-slate-500">{label}</div>
            <div className="mt-2 text-2xl font-black">{value}</div>
          </div>
        ))}
      </div>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search agent name, phone, email, or assigned area"
        className={input}
      />
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              {[
                "Agent",
                "Contact",
                "Assigned area",
                "Customers",
                "Collections",
                "Unsettled account",
                "Status",
                "Actions",
              ].map((label) => (
                <th key={label} className="px-5 py-4">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {agents.map((agent) => {
              const customers = data.customers.filter(
                (item) => item.agentId === agent.id,
              )
              const collections = data.collections.filter(
                (item) => item.agentId === agent.id,
              )
              return (
                <tr key={agent.id} className="border-t border-slate-100">
                  <td className="px-5 py-4">
                    <div className="font-bold">{agent.fullName}</div>
                    <div className="text-xs text-slate-400">{agent.id}</div>
                  </td>
                  <td className="px-5 py-4">
                    {agent.phone}
                    <div className="text-xs text-slate-400">{agent.email}</div>
                  </td>
                  <td className="px-5 py-4">{agent.area}</td>
                  <td className="px-5 py-4 font-bold">{customers.length}</td>
                  <td className="px-5 py-4">{collections.length}</td>
                  <td className="px-5 py-4 font-bold text-amber-700">
                    {formatCurrency(unsettled(agent.id))}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${
                        agent.status === "Active"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-red-50 text-red-700"
                      }`}
                    >
                      {agent.status}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex gap-3">
                      <button
                        onClick={() => setSelected(agent)}
                        className="font-bold text-blue-600"
                      >
                        View & assign
                      </button>
                      <button
                        onClick={() => toggleStatus(agent)}
                        className={`font-bold ${
                          agent.status === "Active"
                            ? "text-red-600"
                            : "text-emerald-600"
                        }`}
                      >
                        {agent.status === "Active" ? "Suspend" : "Reactivate"}
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {registering && (
        <RegisterAgentModal
          storeId={storeId}
          onClose={() => setRegistering(false)}
          onCreated={(agent) => {
            setRegistering(false)
            setNotice(
              `${agent.fullName} registered. They can now log in with the email and password provided.`,
            )
          }}
        />
      )}
      {selected && (
        <AgentDetailsModal agent={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}

function RegisterAgentModal({
  storeId,
  onClose,
  onCreated,
}: {
  storeId: string
  onClose: () => void
  onCreated: (agent: FieldAgent) => void
}) {
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    profilePhoto: "",
    ghanaCard: "",
    ghanaCardFront: "",
    ghanaCardBack: "",
    address: "",
    digitalAddress: "",
    region: "",
    area: "",
    password: "",
    nextOfKinName: "",
    nextOfKinRelationship: "",
    nextOfKinPhone: "",
    nextOfKinAddress: "",
    fatherName: "",
    fatherPhone: "",
    motherName: "",
    motherPhone: "",
    guarantorName: "",
    guarantorRelationship: "",
    guarantorPhone: "",
    guarantorGhanaCard: "",
    guarantorAddress: "",
    guarantorDigitalAddress: "",
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const update = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: "", account: "" }))
  }
  const upload = (
    key: "profilePhoto" | "ghanaCardFront" | "ghanaCardBack",
    file?: File,
  ) => {
    if (!file) return
    if (!file.type.startsWith("image/")) {
      setErrors((current) => ({ ...current, [key]: "Upload an image file" }))
      return
    }
    if (file.size > 3 * 1024 * 1024) {
      setErrors((current) => ({
        ...current,
        [key]: "Maximum file size is 3 MB",
      }))
      return
    }
    const reader = new FileReader()
    reader.onload = () => update(key, String(reader.result))
    reader.readAsDataURL(file)
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const next: Record<string, string> = {}
    Object.entries(form).forEach(([key, value]) => {
      if (!value.trim()) next[key] = "Required"
    })
    if (form.password && form.password.length < 8)
      next.password = "Use at least 8 characters"
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email.trim()))
      next.email = "Enter a valid email"
    if (form.ghanaCard && !/^GHA-\d{9}-\d$/i.test(form.ghanaCard.trim()))
      next.ghanaCard = "Use the format GHA-123456789-0"
    if (
      form.guarantorGhanaCard &&
      !/^GHA-\d{9}-\d$/i.test(form.guarantorGhanaCard.trim())
    )
      next.guarantorGhanaCard = "Use the format GHA-123456789-0"
    if (
      form.digitalAddress &&
      !/^[A-Z]{2}-\d{3}-\d{4}$/i.test(form.digitalAddress.trim())
    )
      next.digitalAddress = "Use the format GA-123-4567"
    if (
      form.guarantorDigitalAddress &&
      !/^[A-Z]{2}-\d{3}-\d{4}$/i.test(form.guarantorDigitalAddress.trim())
    )
      next.guarantorDigitalAddress = "Use the format GA-123-4567"
    setErrors(next)
    if (Object.keys(next).length) return
    try {
      onCreated(
        createFieldAgent(storeId, {
          fullName: form.fullName,
          phone: form.phone,
          email: form.email,
          password: form.password,
          profilePhoto: form.profilePhoto,
          ghanaCard: form.ghanaCard,
          ghanaCardFront: form.ghanaCardFront,
          ghanaCardBack: form.ghanaCardBack,
          address: form.address,
          digitalAddress: form.digitalAddress,
          region: form.region,
          area: form.area,
          nextOfKin: {
            fullName: form.nextOfKinName,
            relationship: form.nextOfKinRelationship,
            phone: form.nextOfKinPhone,
            address: form.nextOfKinAddress,
          },
          parents: {
            fatherName: form.fatherName,
            fatherPhone: form.fatherPhone,
            motherName: form.motherName,
            motherPhone: form.motherPhone,
          },
          guarantor: {
            fullName: form.guarantorName,
            relationship: form.guarantorRelationship,
            phone: form.guarantorPhone,
            ghanaCard: form.guarantorGhanaCard,
            address: form.guarantorAddress,
            digitalAddress: form.guarantorDigitalAddress,
          },
        }),
      )
    } catch (error) {
      setErrors({
        account:
          error instanceof Error
            ? error.message
            : "Could not create this agent account.",
      })
    }
  }
  return (
    <Modal
      title="Register Field Agent"
      description="Create the agent's profile and secure login account."
      onClose={onClose}
    >
      <form onSubmit={submit}>
        {errors.account && (
          <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">
            {errors.account}
          </div>
        )}
        <AgentFormSection
          title="Personal details"
          description="Identity, contact information, login access, and assigned territory."
        >
          <ImageUpload
            label="Profile picture"
            value={form.profilePhoto}
            error={errors.profilePhoto}
            onChange={(file) => upload("profilePhoto", file)}
            round
          />
          <div className="grid flex-1 gap-4 sm:grid-cols-2">
            <AgentInput
              label="Full name"
              field="fullName"
              value={form.fullName}
              error={errors.fullName}
              onChange={update}
              placeholder="Kofi Mensah"
            />
            <AgentInput
              label="Phone number"
              field="phone"
              value={form.phone}
              error={errors.phone}
              onChange={update}
              placeholder="+233 24 000 0000"
              type="tel"
            />
            <AgentInput
              label="Login email"
              field="email"
              value={form.email}
              error={errors.email}
              onChange={update}
              placeholder="agent@store.com"
              type="email"
            />
            <AgentInput
              label="Temporary password"
              field="password"
              value={form.password}
              error={errors.password}
              onChange={update}
              placeholder="Minimum 8 characters"
              type="password"
            />
            <AgentInput
              label="Assigned area"
              field="area"
              value={form.area}
              error={errors.area}
              onChange={update}
              placeholder="Osu / East Legon"
            />
            <label>
              <span className="text-xs font-bold text-slate-600">Region *</span>
              <select
                value={form.region}
                onChange={(event) => {
                  update("region", event.target.value)
                  if (!form.area)
                    update("area", getGhanaRegionalCapital(event.target.value))
                }}
                className={`${input} ${errors.region ? "border-red-400" : ""}`}
              >
                <option value="">Select one of Ghana's 16 regions</option>
                {GHANA_REGIONS.map((region) => (
                  <option key={region}>{region}</option>
                ))}
              </select>
              {errors.region && (
                <span className="mt-1 block text-xs text-red-600">
                  {errors.region}
                </span>
              )}
            </label>
          </div>
        </AgentFormSection>
        <AgentFormSection
          title="Ghana Card and residence"
          description="Upload clear colour images. Maximum 3 MB per image."
        >
          <div className="grid w-full gap-4 sm:grid-cols-2">
            <AgentInput
              label="Ghana Card number"
              field="ghanaCard"
              value={form.ghanaCard}
              error={errors.ghanaCard}
              onChange={update}
              placeholder="GHA-123456789-0"
            />
            <AgentInput
              label="GhanaPost GPS address"
              field="digitalAddress"
              value={form.digitalAddress}
              error={errors.digitalAddress}
              onChange={update}
              placeholder="GA-123-4567"
            />
            <AgentInput
              label="Residential address"
              field="address"
              value={form.address}
              error={errors.address}
              onChange={update}
              placeholder="House number, street, town and region"
              wide
            />
            <ImageUpload
              label="Ghana Card front"
              value={form.ghanaCardFront}
              error={errors.ghanaCardFront}
              onChange={(file) => upload("ghanaCardFront", file)}
            />
            <ImageUpload
              label="Ghana Card back"
              value={form.ghanaCardBack}
              error={errors.ghanaCardBack}
              onChange={(file) => upload("ghanaCardBack", file)}
            />
          </div>
        </AgentFormSection>
        <AgentFormSection
          title="Next of kin"
          description="Primary emergency contact for the agent."
        >
          <div className="grid w-full gap-4 sm:grid-cols-2">
            <AgentInput
              label="Full name"
              field="nextOfKinName"
              value={form.nextOfKinName}
              error={errors.nextOfKinName}
              onChange={update}
            />
            <AgentInput
              label="Relationship"
              field="nextOfKinRelationship"
              value={form.nextOfKinRelationship}
              error={errors.nextOfKinRelationship}
              onChange={update}
              placeholder="Sibling, spouse, parent"
            />
            <AgentInput
              label="Phone number"
              field="nextOfKinPhone"
              value={form.nextOfKinPhone}
              error={errors.nextOfKinPhone}
              onChange={update}
              type="tel"
            />
            <AgentInput
              label="Residential address"
              field="nextOfKinAddress"
              value={form.nextOfKinAddress}
              error={errors.nextOfKinAddress}
              onChange={update}
            />
          </div>
        </AgentFormSection>
        <AgentFormSection
          title="Parental details"
          description="Contact information for both parents or recognized parental contacts."
        >
          <div className="grid w-full gap-4 sm:grid-cols-2">
            <AgentInput
              label="Father / parental contact name"
              field="fatherName"
              value={form.fatherName}
              error={errors.fatherName}
              onChange={update}
            />
            <AgentInput
              label="Father / parental phone"
              field="fatherPhone"
              value={form.fatherPhone}
              error={errors.fatherPhone}
              onChange={update}
              type="tel"
            />
            <AgentInput
              label="Mother / parental contact name"
              field="motherName"
              value={form.motherName}
              error={errors.motherName}
              onChange={update}
            />
            <AgentInput
              label="Mother / parental phone"
              field="motherPhone"
              value={form.motherPhone}
              error={errors.motherPhone}
              onChange={update}
              type="tel"
            />
          </div>
        </AgentFormSection>
        <AgentFormSection
          title="Guarantor details"
          description="The guarantor must consent to identity and contact verification."
        >
          <div className="grid w-full gap-4 sm:grid-cols-2">
            <AgentInput
              label="Guarantor full name"
              field="guarantorName"
              value={form.guarantorName}
              error={errors.guarantorName}
              onChange={update}
            />
            <AgentInput
              label="Relationship to agent"
              field="guarantorRelationship"
              value={form.guarantorRelationship}
              error={errors.guarantorRelationship}
              onChange={update}
            />
            <AgentInput
              label="Phone number"
              field="guarantorPhone"
              value={form.guarantorPhone}
              error={errors.guarantorPhone}
              onChange={update}
              type="tel"
            />
            <AgentInput
              label="Ghana Card number"
              field="guarantorGhanaCard"
              value={form.guarantorGhanaCard}
              error={errors.guarantorGhanaCard}
              onChange={update}
              placeholder="GHA-123456789-0"
            />
            <AgentInput
              label="Residential address"
              field="guarantorAddress"
              value={form.guarantorAddress}
              error={errors.guarantorAddress}
              onChange={update}
            />
            <AgentInput
              label="GhanaPost GPS address"
              field="guarantorDigitalAddress"
              value={form.guarantorDigitalAddress}
              error={errors.guarantorDigitalAddress}
              onChange={update}
              placeholder="GA-123-4567"
            />
          </div>
        </AgentFormSection>
        <div className="mt-5 rounded-2xl bg-blue-50 p-4 text-xs leading-5 text-blue-800">
          The agent can sign in immediately using this email address or phone
          number and the temporary password.
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className={secondary}>
            Cancel
          </button>
          <button type="submit" className={primary}>
            Create agent account
          </button>
        </div>
      </form>
    </Modal>
  )
}

function AgentFormSection({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="mt-6 border-t border-slate-100 pt-6 first:mt-0 first:border-0 first:pt-0">
      <h4 className="font-bold text-slate-900">{title}</h4>
      <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
      <div className="mt-4 flex flex-col gap-4 sm:flex-row">{children}</div>
    </section>
  )
}

function AgentInput({
  label,
  field,
  value,
  error,
  onChange,
  placeholder,
  type = "text",
  wide = false,
}: {
  label: string
  field: string
  value: string
  error?: string
  onChange: (key: any, value: string) => void
  placeholder?: string
  type?: string
  wide?: boolean
}) {
  return (
    <label className={wide ? "sm:col-span-2" : ""}>
      <span className="text-xs font-bold text-slate-600">{label} *</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(field, event.target.value)}
        placeholder={placeholder}
        className={`${input} ${error ? "border-red-400" : ""}`}
      />
      {error && (
        <span className="mt-1 block text-xs text-red-600">{error}</span>
      )}
    </label>
  )
}

function ImageUpload({
  label,
  value,
  error,
  onChange,
  round = false,
}: {
  label: string
  value: string
  error?: string
  onChange: (file?: File) => void
  round?: boolean
}) {
  return (
    <label className="block min-w-44 cursor-pointer">
      <span className="text-xs font-bold text-slate-600">{label} *</span>
      <div
        className={`mt-2 flex h-36 items-center justify-center overflow-hidden border-2 border-dashed bg-slate-50 text-center text-xs font-bold text-slate-500 ${
          round ? "rounded-full" : "rounded-2xl"
        } ${error ? "border-red-400" : "border-slate-200"}`}
      >
        {value ? (
          <img
            src={value}
            alt={`${label} preview`}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="px-4">
            Choose image
            <br />
            <span className="font-normal">JPG, PNG or WEBP</span>
          </span>
        )}
      </div>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(event) => onChange(event.target.files?.[0])}
      />
      {error && (
        <span className="mt-1 block text-xs text-red-600">{error}</span>
      )}
    </label>
  )
}

function AgentDetailsModal({
  agent,
  onClose,
}: {
  agent: FieldAgent
  onClose: () => void
}) {
  const { data } = useAgentData()
  const customers = data.customers.filter(
    (item) => item.storeId === agent.storeId,
  )
  const assigned = customers.filter((item) => item.agentId === agent.id)
  return (
    <Modal
      title={agent.fullName}
      description={`${agent.id} · ${agent.area}`}
      onClose={onClose}
    >
      <div className="mb-6 flex flex-col gap-5 rounded-2xl border border-slate-200 p-5 sm:flex-row">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-blue-50 text-2xl font-black text-blue-700">
          {agent.profilePhoto ? (
            <img
              src={agent.profilePhoto}
              alt={agent.fullName}
              className="h-full w-full object-cover"
            />
          ) : (
            agent.fullName
              .split(" ")
              .map((part) => part[0])
              .join("")
          )}
        </div>
        <div className="grid flex-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <b>Phone:</b> {agent.phone}
          </div>
          <div>
            <b>Email:</b> {agent.email}
          </div>
          <div>
            <b>Ghana Card:</b> {agent.ghanaCard}
          </div>
          <div>
            <b>Region:</b> {agent.region}
          </div>
          <div>
            <b>GPS:</b> {agent.digitalAddress || "Not provided"}
          </div>
          <div>
            <b>Assigned area:</b> {agent.area}
          </div>
          <div className="sm:col-span-2">
            <b>Residential address:</b> {agent.address}
          </div>
        </div>
      </div>
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <AgentInfoCard
          title="Next of kin"
          rows={[
            ["Name", agent.nextOfKin.fullName],
            ["Relationship", agent.nextOfKin.relationship],
            ["Phone", agent.nextOfKin.phone],
            ["Address", agent.nextOfKin.address],
          ]}
        />
        <AgentInfoCard
          title="Parental details"
          rows={[
            ["Father / contact", agent.parents.fatherName],
            ["Phone", agent.parents.fatherPhone],
            ["Mother / contact", agent.parents.motherName],
            ["Phone", agent.parents.motherPhone],
          ]}
        />
        <AgentInfoCard
          title="Guarantor"
          rows={[
            ["Name", agent.guarantor.fullName],
            ["Relationship", agent.guarantor.relationship],
            ["Phone", agent.guarantor.phone],
            ["Ghana Card", agent.guarantor.ghanaCard],
            ["Address", agent.guarantor.address],
            ["GPS", agent.guarantor.digitalAddress],
          ]}
        />
      </div>
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <AgentDocument label="Ghana Card front" value={agent.ghanaCardFront} />
        <AgentDocument label="Ghana Card back" value={agent.ghanaCardBack} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Assigned customers", assigned.length],
          [
            "Collections",
            data.collections.filter((item) => item.agentId === agent.id).length,
          ],
          [
            "Unsettled",
            formatCurrency(
              data.collections
                .filter(
                  (item) =>
                    item.agentId === agent.id && item.status === "Unsettled",
                )
                .reduce((sum, item) => sum + item.amount, 0),
            ),
          ],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-slate-50 p-4">
            <div className="text-xs text-slate-400">{label}</div>
            <div className="mt-1 font-bold">{value}</div>
          </div>
        ))}
      </div>
      <h4 className="mt-6 font-bold">Customer assignments</h4>
      <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
        {customers.map((customer) => (
          <div
            key={customer.id}
            className="flex items-center justify-between rounded-xl border border-slate-200 p-3"
          >
            <div>
              <div className="text-sm font-bold">{customer.fullName}</div>
              <div className="text-xs text-slate-500">
                {customer.product} · {customer.planReference}
              </div>
            </div>
            {customer.agentId === agent.id ? (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                Assigned
              </span>
            ) : (
              <button
                onClick={() => assignCustomerToAgent(customer.id, agent.id)}
                className="text-xs font-bold text-blue-600"
              >
                Assign to agent
              </button>
            )}
          </div>
        ))}
      </div>
    </Modal>
  )
}

function AgentInfoCard({ title, rows }: { title: string rows: string[][] }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <h4 className="font-bold">{title}</h4>
      <div className="mt-3 space-y-2">
        {rows.map(([label, value], index) => (
          <div key={`${label}-${index}`}>
            <div className="text-[10px] font-bold uppercase text-slate-400">
              {label}
            </div>
            <div className="text-sm font-semibold">
              {value || "Not provided"}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function AgentDocument({ label, value }: { label: string value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <div className="text-xs font-bold text-slate-500">{label}</div>
      {value ? (
        <img
          src={value}
          alt={label}
          className="mt-3 h-40 w-full rounded-xl object-cover"
        />
      ) : (
        <div className="mt-3 flex h-28 items-center justify-center rounded-xl bg-slate-50 text-xs text-slate-400">
          No image available for this existing demo profile
        </div>
      )}
    </div>
  )
}

export function StoreAgentSettlementsPage({ storeId }: { storeId: string }) {
  const { data } = useAgentData()
  const [selected, setSelected] = useState<FieldAgent | null>(null)
  const agents = data.agents.filter((agent) => agent.storeId === storeId)
  const unsettledFor = (id: string) =>
    data.collections.filter(
      (item) => item.agentId === id && item.status === "Unsettled",
    )
  const totalPending = agents.reduce(
    (sum, agent) =>
      sum +
      unsettledFor(agent.id).reduce((value, item) => value + item.amount, 0),
    0,
  )
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Agent Accounts & Settlements</h2>
        <p className="mt-1 text-sm text-slate-500">
          Review recorded collections and close each agent's unsettled account.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ["Unsettled balance", formatCurrency(totalPending)],
          [
            "Open agent accounts",
            agents.filter((agent) => unsettledFor(agent.id).length).length,
          ],
          [
            "Closed settlements",
            data.settlements.filter((item) => item.storeId === storeId).length,
          ],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-2xl border border-slate-200 bg-white p-5"
          >
            <div className="text-sm text-slate-500">{label}</div>
            <div className="mt-2 text-2xl font-black">{value}</div>
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {agents.map((agent) => {
          const rows = unsettledFor(agent.id)
          const amount = rows.reduce((sum, item) => sum + item.amount, 0)
          return (
            <div
              key={agent.id}
              className="rounded-2xl border border-slate-200 bg-white p-5"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold">{agent.fullName}</h3>
                  <p className="text-xs text-slate-500">
                    {agent.id} · {rows.length} unsettled transactions
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    amount
                      ? "bg-amber-50 text-amber-700"
                      : "bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {amount ? "Open" : "Clear"}
                </span>
              </div>
              <div className="mt-4 text-2xl font-black">
                {formatCurrency(amount)}
              </div>
              <div className="mt-1 text-xs text-slate-400">
                Recorded payments awaiting store closure
              </div>
              <button
                disabled={!amount}
                onClick={() => setSelected(agent)}
                className={`${primary} mt-5`}
              >
                Review & close account
              </button>
            </div>
          )
        })}
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="font-bold">Recent closed settlements</h3>
        <div className="mt-3 space-y-2">
          {data.settlements
            .filter((item) => item.storeId === storeId)
            .map((settlement) => {
              const agent = data.agents.find(
                (item) => item.id === settlement.agentId,
              )
              return (
                <div
                  key={settlement.id}
                  className="grid gap-2 rounded-xl bg-slate-50 p-3 text-sm sm:grid-cols-5"
                >
                  <b>{settlement.id}</b>
                  <span>{agent?.fullName}</span>
                  <span>{formatCurrency(settlement.amount)}</span>
                  <span>{settlement.closeMethod}</span>
                  <span className="font-bold text-emerald-700">Closed</span>
                </div>
              )
            })}
        </div>
      </div>
      {selected && (
        <CloseAccountModal agent={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}

function CloseAccountModal({
  agent,
  onClose,
}: {
  agent: FieldAgent
  onClose: () => void
}) {
  const { data } = useAgentData()
  const rows = data.collections.filter(
    (item) => item.agentId === agent.id && item.status === "Unsettled",
  )
  const amount = rows.reduce((sum, item) => sum + item.amount, 0)
  const [method, setMethod] =
    useState<AgentSettlement["closeMethod"]>("Cash handed over")
  const [note, setNote] = useState("")
  const close = () => {
    if (!note.trim()) return
    closeAgentAccount(agent.storeId, agent.id, method, note)
    onClose()
  }
  return (
    <Modal
      title={`Close ${agent.fullName}'s account`}
      description={`${rows.length} immutable collection records will be linked to this settlement.`}
      onClose={onClose}
    >
      <div className="rounded-2xl bg-amber-50 p-5">
        <div className="text-xs font-bold uppercase text-amber-700">
          Amount to reconcile
        </div>
        <div className="mt-2 text-3xl font-black text-amber-950">
          {formatCurrency(amount)}
        </div>
      </div>
      <div className="mt-5 max-h-56 space-y-2 overflow-y-auto">
        {rows.map((row) => (
          <div
            key={row.id}
            className="flex justify-between rounded-xl border border-slate-200 p-3 text-sm"
          >
            <span>
              {row.id} · {row.method}
            </span>
            <b>{formatCurrency(row.amount)}</b>
          </div>
        ))}
      </div>
      <label className="mt-5 block">
        <span className="text-xs font-bold">Closure method</span>
        <select
          value={method}
          onChange={(event) =>
            setMethod(event.target.value as AgentSettlement["closeMethod"])
          }
          className={input}
        >
          <option>Cash handed over</option>
          <option>Bank deposit</option>
          <option>Mobile Money transfer</option>
        </select>
      </label>
      <label className="mt-4 block">
        <span className="text-xs font-bold">Reconciliation note *</span>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={3}
          placeholder="Confirm counted cash, deposit reference, or transfer details"
          className={input}
        />
      </label>
      <div className="mt-6 flex justify-end gap-3">
        <button onClick={onClose} className={secondary}>
          Cancel
        </button>
        <button disabled={!note.trim()} onClick={close} className={primary}>
          Close agent account
        </button>
      </div>
    </Modal>
  )
}

function Modal({
  title,
  description,
  onClose,
  children,
}: {
  title: string
  description: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <button
        className="absolute inset-0"
        onClick={onClose}
        aria-label="Close dialog"
      />
      <div className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[28px] bg-white p-6 shadow-2xl sm:p-8">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h3 className="text-xl font-bold">{title}</h3>
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border text-xl"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

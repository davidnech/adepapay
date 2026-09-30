export type FieldAgent = {
  id: string
  storeId: string
  storeName: string
  fullName: string
  phone: string
  email: string
  profilePhoto: string
  ghanaCard: string
  ghanaCardFront: string
  ghanaCardBack: string
  address: string
  digitalAddress: string
  region: string
  area: string
  nextOfKin: {
    fullName: string
    relationship: string
    phone: string
    address: string
  }
  parents: {
    fatherName: string
    fatherPhone: string
    motherName: string
    motherPhone: string
  }
  guarantor: {
    fullName: string
    relationship: string
    phone: string
    ghanaCard: string
    address: string
    digitalAddress: string
  }
  password: string
  status: "Active" | "Suspended"
  createdAt: string
}

export type AgentCustomer = {
  id: string
  storeId: string
  agentId: string
  registeredByAgentId?: string
  fullName: string
  phone: string
  email: string
  address: string
  product: string
  planReference: string
  productPrice: number
  paid: number
  nextPayment: string
  frequency: "Daily" | "Weekly" | "Monthly"
  status: "Active" | "Overdue" | "Fully Paid"
}

export type AgentCollection = {
  id: string
  storeId: string
  agentId: string
  customerId: string
  planReference: string
  amount: number
  method: "Cash" | "Mobile Money" | "Bank Transfer"
  note: string
  recordedAt: string
  status: "Unsettled" | "Settled"
  settlementId?: string
}

export type AgentSettlement = {
  id: string
  storeId: string
  agentId: string
  collectionIds: string[]
  amount: number
  closeMethod: "Cash handed over" | "Bank deposit" | "Mobile Money transfer"
  note: string
  closedAt: string
  status: "Closed"
}

export type FieldAgentData = {
  agents: FieldAgent[]
  customers: AgentCustomer[]
  collections: AgentCollection[]
  settlements: AgentSettlement[]
}

const STORAGE_KEY = "adepapay.field-agents.v1"
export const FIELD_AGENT_EVENT = "adepapay-field-agent-data-updated"

const defaults = (): FieldAgentData => ({
  agents: [
    {
      id: "AGT-0018",
      storeId: "cytech-gadgets",
      storeName: "CYTECH Gadgets",
      fullName: "Kofi Mensah",
      phone: "+233 24 814 2201",
      email: "kofi.agent@adepapay.com",
      profilePhoto: "",
      ghanaCard: "GHA-482910375-1",
      ghanaCardFront: "",
      ghanaCardBack: "",
      address: "Osu, Accra",
      digitalAddress: "GA-183-4402",
      region: "Greater Accra",
      area: "Osu / East Legon",
      nextOfKin: {
        fullName: "Adwoa Mensah",
        relationship: "Sister",
        phone: "+233 20 411 8820",
        address: "Labone, Accra",
      },
      parents: {
        fatherName: "Kwesi Mensah",
        fatherPhone: "+233 24 201 8811",
        motherName: "Akosua Mensah",
        motherPhone: "+233 20 441 8820",
      },
      guarantor: {
        fullName: "Daniel Owusu",
        relationship: "Former employer",
        phone: "+233 55 201 4402",
        ghanaCard: "GHA-104829371-2",
        address: "East Legon, Accra",
        digitalAddress: "GA-492-1847",
      },
      password: "Agent123!",
      status: "Active",
      createdAt: "2026-07-03T08:12:00.000Z",
    },
    {
      id: "AGT-0021",
      storeId: "cytech-gadgets",
      storeName: "CYTECH Gadgets",
      fullName: "Mavis Tetteh",
      phone: "+233 20 554 8810",
      email: "mavis.agent@adepapay.com",
      profilePhoto: "",
      ghanaCard: "GHA-391824750-4",
      ghanaCardFront: "",
      ghanaCardBack: "",
      address: "Adabraka, Accra",
      digitalAddress: "GA-092-4701",
      region: "Greater Accra",
      area: "Adabraka / Ridge",
      nextOfKin: {
        fullName: "Esi Tetteh",
        relationship: "Mother",
        phone: "+233 24 908 1120",
        address: "Tema Community 8",
      },
      parents: {
        fatherName: "Kofi Tetteh",
        fatherPhone: "+233 27 110 9822",
        motherName: "Esi Tetteh",
        motherPhone: "+233 24 908 1120",
      },
      guarantor: {
        fullName: "Nana Addo",
        relationship: "Family friend",
        phone: "+233 26 441 0091",
        ghanaCard: "GHA-294018573-5",
        address: "Ridge, Accra",
        digitalAddress: "GA-183-8164",
      },
      password: "Agent123!",
      status: "Active",
      createdAt: "2026-08-10T09:30:00.000Z",
    },
  ],
  customers: [
    {
      id: "CUS-10482",
      storeId: "cytech-gadgets",
      agentId: "AGT-0018",
      fullName: "Ama Owusu",
      phone: "+233 24 601 1182",
      email: "ama.owusu@example.com",
      address: "East Legon, Accra",
      product: "Samsung Galaxy S25",
      planReference: "LAY-2026-00482",
      productPrice: 8400,
      paid: 3920,
      nextPayment: "2026-10-02",
      frequency: "Weekly",
      status: "Active",
    },
    {
      id: "CUS-10504",
      storeId: "cytech-gadgets",
      agentId: "AGT-0018",
      fullName: "Kwame Asare",
      phone: "+233 55 102 9044",
      email: "kwame.asare@example.com",
      address: "Osu, Accra",
      product: "MacBook Pro 14-inch M3",
      planReference: "LAY-2026-00504",
      productPrice: 18500,
      paid: 7400,
      nextPayment: "2026-09-29",
      frequency: "Monthly",
      status: "Overdue",
    },
    {
      id: "CUS-10531",
      storeId: "cytech-gadgets",
      agentId: "AGT-0021",
      fullName: "Esi Boateng",
      phone: "+233 27 882 4100",
      email: "esi.boateng@example.com",
      address: "Ridge, Accra",
      product: "Hisense 55-inch Smart TV",
      planReference: "LAY-2026-00531",
      productPrice: 6200,
      paid: 2800,
      nextPayment: "2026-10-01",
      frequency: "Weekly",
      status: "Active",
    },
  ],
  collections: [
    {
      id: "COL-2026-10081",
      storeId: "cytech-gadgets",
      agentId: "AGT-0018",
      customerId: "CUS-10482",
      planReference: "LAY-2026-00482",
      amount: 280,
      method: "Cash",
      note: "Weekly installment",
      recordedAt: "2026-09-28T09:12:00.000Z",
      status: "Unsettled",
    },
    {
      id: "COL-2026-10080",
      storeId: "cytech-gadgets",
      agentId: "AGT-0018",
      customerId: "CUS-10504",
      planReference: "LAY-2026-00504",
      amount: 950,
      method: "Mobile Money",
      note: "Part payment",
      recordedAt: "2026-09-27T15:40:00.000Z",
      status: "Unsettled",
    },
    {
      id: "COL-2026-10064",
      storeId: "cytech-gadgets",
      agentId: "AGT-0021",
      customerId: "CUS-10531",
      planReference: "LAY-2026-00531",
      amount: 340,
      method: "Cash",
      note: "Weekly installment",
      recordedAt: "2026-09-25T11:20:00.000Z",
      status: "Settled",
      settlementId: "AST-2026-0031",
    },
  ],
  settlements: [
    {
      id: "AST-2026-0031",
      storeId: "cytech-gadgets",
      agentId: "AGT-0021",
      collectionIds: ["COL-2026-10064"],
      amount: 340,
      closeMethod: "Cash handed over",
      note: "Cash counted and confirmed",
      closedAt: "2026-09-25T17:05:00.000Z",
      status: "Closed",
    },
  ],
})

export function loadFieldAgentData(): FieldAgentData {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    const data = saved ? JSON.parse(saved) as FieldAgentData : defaults()
    return {
      ...data,
      agents: data.agents.map((agent) => ({
        ...agent,
        profilePhoto: agent.profilePhoto ?? "",
        ghanaCardFront: agent.ghanaCardFront ?? "",
        ghanaCardBack: agent.ghanaCardBack ?? "",
        digitalAddress: agent.digitalAddress ?? "",
        region: agent.region ?? "Greater Accra",
        nextOfKin: agent.nextOfKin ?? {
          fullName: "",
          relationship: "",
          phone: "",
          address: "",
        },
        parents: agent.parents ?? {
          fatherName: "",
          fatherPhone: "",
          motherName: "",
          motherPhone: "",
        },
        guarantor: agent.guarantor ?? {
          fullName: "",
          relationship: "",
          phone: "",
          ghanaCard: "",
          address: "",
          digitalAddress: "",
        },
      })),
    }
  } catch {
    return defaults()
  }
}

export function saveFieldAgentData(data: FieldAgentData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  window.dispatchEvent(new CustomEvent(FIELD_AGENT_EVENT))
}

export function authenticateFieldAgent(identifier: string, password: string) {
  const normalized = identifier.trim().toLowerCase()
  return loadFieldAgentData().agents.find(
    (agent) =>
      agent.status === "Active" &&
      (agent.email.toLowerCase() === normalized ||
        agent.phone.replace(/\s/g, "") === identifier.replace(/\s/g, "")) &&
      agent.password === password,
  )
}

export function createFieldAgent(
  storeId: string,
  input: Omit<FieldAgent, "id" | "storeId" | "storeName" | "status" | "createdAt">,
) {
  const data = loadFieldAgentData()
  const email = input.email.trim().toLowerCase()
  const phone = input.phone.trim()
  const normalizedPhone = phone.replace(/\s/g, "")
  if (data.agents.some((item) => item.email.trim().toLowerCase() === email)) {
    throw new Error("An agent account already uses this email address.")
  }
  if (
    data.agents.some(
      (item) => item.phone.replace(/\s/g, "") === normalizedPhone,
    )
  ) {
    throw new Error("An agent account already uses this phone number.")
  }
  const agent: FieldAgent = {
    ...input,
    fullName: input.fullName.trim(),
    phone,
    email,
    ghanaCard: input.ghanaCard.trim().toUpperCase(),
    address: input.address.trim(),
    digitalAddress: input.digitalAddress.trim().toUpperCase(),
    region: input.region.trim(),
    area: input.area.trim(),
    nextOfKin: {
      fullName: input.nextOfKin.fullName.trim(),
      relationship: input.nextOfKin.relationship.trim(),
      phone: input.nextOfKin.phone.trim(),
      address: input.nextOfKin.address.trim(),
    },
    parents: {
      fatherName: input.parents.fatherName.trim(),
      fatherPhone: input.parents.fatherPhone.trim(),
      motherName: input.parents.motherName.trim(),
      motherPhone: input.parents.motherPhone.trim(),
    },
    guarantor: {
      fullName: input.guarantor.fullName.trim(),
      relationship: input.guarantor.relationship.trim(),
      phone: input.guarantor.phone.trim(),
      ghanaCard: input.guarantor.ghanaCard.trim().toUpperCase(),
      address: input.guarantor.address.trim(),
      digitalAddress: input.guarantor.digitalAddress.trim().toUpperCase(),
    },
    id: `AGT-${String(Date.now()).slice(-5)}`,
    storeId,
    storeName:
      storeId === "cytech-gadgets" ? "CYTECH Gadgets" : "Partner Store",
    status: "Active",
    createdAt: new Date().toISOString(),
  }
  saveFieldAgentData({ ...data, agents: [agent, ...data.agents] })
  return agent
}

export function recordAgentCollection(
  agentId: string,
  customerId: string,
  amount: number,
  method: AgentCollection["method"],
  note: string,
) {
  const data = loadFieldAgentData()
  const agent = data.agents.find((item) => item.id === agentId)
  const customer = data.customers.find(
    (item) => item.id === customerId && item.agentId === agentId,
  )
  if (
    !agent ||
    !customer ||
    amount <= 0 ||
    amount > customer.productPrice - customer.paid
  )
    return null
  const collection: AgentCollection = {
    id: `COL-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`,
    storeId: agent.storeId,
    agentId,
    customerId,
    planReference: customer.planReference,
    amount,
    method,
    note,
    recordedAt: new Date().toISOString(),
    status: "Unsettled",
  }
  const customers = data.customers.map((item) =>
    item.id === customerId
      ? {
          ...item,
          paid: item.paid + amount,
          status:
            item.paid + amount >= item.productPrice
              ? "Fully Paid" as const
              : item.status,
        }
      : item,
  )
  saveFieldAgentData({
    ...data,
    customers,
    collections: [collection, ...data.collections],
  })
  return collection
}

export function registerAgentCustomer(
  agentId: string,
  input: Omit<AgentCustomer, "id" | "storeId" | "agentId" | "registeredByAgentId" | "paid" | "status">,
) {
  const data = loadFieldAgentData()
  const agent = data.agents.find((item) => item.id === agentId)
  if (!agent) return null
  const customer: AgentCustomer = {
    ...input,
    id: `CUS-${String(Date.now()).slice(-5)}`,
    storeId: agent.storeId,
    agentId,
    registeredByAgentId: agentId,
    paid: 0,
    status: "Active",
  }
  saveFieldAgentData({ ...data, customers: [customer, ...data.customers] })
  return customer
}

export function assignCustomerToAgent(customerId: string, agentId: string) {
  const data = loadFieldAgentData()
  const agent = data.agents.find((item) => item.id === agentId)
  if (!agent) return
  saveFieldAgentData({
    ...data,
    customers: data.customers.map((customer) =>
      customer.id === customerId && customer.storeId === agent.storeId
        ? { ...customer, agentId }
        : customer,
    ),
  })
}

export function closeAgentAccount(
  storeId: string,
  agentId: string,
  closeMethod: AgentSettlement["closeMethod"],
  note: string,
) {
  const data = loadFieldAgentData()
  const eligible = data.collections.filter(
    (collection) =>
      collection.storeId === storeId &&
      collection.agentId === agentId &&
      collection.status === "Unsettled",
  )
  if (!eligible.length) return null
  const settlement: AgentSettlement = {
    id: `AST-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`,
    storeId,
    agentId,
    collectionIds: eligible.map((item) => item.id),
    amount: eligible.reduce((sum, item) => sum + item.amount, 0),
    closeMethod,
    note,
    closedAt: new Date().toISOString(),
    status: "Closed",
  }
  saveFieldAgentData({
    ...data,
    collections: data.collections.map((collection) =>
      eligible.some((item) => item.id === collection.id)
        ? { ...collection, status: "Settled", settlementId: settlement.id }
        : collection,
    ),
    settlements: [settlement, ...data.settlements],
  })
  return settlement
}

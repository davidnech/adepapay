export type ApplicationStage =
  | "Store Review"
  | "Store Documents Required"
  | "Admin Review"
  | "Admin Documents Required"
  | "Approved"
  | "Rejected by Store"
  | "Rejected by Admin"

export type ApplicationDocument = {
  name: string
  status: "Verified" | "Pending" | "Requested"
}

export type ApplicationHistory = {
  at: string
  actor: "Customer" | "Store" | "Admin"
  action: string
  note: string
}

export type HirePurchaseApplication = {
  reference: string
  storeId: string
  storeName: string
  customerId: string
  customerName: string
  phone: string
  product: string
  amount: number
  deposit: number
  installment: number
  tenureMonths: number
  riskScore: number
  riskLevel: "Low" | "Medium" | "High" | "Review"
  submittedAt: string
  stage: ApplicationStage
  storeDecision: "Pending" | "Forwarded" | "Documents Required" | "Rejected"
  adminDecision: "Not Submitted" | "Pending" | "Documents Required" | "Approved" | "Rejected"
  requestedDocuments: string[]
  documents: ApplicationDocument[]
  history: ApplicationHistory[]
  agreementStatus: "Not Available" | "Ready to Generate" | "Draft" | "Awaiting Customer" | "Accepted"
}

const STORAGE_KEY = "adepapay.hire-purchase-applications.v1"
export const HIRE_PURCHASE_EVENT = "adepapay-hire-purchase-applications-updated"

const commonDocuments: ApplicationDocument[] = [
  { name: "Customer Ghana Card", status: "Verified" },
  { name: "Proof of income", status: "Verified" },
  { name: "Guarantor 1 Ghana Card", status: "Verified" },
  { name: "Guarantor 2 Ghana Card", status: "Verified" },
]

const defaults = (): HirePurchaseApplication[] => [
  {
    reference: "BPA-2026-004582",
    storeId: "cytech-gadgets",
    storeName: "CYTECH Gadgets",
    customerId: "BPC-002117",
    customerName: "Ama Owusu",
    phone: "+233 20 918 4405",
    product: "MacBook Pro 14-inch",
    amount: 12800,
    deposit: 2560,
    installment: 853.33,
    tenureMonths: 12,
    riskScore: 58,
    riskLevel: "Medium",
    submittedAt: "2026-09-28T10:32:00.000Z",
    stage: "Admin Review",
    storeDecision: "Forwarded",
    adminDecision: "Pending",
    requestedDocuments: [],
    documents: commonDocuments,
    history: [
      { at: "2026-09-28T10:32:00.000Z", actor: "Customer", action: "Application submitted", note: "Application and supporting documents submitted to CYTECH Gadgets." },
      { at: "2026-09-29T09:15:00.000Z", actor: "Store", action: "Forwarded to Admin", note: "Store checks completed. Submitted for platform approval." },
    ],
    agreementStatus: "Not Available",
  },
  {
    reference: "BPA-2026-004511",
    storeId: "cytech-gadgets",
    storeName: "CYTECH Gadgets",
    customerId: "BPC-001842",
    customerName: "Kwame Asante",
    phone: "+233 24 601 1182",
    product: "Samsung Galaxy S25",
    amount: 9450,
    deposit: 1890,
    installment: 630,
    tenureMonths: 12,
    riskScore: 22,
    riskLevel: "Low",
    submittedAt: "2026-09-29T14:08:00.000Z",
    stage: "Store Review",
    storeDecision: "Pending",
    adminDecision: "Not Submitted",
    requestedDocuments: [],
    documents: commonDocuments,
    history: [{ at: "2026-09-29T14:08:00.000Z", actor: "Customer", action: "Application submitted", note: "Application received by CYTECH Gadgets." }],
    agreementStatus: "Not Available",
  },
  {
    reference: "BPA-2026-004402",
    storeId: "cytech-gadgets",
    storeName: "CYTECH Gadgets",
    customerId: "BPC-002601",
    customerName: "Yaw Boateng",
    phone: "+233 27 331 7004",
    product: "Dell XPS 13",
    amount: 11200,
    deposit: 2240,
    installment: 746.67,
    tenureMonths: 12,
    riskScore: 81,
    riskLevel: "High",
    submittedAt: "2026-09-26T11:22:00.000Z",
    stage: "Admin Documents Required",
    storeDecision: "Forwarded",
    adminDecision: "Documents Required",
    requestedDocuments: ["Latest three months bank statements", "Updated employer confirmation letter"],
    documents: [...commonDocuments, { name: "Latest bank statements", status: "Requested" }],
    history: [
      { at: "2026-09-26T11:22:00.000Z", actor: "Customer", action: "Application submitted", note: "Application received by CYTECH Gadgets." },
      { at: "2026-09-27T08:40:00.000Z", actor: "Store", action: "Forwarded to Admin", note: "Store review completed with an affordability note." },
      { at: "2026-09-28T13:05:00.000Z", actor: "Admin", action: "Further documents requested", note: "Updated affordability documents are required before a decision." },
    ],
    agreementStatus: "Not Available",
  },
]

export function loadHirePurchaseApplications() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) as HirePurchaseApplication[] : defaults()
  } catch {
    return defaults()
  }
}

export function saveHirePurchaseApplications(applications: HirePurchaseApplication[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(applications))
  window.dispatchEvent(new CustomEvent(HIRE_PURCHASE_EVENT))
}

export function updateHirePurchaseApplication(reference: string, update: (application: HirePurchaseApplication) => HirePurchaseApplication) {
  const applications = loadHirePurchaseApplications()
  const next = applications.map((application) => application.reference === reference ? update(application) : application)
  saveHirePurchaseApplications(next)
}

export function submitDemoHirePurchaseApplication() {
  const applications = loadHirePurchaseApplications()
  if (applications.some((application) => application.reference === "BPA-2026-004913")) return
  const application: HirePurchaseApplication = {
    reference: "BPA-2026-004913",
    storeId: "cytech-gadgets",
    storeName: "CYTECH Gadgets",
    customerId: "BPC-003014",
    customerName: "Emmanuel Agyeman",
    phone: "+233 24 555 0182",
    product: "Samsung 65-inch QLED TV",
    amount: 8400,
    deposit: 1680,
    installment: 560,
    tenureMonths: 12,
    riskScore: 50,
    riskLevel: "Review",
    submittedAt: new Date().toISOString(),
    stage: "Store Review",
    storeDecision: "Pending",
    adminDecision: "Not Submitted",
    requestedDocuments: [],
    documents: commonDocuments,
    history: [{ at: new Date().toISOString(), actor: "Customer", action: "Application submitted", note: "Application and guarantor documents submitted to the store." }],
    agreementStatus: "Not Available",
  }
  saveHirePurchaseApplications([application, ...applications])
}

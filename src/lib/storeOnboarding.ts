export type StoreApprovalStatus = "New" | "Under Review" | "Documents Required" | "Approved" | "Rejected"

export type StoreApprovalDocument = {
  name: string
  status: "Verified" | "Pending Review" | "Requested"
}

export type StoreApprovalHistory = {
  at: string
  actor: string
  action: string
  note: string
}

export type StoreOnboardingApplication = {
  reference: string
  storeName: string
  registeredName: string
  owner: string
  email: string
  phone: string
  category: string
  region: string
  location: string
  gps: string
  businessType: string
  registrationNumber: string
  taxId: string
  submittedAt: string
  progress: number
  risk: "Low Risk" | "Medium Risk" | "High Risk" | "Review"
  status: StoreApprovalStatus
  reviewer: string
  requestedDocuments: string[]
  adminNote: string
  storeMessage: string
  documents: StoreApprovalDocument[]
  history: StoreApprovalHistory[]
}

const STORAGE_KEY = "adepapay.store-onboarding-approvals.v1"
export const STORE_APPROVAL_EVENT = "adepapay-store-approval-updated"

const documents = (): StoreApprovalDocument[] => [
  { name: "Business registration certificate", status: "Verified" },
  { name: "Owner Ghana Card", status: "Verified" },
  { name: "Tax certificate", status: "Verified" },
  { name: "Proof of business address", status: "Pending Review" },
  { name: "Bank settlement document", status: "Verified" },
]

const defaults = (): StoreOnboardingApplication[] => [
  {
    reference: "BPSA-2026-00182", storeName: "CYTECH Gadgets", registeredName: "CYTECH Digital Solutions Ltd", owner: "Emmanuel Agyeman", email: "emmanuel@cytechgadgets.com", phone: "+233 24 880 1931", category: "Electronics", region: "Greater Accra", location: "Oxford Street, Osu, Accra", gps: "GA-183-4408", businessType: "Limited Liability Company", registrationNumber: "CS284712024", taxId: "C0034182291", submittedAt: "2026-08-02T10:32:00.000Z", progress: 82, risk: "Low Risk", status: "Under Review", reviewer: "Emmanuel", requestedDocuments: [], adminNote: "", storeMessage: "", documents: documents(), history: [
      { at: "2026-08-02T10:32:00.000Z", actor: "Store", action: "Application submitted", note: "Store onboarding packet submitted for platform review." },
      { at: "2026-08-03T09:10:00.000Z", actor: "Admin", action: "Reviewer assigned", note: "Assigned to Emmanuel for verification." },
    ],
  },
  {
    reference: "BPSA-2026-00179", storeName: "Adepa Home", registeredName: "Adepa Home & Living Ltd", owner: "Mavis Serwaa", email: "mavis@adepahome.com", phone: "+233 20 448 0092", category: "Furniture", region: "Ashanti", location: "Adum, Kumasi", gps: "AK-039-1842", businessType: "Limited Liability Company", registrationNumber: "CS297110226", taxId: "C0041183207", submittedAt: "2026-08-01T13:20:00.000Z", progress: 61, risk: "Medium Risk", status: "Documents Required", reviewer: "Kwesi Annan", requestedDocuments: ["Clear utility bill", "Updated bank settlement letter"], adminNote: "Address evidence is incomplete.", storeMessage: "Please upload a clear utility bill and an updated bank settlement letter.", documents: [...documents(), { name: "Updated bank settlement letter", status: "Requested" }], history: [
      { at: "2026-08-01T13:20:00.000Z", actor: "Store", action: "Application submitted", note: "Store onboarding application received." },
      { at: "2026-08-03T14:05:00.000Z", actor: "Admin", action: "Further documents requested", note: "Address and settlement evidence require clarification." },
    ],
  },
  {
    reference: "BPSA-2026-00174", storeName: "Prime Mobility", registeredName: "Prime Mobility Ghana Ltd", owner: "Kojo Badu", email: "kojo@primemobility.com", phone: "+233 55 311 2400", category: "Automotive", region: "Greater Accra", location: "Spintex Road, Accra", gps: "GT-341-9021", businessType: "Limited Liability Company", registrationNumber: "CS210948225", taxId: "C0091736201", submittedAt: "2026-07-31T08:45:00.000Z", progress: 100, risk: "Low Risk", status: "Approved", reviewer: "Emmanuel", requestedDocuments: [], adminNote: "All compliance and settlement checks passed.", storeMessage: "Your store is approved and can begin setup.", documents: documents().map((item) => ({ ...item, status: "Verified" })), history: [
      { at: "2026-07-31T08:45:00.000Z", actor: "Store", action: "Application submitted", note: "Store onboarding application received." },
      { at: "2026-08-02T11:30:00.000Z", actor: "Admin", action: "Store approved", note: "All verification checks completed successfully." },
    ],
  },
]

export function loadStoreOnboardingApplications() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) as StoreOnboardingApplication[] : defaults()
  } catch { return defaults() }
}

export function saveStoreOnboardingApplications(applications: StoreOnboardingApplication[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(applications))
  window.dispatchEvent(new CustomEvent(STORE_APPROVAL_EVENT))
}

export function updateStoreOnboardingApplication(reference: string, update: (application: StoreOnboardingApplication) => StoreOnboardingApplication) {
  const applications = loadStoreOnboardingApplications()
  saveStoreOnboardingApplications(applications.map((application) => application.reference === reference ? update(application) : application))
}

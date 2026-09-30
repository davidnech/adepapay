export type CustomerRiskLevel = "Low" | "Medium" | "High" | "Review"

export type CustomerRiskFactor = {
  label: string
  result: string
  impact: "Positive" | "Watch" | "Adverse"
}

export type CustomerRiskAssessment = {
  score: number
  level: CustomerRiskLevel
  assessedAt: string
  modelVersion: string
  summary: string
  factors: CustomerRiskFactor[]
}

const assessments: Record<string, CustomerRiskAssessment> = {
  "BPC-001842": {
    score: 22,
    level: "Low",
    assessedAt: "September 28, 2026",
    modelVersion: "Risk Profile v1.0",
    summary: "Verified identity and a consistently on-time repayment history reduce the current risk level.",
    factors: [
      { label: "Identity verification", result: "Ghana Card and selfie verified", impact: "Positive" },
      { label: "Payment performance", result: "No missed installments", impact: "Positive" },
      { label: "Affordability", result: "Installment-to-income ratio is healthy", impact: "Positive" },
      { label: "Active exposure", result: "2 active hire-purchase plans", impact: "Watch" },
    ],
  },
  "BPC-002117": {
    score: 58,
    level: "Medium",
    assessedAt: "September 28, 2026",
    modelVersion: "Risk Profile v1.0",
    summary: "The profile needs closer review because of an overdue balance and increased active exposure.",
    factors: [
      { label: "Identity verification", result: "Ghana Card and selfie verified", impact: "Positive" },
      { label: "Payment performance", result: "One current overdue installment", impact: "Adverse" },
      { label: "Affordability", result: "Installment-to-income ratio is moderate", impact: "Watch" },
      { label: "Active exposure", result: "GHS 4,960 currently outstanding", impact: "Watch" },
    ],
  },
  "BPC-002601": {
    score: 81,
    level: "High",
    assessedAt: "September 28, 2026",
    modelVersion: "Risk Profile v1.0",
    summary: "Payment arrears and a restricted account require manual review before any new approval.",
    factors: [
      { label: "Identity verification", result: "Identity verified", impact: "Positive" },
      { label: "Payment performance", result: "Multiple late-payment signals", impact: "Adverse" },
      { label: "Affordability", result: "Further evidence is required", impact: "Watch" },
      { label: "Account controls", result: "Account currently restricted", impact: "Adverse" },
    ],
  },
}

export function getCustomerRisk(customerId: string): CustomerRiskAssessment {
  const saved = assessments[customerId]
  if (saved) return saved
  return {
    score: 50,
    level: "Review",
    assessedAt: "Pending assessment",
    modelVersion: "Risk Profile v1.0",
    summary: "This customer has applied for hire purchase and requires an initial risk assessment.",
    factors: [
      { label: "Identity verification", result: "Awaiting verification results", impact: "Watch" },
      { label: "Payment performance", result: "Insufficient platform history", impact: "Watch" },
      { label: "Affordability", result: "Income evidence under review", impact: "Watch" },
      { label: "Active exposure", result: "Application exposure being calculated", impact: "Watch" },
    ],
  }
}

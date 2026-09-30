export const DEFAULT_COUNTRY = "GH"
export const DEFAULT_COUNTRY_NAME = "Ghana"
export const DEFAULT_CURRENCY = "GHS"
export const DEFAULT_CURRENCY_NAME = "Ghana Cedi"
export const DEFAULT_LOCALE = "en-GH"
export const DEFAULT_TIMEZONE = "Africa/Accra"
export const DEFAULT_PHONE_CODE = "+233"

export const GHANA_REGION_CAPITALS = [
  { region: "Ahafo", capital: "Goaso" },
  { region: "Ashanti", capital: "Kumasi" },
  { region: "Bono", capital: "Sunyani" },
  { region: "Bono East", capital: "Techiman" },
  { region: "Central", capital: "Cape Coast" },
  { region: "Eastern", capital: "Koforidua" },
  { region: "Greater Accra", capital: "Accra" },
  { region: "North East", capital: "Nalerigu" },
  { region: "Northern", capital: "Tamale" },
  { region: "Oti", capital: "Dambai" },
  { region: "Savannah", capital: "Damongo" },
  { region: "Upper East", capital: "Bolgatanga" },
  { region: "Upper West", capital: "Wa" },
  { region: "Volta", capital: "Ho" },
  { region: "Western", capital: "Sekondi-Takoradi" },
  { region: "Western North", capital: "Sefwi Wiawso" },
] as const

export const GHANA_REGIONS = GHANA_REGION_CAPITALS.map(({ region }) => region)
export const GHANA_LOCATION_OPTIONS = GHANA_REGION_CAPITALS.map(
  ({ region, capital }) => `${region}: ${capital}`,
)

export function getGhanaRegionalCapital(region: string) {
  return (
    GHANA_REGION_CAPITALS.find((item) => item.region === region)?.capital ?? ""
  )
}

export function formatCurrency(amount: number) {
  return `${DEFAULT_CURRENCY} ${amount.toLocaleString(DEFAULT_LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function normalizeGhanaPhoneNumber(value: string) {
  const compact = value.replace(/[^\d+]/g, "")

  if (/^0\d{9}$/.test(compact)) {
    return `${DEFAULT_PHONE_CODE}${compact.slice(1)}`
  }

  if (/^233\d{9}$/.test(compact)) {
    return `+${compact}`
  }

  if (/^\+233\d{9}$/.test(compact)) {
    return compact
  }

  return null
}

export function isValidGhanaPhoneNumber(value: string) {
  return normalizeGhanaPhoneNumber(value) !== null
}

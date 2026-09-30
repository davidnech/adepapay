export type PromotionScope = "All products" | "Category" | "Selected products"

export type StorePromotion = {
  id: string
  storeId: string
  name: string
  description: string
  discountPercent: number
  scope: PromotionScope
  categories: string[]
  productIds: number[]
  startsAt: string
  endsAt: string
  enabled: boolean
}

export type StorePromoCode = {
  id: string
  storeId: string
  code: string
  description: string
  discountPercent: number
  minimumSpend: number
  usageLimit: number
  usedCount: number
  expiresAt: string
  enabled: boolean
}

export type StorePromotionSettings = {
  storeId: string
  publicPromotionsEnabled: boolean
  campaigns: StorePromotion[]
  codes: StorePromoCode[]
}

export const PROMOTIONS_STORAGE_KEY = "adepapay-store-promotions-v2"
export const PROMOTIONS_UPDATED_EVENT = "adepapay-promotions-updated"
export const DEFAULT_STORE_ID = "cytech-gadgets"

export const DEFAULT_PROMOTION_SETTINGS: StorePromotionSettings = {
  storeId: DEFAULT_STORE_ID,
  publicPromotionsEnabled: true,
  campaigns: [
    {
      id: "campaign-launch-sale",
      storeId: DEFAULT_STORE_ID,
      name: "Tech Upgrade Sale",
      description: "Save on selected phones and laptops for a limited time.",
      discountPercent: 15,
      scope: "Category",
      categories: ["Phones", "Laptops"],
      productIds: [],
      startsAt: "2026-09-01",
      endsAt: "2026-12-31",
      enabled: true,
    },
  ],
  codes: [
    {
      id: "code-welcome10",
      storeId: DEFAULT_STORE_ID,
      code: "WELCOME10",
      description: "New customer reward",
      discountPercent: 10,
      minimumSpend: 100000,
      usageLimit: 100,
      usedCount: 24,
      expiresAt: "2026-12-31",
      enabled: true,
    },
  ],
}

const storageKeyForStore = (storeId: string) => `${PROMOTIONS_STORAGE_KEY}:${storeId}`
const cloneDefaults = (storeId: string) => {
  const defaults = JSON.parse(JSON.stringify(DEFAULT_PROMOTION_SETTINGS)) as StorePromotionSettings
  if (storeId === DEFAULT_STORE_ID) return defaults
  return { storeId, publicPromotionsEnabled: true, campaigns: [], codes: [] }
}

export function loadPromotionSettings(storeId = DEFAULT_STORE_ID): StorePromotionSettings {
  if (typeof window === "undefined") return cloneDefaults(storeId)
  try {
    const stored = window.localStorage.getItem(storageKeyForStore(storeId))
    if (!stored) return cloneDefaults(storeId)
    const parsed = JSON.parse(stored) as Partial<StorePromotionSettings>
    return {
      storeId,
      publicPromotionsEnabled: parsed.publicPromotionsEnabled ?? true,
      campaigns: Array.isArray(parsed.campaigns) ? parsed.campaigns.filter((campaign) => campaign.storeId === storeId) : [],
      codes: Array.isArray(parsed.codes) ? parsed.codes.filter((code) => code.storeId === storeId) : [],
    }
  } catch {
    return cloneDefaults(storeId)
  }
}

export function savePromotionSettings(settings: StorePromotionSettings) {
  if (typeof window === "undefined") return
  const scopedSettings = {
    ...settings,
    campaigns: settings.campaigns.filter((campaign) => campaign.storeId === settings.storeId),
    codes: settings.codes.filter((code) => code.storeId === settings.storeId),
  }
  window.localStorage.setItem(storageKeyForStore(settings.storeId), JSON.stringify(scopedSettings))
  window.dispatchEvent(new CustomEvent(PROMOTIONS_UPDATED_EVENT, { detail: { storeId: settings.storeId } }))
}

const endOfDay = (date: string) => new Date(`${date}T23:59:59`).getTime()
const startOfDay = (date: string) => new Date(`${date}T00:00:00`).getTime()

export function isCampaignActive(campaign: StorePromotion, now = Date.now()) {
  return campaign.enabled && startOfDay(campaign.startsAt) <= now && endOfDay(campaign.endsAt) >= now
}

export function campaignAppliesToProduct(campaign: StorePromotion, product: { id: number; category: string }) {
  if (campaign.scope === "All products") return true
  if (campaign.scope === "Category") return campaign.categories.includes(product.category)
  return campaign.productIds.includes(product.id)
}

export function getProductPromotion(settings: StorePromotionSettings, product: { id: number; category: string }) {
  if (!settings.publicPromotionsEnabled) return undefined
  return settings.campaigns
    .filter((campaign) => campaign.storeId === settings.storeId && isCampaignActive(campaign) && campaignAppliesToProduct(campaign, product))
    .sort((a, b) => b.discountPercent - a.discountPercent)[0]
}

export function discountedPrice(price: number, discountPercent: number) {
  return Math.max(0, Math.round(price * (1 - discountPercent / 100)))
}

export function validatePromoCode(settings: StorePromotionSettings, rawCode: string, productPrice: number, storeId = settings.storeId) {
  const normalized = rawCode.trim().toUpperCase()
  if (settings.storeId !== storeId) return { valid: false as const, message: "This promo code belongs to another store." }
  const code = settings.codes.find((item) => item.storeId === storeId && item.code.toUpperCase() === normalized)
  if (!normalized) return { valid: false as const, message: "Enter a promo code." }
  if (!code || !code.enabled) return { valid: false as const, message: "This promo code is not valid." }
  if (endOfDay(code.expiresAt) < Date.now()) return { valid: false as const, message: "This promo code has expired." }
  if (code.usedCount >= code.usageLimit) return { valid: false as const, message: "This promo code has reached its usage limit." }
  if (productPrice < code.minimumSpend) return { valid: false as const, message: `Minimum spend is ${code.minimumSpend.toLocaleString()}.` }
  return { valid: true as const, code, discountAmount: Math.round(productPrice * code.discountPercent / 100) }
}

export function redeemPromoCode(settings: StorePromotionSettings, codeId: string) {
  const next = {
    ...settings,
    codes: settings.codes.map((code) => code.id === codeId ? { ...code, usedCount: code.usedCount + 1 } : code),
  }
  savePromotionSettings(next)
  return next
}

export class ApplicationError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
  }
}
export async function applicationRequest(path: string, data?: unknown) {
  const response = await fetch(`/api/auth/${path}`, {
    method: data === undefined ? "GET" : "POST",
    credentials: "same-origin",
    headers: data === undefined ? {} : { "Content-Type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
    signal: AbortSignal.timeout(45000),
  })
  const result = await response.json().catch(() => null)
  if (!response.ok || !result)
    throw new ApplicationError(
      result?.error ||
        "Unable to complete the request. Refresh before retrying.",
      response.status,
    )
  return result
}
export const applicationKinds = {
  hire_purchase: "Hire purchase",
  layaway: "Layaway",
  swap: "Swap",
}
export type ApplicationKind = keyof typeof applicationKinds
export const formatMoney = (value: number | string) =>
  new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" }).format(
    Number(value),
  )

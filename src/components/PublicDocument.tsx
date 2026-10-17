import { useEffect } from "react"

// Retain the exact escaped server document: hydration never refetches prices.
export default function PublicDocument({ html }: { html: string }) {
  useEffect(() => {
    const cookieSettings = (event: MouseEvent) => {
      if ((event.target as HTMLElement).closest("[data-cookie-settings]")) window.dispatchEvent(new Event("cookie-settings"))
    }
    document.addEventListener("click", cookieSettings)
    return () => document.removeEventListener("click", cookieSettings)
  }, [])
  return <div data-public-content="" dangerouslySetInnerHTML={{ __html: html }} />
}

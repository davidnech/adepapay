export type UploadedImage = { id: string; url: string; upload_token?: string }
export type UploadProgress = {
  percent: number | null
  phase: "uploading" | "processing"
}

export default async function uploadImage(
  file: File,
  onProgress?: (progress: UploadProgress) => void,
  purpose: "store-profile" | "products" | "collection-agents" | "customer-application" | "customer-profile" = "store-profile",
): Promise<UploadedImage> {
  if (
    !["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.type)
  ) {
    throw new Error("Choose a JPEG, PNG, GIF or WebP image.")
  }
  if (file.size > 5 * 1024 * 1024)
    throw new Error("Images must be smaller than 5 MB.")
  const body = new FormData()
  body.append("image", file)
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open(
      "POST",
      purpose.startsWith("customer-")
        ? `/api/auth/customer/upload?purpose=${
            purpose === "customer-profile" ? "profile" : "application"
          }`
        : `/api/auth/images/upload?purpose=${purpose}`,
    )
    request.setRequestHeader("X-Requested-With", "AdepaPay")
    request.timeout = 120000
    request.responseType = "json"
    request.upload.onprogress = (event) => {
      onProgress?.({
        percent: event.lengthComputable
          ? Math.round((event.loaded / event.total) * 100)
          : null,
        phase: "uploading",
      })
    }
    // Transfer progress measures browser -> backend; Cloudflare still needs to finish.
    request.upload.onload = () =>
      onProgress?.({ percent: null, phase: "processing" })
    request.onload = () => {
      const result = request.response
      if (request.status < 200 || request.status >= 300 || !result?.image) {
        reject(
          new Error(result?.error || "Image upload failed. Please try again."),
        )
        return
      }
      resolve(result.image)
    }
    request.onerror = () =>
      reject(new Error("Cannot reach the upload server. Please try again."))
    request.ontimeout = () =>
      reject(new Error("Image upload timed out. Please try again."))
    request.onabort = () => reject(new Error("Image upload was cancelled."))
    onProgress?.({ percent: 0, phase: "uploading" })
    request.send(body)
  })
}

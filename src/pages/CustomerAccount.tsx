import { useEffect, useState, type FormEvent } from "react"

import { applicationRequest } from "../lib/applicationsApi"

import uploadImage, {
  type UploadedImage,
  type UploadProgress,
} from "../lib/imageUploader"

const input =
  "mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm"

const button =
  "rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold disabled:opacity-50"

type Account = {
  firstName: string
  middleName: string
  lastName: string
  phone: string
  region: string
  city: string
  address: string
  gender: string
  dob: string
  email: string
  nationality: string
  receiveUpdates: boolean
  photoUrl: string | null
}

export default function CustomerAccount({
  settings = false,
}: {
  settings?: boolean
}) {
  const [account, setAccount] = useState<Account | null>(null),
    [photo, setPhoto] = useState<UploadedImage | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState<UploadProgress | null>(null),
    [reload, setReload] = useState(0)

  const [password, setPassword] = useState({
    currentPassword: "",
    password: "",
    confirm: "",
  })

  useEffect(() => {
    let active = true
    setError("")
    applicationRequest("customer/account")
      .then((result) => {
        if (active) setAccount(result.account)
      })
      .catch((error) => {
        if (active) setError(error.message)
      })
    return () => {
      active = false
    }
  }, [reload])

  const save = async (event: FormEvent, security = false) => {
    event.preventDefault()
    if (busy) return
    setError("")
    setNotice("")

    if (security && password.password !== password.confirm) {
      setError("The new passwords do not match.")
      return
    }

    setBusy(true)

    try {
      const result = await applicationRequest(
        "customer/account",
        security ? { action: "password", ...password } : { ...account, photo },
      )
      if (security)
        setPassword({ currentPassword: "", password: "", confirm: "" })
      else {
        setAccount({
          ...result.account,
          photoUrl: result.account.photoUrl
            ? `${result.account.photoUrl}&v=${Date.now()}`
            : null,
        })
        setPhoto(null)
        window.dispatchEvent(new Event("customer-account-changed"))
      }
      setNotice(security ? "Password updated." : "Account saved.")
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Unable to save account.",
      )
    } finally {
      setBusy(false)
    }
  }

  const upload = async (file?: File) => {
    if (!file || busy) return
    setBusy(true)
    setError("")
    setNotice("")
    setProgress({ phase: "uploading", percent: 0 })
    try {
      setPhoto(await uploadImage(file, setProgress, "customer-profile"))
      setNotice("Image uploaded. Save your profile to keep it.")
    } catch (error) {
      setError(error instanceof Error ? error.message : "Upload failed.")
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-2xl font-bold">
        {settings ? "Account settings" : "My profile"}
      </h1>
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">
          {error}
          <button
            className={`${button} ml-3`}
            onClick={() => setReload((value) => value + 1)}
          >
            Reload
          </button>
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-xl bg-emerald-50 p-4 text-emerald-800"
        >
          {notice}
        </p>
      )}
      {!account && !error && <p>Loading account...</p>}
      {account && (
        <form
          onSubmit={(event) => void save(event)}
          className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6"
        >
          <fieldset disabled={busy} className="space-y-5">
            <div className="flex flex-wrap items-center gap-4">
              {(photo?.url || account.photoUrl) && (
                <img
                  src={photo?.url || account.photoUrl!}
                  alt="Your profile"
                  className="h-24 w-24 rounded-full object-cover"
                />
              )}
              <label
                className={`${button} cursor-pointer border-2 border-blue-300`}
              >
                Upload profile photo
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    event.target.value = ""
                    void upload(file)
                  }}
                />
              </label>
            </div>
            <p className="text-sm text-slate-500">Email: {account.email}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {([
                "firstName",
                "middleName",
                "lastName",
                "phone",
                "region",
                "city",
                "address",
                "dob",
              ] as const).map((key) => (
                <label key={key} className="text-sm font-semibold capitalize">
                  {key === "dob"
                    ? "Date of birth"
                    : key.replace(/([A-Z])/g, " $1")}
                  <input
                    required={key !== "middleName"}
                    maxLength={300}
                    type={key === "dob" ? "date" : "text"}
                    className={input}
                    value={account[key]}
                    onChange={(event) =>
                      setAccount({ ...account, [key]: event.target.value })
                    }
                  />
                </label>
              ))}
              <label className="text-sm font-semibold">
                Gender
                <select
                  className={input}
                  required
                  value={account.gender}
                  onChange={(event) =>
                    setAccount({ ...account, gender: event.target.value })
                  }
                >
                  <option value="">Choose gender</option>
                  <option>Male</option>
                  <option>Female</option>
                </select>
              </label>
              <label className="text-sm font-semibold">
                Nationality
                <input
                  readOnly
                  className={`${input} bg-slate-50`}
                  value="Ghana"
                />
              </label>
            </div>
            <label className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={account.receiveUpdates}
                onChange={(event) =>
                  setAccount({
                    ...account,
                    receiveUpdates: event.target.checked,
                  })
                }
              />
              Save my preference to receive product updates.
            </label>
            <button className={`${button} bg-blue-600 text-white`}>
              {busy ? "Saving..." : "Save profile"}
            </button>
          </fieldset>
          {progress && (
            <div role="status" className="text-sm">
              {progress.phase === "processing"
                ? "Processing image..."
                : `Uploading ${progress.percent ?? 0}%`}
              <progress
                className="mt-2 w-full"
                max={100}
                value={
                  progress.phase === "uploading"
                    ? (progress.percent ?? undefined)
                    : undefined
                }
              />
            </div>
          )}
        </form>
      )}
      {settings && (
        <form
          onSubmit={(event) => void save(event, true)}
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6"
        >
          <h2 className="text-lg font-bold">Change password</h2>
          <fieldset disabled={busy} className="space-y-4">
            {(["currentPassword", "password", "confirm"] as const).map(
              (key) => (
                <label key={key} className="block text-sm font-semibold">
                  {key === "currentPassword"
                    ? "Current password"
                    : key === "password"
                      ? "New password"
                      : "Confirm new password"}
                  <input
                    required
                    type="password"
                    minLength={key === "currentPassword" ? 1 : 8}
                    maxLength={256}
                    autoComplete={
                      key === "currentPassword"
                        ? "current-password"
                        : "new-password"
                    }
                    value={password[key]}
                    className={input}
                    onChange={(event) =>
                      setPassword({ ...password, [key]: event.target.value })
                    }
                  />
                </label>
              ),
            )}
            <button className={`${button} bg-blue-600 text-white`}>
              {busy ? "Saving..." : "Update password"}
            </button>
          </fieldset>
        </form>
      )}
    </div>
  )
}

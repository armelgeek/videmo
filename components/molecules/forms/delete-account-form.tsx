"use client"

import { useState } from "react"
import { deleteAccount } from "@/actions/auth/delete-account"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

export function DeleteAccountForm() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!confirmed) return

    setErrors({})
    setIsLoading(true)

    const formData = new FormData(e.currentTarget)
    const result = await deleteAccount({
      password: formData.get("password"),
    })

    if (result.error) {
      setErrors({ submit: result.error })
      toast.error(result.error)
      setIsLoading(false)
    } else {
      toast.success("Account deleted")
      router.push("/auth/login")
    }
  }

  return (
    <form onSubmit={handleSubmit} className="auth-form" noValidate>
      <div className="auth-field">
        <label htmlFor="password" className="auth-label">Confirm with Password</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          disabled={isLoading}
          autoComplete="current-password"
          className="auth-input"
        />
      </div>

      <div className="flex items-center gap-2 my-4">
        <input
          id="confirm-delete"
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          disabled={isLoading}
          className="w-4 h-4"
        />
        <label htmlFor="confirm-delete" className="text-xs text-destructive">
          I understand this cannot be undone
        </label>
      </div>

      {errors.submit && <p className="auth-error">{errors.submit}</p>}

      <button 
        type="submit" 
        disabled={isLoading || !confirmed} 
        className="sk-btn bg-destructive text-white hover:opacity-80"
      >
        {isLoading ? "Deleting…" : "Delete My Account"}
      </button>
    </form>
  )
}

"use client"

import { useState } from "react"
import { initiateEmailChange } from "@/actions/auth/change-email"
import { toast } from "sonner"

export function ChangeEmailForm() {
  const [isLoading, setIsLoading] = useState(false)
  const [verifyMode, setVerifyMode] = useState(false)
  const [newEmail, setNewEmail] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrors({})
    setIsLoading(true)

    const result = await initiateEmailChange({ newEmail })

    if (result.error) {
      setErrors({ submit: result.error })
      toast.error(result.error)
    } else {
      setVerifyMode(true)
      toast.success("Verification email sent!")
    }
    setIsLoading(false)
  }

  if (verifyMode) {
    return (
      <form className="auth-form" noValidate>
        <p className="auth-hint">We sent a verification code to <strong>{newEmail}</strong>.</p>
        <p className="auth-hint text-xs">Click the link in the email to confirm your new email address.</p>
        
        <div className="auth-actions">
          <button
            type="button"
            onClick={() => { setVerifyMode(false); setNewEmail("") }}
            className="sk-btn"
            disabled={isLoading}
          >
            Back
          </button>
        </div>
      </form>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="auth-form" noValidate>
      <div className="auth-field">
        <label htmlFor="new-email" className="auth-label">New Email Address</label>
        <input
          id="new-email"
          type="email"
          required
          disabled={isLoading}
          autoComplete="email"
          className="auth-input"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
        />
      </div>

      {errors.submit && <p className="auth-error">{errors.submit}</p>}

      <button type="submit" disabled={isLoading || !newEmail} className="sk-btn sk-btn-main">
        {isLoading ? "Sending…" : "Change Email →"}
      </button>
    </form>
  )
}

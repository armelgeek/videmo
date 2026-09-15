"use client"

import { useState } from "react"
import { changePassword } from "@/actions/auth/change-password"
import { Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"

export function ChangePasswordForm() {
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showPassword, setShowPassword] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrors({})
    setIsLoading(true)

    const formData = new FormData(e.currentTarget)
    const result = await changePassword({
      currentPassword: formData.get("current-password"),
      newPassword: formData.get("new-password"),
      confirmPassword: formData.get("confirm-password"),
    })

    if (result.error) {
      setErrors({ submit: result.error })
      toast.error(result.error)
    } else {
      toast.success("Password changed successfully!")
      e.currentTarget.reset()
    }
    setIsLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="auth-form" noValidate>
      <div className="auth-field">
        <label htmlFor="current-password" className="auth-label">Current Password</label>
        <div className="auth-pass">
          <input
            id="current-password"
            name="current-password"
            type={showPassword ? "text" : "password"}
            required
            disabled={isLoading}
            autoComplete="current-password"
            className="auth-input"
          />
          <button
            type="button"
            className="auth-eye"
            onClick={() => setShowPassword(!showPassword)}
            aria-label="Toggle password visibility"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="auth-row">
        <div className="auth-field">
          <label htmlFor="new-password" className="auth-label">New Password</label>
          <input
            id="new-password"
            name="new-password"
            type={showPassword ? "text" : "password"}
            required
            disabled={isLoading}
            autoComplete="new-password"
            className="auth-input"
          />
        </div>
        <div className="auth-field">
          <label htmlFor="confirm-password" className="auth-label">Confirm</label>
          <input
            id="confirm-password"
            name="confirm-password"
            type={showPassword ? "text" : "password"}
            required
            disabled={isLoading}
            autoComplete="new-password"
            className="auth-input"
          />
        </div>
      </div>

      {errors.submit && <p className="auth-error">{errors.submit}</p>}

      <button type="submit" disabled={isLoading} className="sk-btn sk-btn-main">
        {isLoading ? "Updating…" : "Change Password →"}
      </button>
    </form>
  )
}

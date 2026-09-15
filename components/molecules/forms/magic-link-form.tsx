"use client"

import { useState } from "react"
import { toast } from "sonner"
import Link from "next/link"

const RESEND_COOLDOWN = 60000

export function MagicLinkForm({ redirectTo }: { redirectTo?: string }) {
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isCheckingEmail, setIsCheckingEmail] = useState(false)
  const [lastResendTime, setLastResendTime] = useState(0)

  async function handleSendMagicLink(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true)

    try {
      const res = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, redirectTo }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.message || "Failed to send magic link")
        setIsLoading(false)
        return
      }

      setIsCheckingEmail(true)
      setLastResendTime(Date.now())
      toast.success("Magic link sent to your email!")
    } catch (error: any) {
      toast.error(error.message || "Failed to send magic link")
    } finally {
      setIsLoading(false)
    }
  }

  async function handleResendMagicLink() {
    const elapsed = Date.now() - lastResendTime
    if (elapsed < RESEND_COOLDOWN) {
      toast.error(`Please wait ${Math.ceil((RESEND_COOLDOWN - elapsed) / 1000)} seconds before resending`)
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, redirectTo }),
      })

      if (!res.ok) throw new Error("Failed to resend")
      setLastResendTime(Date.now())
      toast.success("Magic link resent!")
    } catch (error: any) {
      toast.error(error.message || "Failed to resend magic link")
    } finally {
      setIsLoading(false)
    }
  }

  if (isCheckingEmail) {
    return (
      <form className="auth-form" noValidate>
        <h2>Check your email</h2>
        <p className="auth-hint">We sent a magic link to <strong>{email}</strong>.</p>
        <p className="auth-hint">Click the link in the email to sign in automatically.</p>
        <div className="auth-actions">
          <button
            type="button"
            onClick={handleResendMagicLink}
            disabled={isLoading}
            className="sk-btn"
          >
            Resend link
          </button>
          <button
            type="button"
            onClick={() => setIsCheckingEmail(false)}
            disabled={isLoading}
            className="sk-btn"
          >
            Back
          </button>
        </div>
      </form>
    )
  }

  return (
    <form onSubmit={handleSendMagicLink} className="auth-form" noValidate>
      <div className="auth-field">
        <label htmlFor="email" className="auth-label">Email</label>
        <input
          id="email"
          type="email"
          placeholder="you@example.com"
          required
          disabled={isLoading}
          autoComplete="email"
          className="auth-input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <button type="submit" disabled={isLoading || !email} className="sk-btn sk-btn-main">
        {isLoading ? "Sending…" : "Send magic link →"}
      </button>

      <p className="auth-hint text-center text-xs">
        We'll send you a secure link to sign in without a password.
      </p>
    </form>
  )
}

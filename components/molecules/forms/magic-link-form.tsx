"use client"

import { useState } from "react"
import { toast } from "sonner"
import { signIn } from "@/lib/auth-client"

const RESEND_COOLDOWN = 60000

export function MagicLinkForm({ redirectTo }: { redirectTo?: string }) {
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isCheckingEmail, setIsCheckingEmail] = useState(false)
  const [lastSentAt, setLastSentAt] = useState(0)

  async function sendLink() {
    setIsLoading(true)
    try {
      const { error } = await signIn.magicLink({
        email,
        callbackURL: redirectTo ?? "/dashboard",
        errorCallbackURL: "/login?error=magic-link",
      })
      if (error) {
        toast.error(error.message || "Failed to send magic link")
        return false
      }
      setLastSentAt(Date.now())
      return true
    } catch (error: any) {
      toast.error(error.message || "Failed to send magic link")
      return false
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (await sendLink()) {
      setIsCheckingEmail(true)
      toast.success("Magic link sent to your email!")
    }
  }

  async function handleResend() {
    const elapsed = Date.now() - lastSentAt
    if (elapsed < RESEND_COOLDOWN) {
      toast.error(`Please wait ${Math.ceil((RESEND_COOLDOWN - elapsed) / 1000)} seconds before resending`)
      return
    }
    if (await sendLink()) toast.success("Magic link resent!")
  }

  if (isCheckingEmail) {
    return (
      <div className="auth-form">
        <h2>Check your email</h2>
        <p className="auth-hint">We sent a sign-in link to <strong>{email}</strong>.</p>
        <p className="auth-hint">Click the link in the email to sign in.</p>
        <div className="auth-actions">
          <button type="button" onClick={handleResend} disabled={isLoading} className="sk-btn">
            Resend link
          </button>
          <button type="button" onClick={() => setIsCheckingEmail(false)} disabled={isLoading} className="sk-btn">
            Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="auth-form" noValidate>
      <div className="auth-field">
        <label htmlFor="magic-email" className="auth-label">Email</label>
        <input
          id="magic-email"
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

      <p className="auth-hint">We'll email you a secure link to sign in without a password.</p>
    </form>
  )
}

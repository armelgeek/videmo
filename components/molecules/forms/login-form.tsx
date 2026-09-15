"use client"

import { signIn, emailOtp, authClient } from "@/lib/auth-client"
import { getRedirectUrl } from "@/actions/users/get-redirect-url"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { z } from "zod"
import { Eye, EyeOff } from "lucide-react"

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
})

const RESEND_COOLDOWN = 60000

export function LoginForm({ redirectTo, isOtpFlow }: { redirectTo?: string; isOtpFlow?: boolean }) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showOtpVerification, setShowOtpVerification] = useState(false)
  const [showTwoFactor, setShowTwoFactor] = useState(false)
  const [totpCode, setTotpCode] = useState("")
  const [email, setEmail] = useState("")
  const [otp, setOtp] = useState("")
  const [lastResendTime, setLastResendTime] = useState(0)
  const [showPassword, setShowPassword] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true)
    setErrors({})

    const formData = new FormData(e.currentTarget)
    const emailValue = formData.get("email") as string
    const password = formData.get("password") as string

    const validation = loginSchema.safeParse({ email: emailValue, password })
    if (!validation.success) {
      const fieldErrors: Record<string, string> = {}
      validation.error.issues.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message
      })
      setErrors(fieldErrors)
      setIsLoading(false)
      return
    }

    try {
      const { data, error } = await signIn.email({ email: emailValue, password })

      if (error) {
        const msg = error.message?.toLowerCase() ?? ""
        if (msg.includes("email not verified") || msg.includes("verify")) {
          setEmail(emailValue)
          await handleSendOtp(emailValue)
          setShowOtpVerification(true)
          setIsLoading(false)
          return
        }
        toast.error(error.message || "Invalid email or password")
        setIsLoading(false)
        return
      }

      if ((data as any)?.twoFactorRedirect) {
        setEmail(emailValue)
        setShowTwoFactor(true)
        setIsLoading(false)
        return
      }

      toast.success("Logged in successfully!")
      router.push(await getRedirectUrl(redirectTo))
    } catch (error: any) {
      toast.error(error.message || "Failed to login")
      setIsLoading(false)
    }
  }

  async function handleSendOtp(emailValue: string) {
    try {
      const { error } = await emailOtp.sendVerificationOtp({ email: emailValue, type: "email-verification" })
      if (error) {
        toast.error(error.message || "Failed to send verification code")
      } else {
        toast.success("Verification code sent to your email!")
        setLastResendTime(Date.now())
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to send verification code")
    }
  }

  async function handleOtpVerification(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true)
    try {
      const { error } = await emailOtp.verifyEmail({ email, otp })
      if (error) {
        toast.error(error.message || "Invalid verification code")
        setIsLoading(false)
        return
      }
      toast.success("Email verified successfully! Please login again.")
      setShowOtpVerification(false)
      setOtp("")
      setIsLoading(false)
    } catch (error: any) {
      toast.error(error.message || "Failed to verify email")
      setIsLoading(false)
    }
  }

  async function handleResendOtp() {
    const elapsed = Date.now() - lastResendTime
    if (elapsed < RESEND_COOLDOWN) {
      toast.error(`Please wait ${Math.ceil((RESEND_COOLDOWN - elapsed) / 1000)} seconds before resending`)
      return
    }
    setIsLoading(true)
    await handleSendOtp(email)
    setIsLoading(false)
  }

  async function handleTwoFactorVerification(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true)
    try {
      const { error } = await (authClient as any).twoFactor.verifyTotp({ code: totpCode })
      if (error) {
        toast.error(error.message || "Invalid authentication code")
        setIsLoading(false)
        return
      }
      toast.success("Logged in successfully!")
      router.push(await getRedirectUrl(redirectTo))
    } catch (error: any) {
      toast.error(error.message || "Failed to verify code")
      setIsLoading(false)
    }
  }

  if (showTwoFactor) {
    return (
      <form onSubmit={handleTwoFactorVerification} className="auth-form">
        <h2>Two-step check</h2>
        <p className="auth-hint">Enter the 6-digit code from your authenticator app.</p>
        <input
          id="totp-login"
          aria-label="Authentication code"
          type="text"
          inputMode="numeric"
          placeholder="000000"
          maxLength={6}
          value={totpCode}
          onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
          required
          disabled={isLoading}
          autoComplete="one-time-code"
          className="auth-input is-code"
          autoFocus
        />
        <div className="auth-actions">
          <button type="submit" disabled={isLoading || totpCode.length !== 6} className="sk-btn sk-btn-main">
            {isLoading ? "Verifying…" : "Verify →"}
          </button>
          <button type="button" className="sk-btn" disabled={isLoading} onClick={() => { setShowTwoFactor(false); setTotpCode("") }}>
            Back
          </button>
        </div>
      </form>
    )
  }

  if (showOtpVerification) {
    return (
      <form onSubmit={handleOtpVerification} className="auth-form">
        <h2>Check your inbox</h2>
        <p className="auth-hint">We sent a 6-digit code to <strong>{email}</strong>.</p>
        <input
          id="otp"
          aria-label="Verification code"
          type="text"
          inputMode="numeric"
          placeholder="000000"
          maxLength={6}
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
          required
          disabled={isLoading}
          autoComplete="one-time-code"
          className="auth-input is-code"
          autoFocus
        />
        <div className="auth-actions">
          <button type="submit" disabled={isLoading || otp.length !== 6} className="sk-btn sk-btn-main">
            {isLoading ? "Verifying…" : "Verify email →"}
          </button>
          <button type="button" className="sk-btn" disabled={isLoading} onClick={handleResendOtp}>
            Resend code
          </button>
          <button type="button" className="sk-btn" disabled={isLoading} onClick={() => { setShowOtpVerification(false); setOtp("") }}>
            Back to sign in
          </button>
        </div>
      </form>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="auth-form" noValidate>
      <div className="auth-field">
        <label htmlFor="email" className="auth-label">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          placeholder="you@company.com"
          required
          disabled={isLoading}
          autoComplete="email"
          className="auth-input"
          aria-invalid={errors.email ? "true" : "false"}
          aria-describedby={errors.email ? "email-error" : undefined}
        />
        {errors.email && <p id="email-error" className="auth-error">{errors.email}</p>}
      </div>

      <div className="auth-field">
        <span className="auth-label">
          <label htmlFor="password">Password</label>
          <Link href="/forgot-password" className="auth-link">Forgot it?</Link>
        </span>
        <div className="auth-pass">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            required
            disabled={isLoading}
            autoComplete="current-password"
            className="auth-input"
            aria-invalid={errors.password ? "true" : "false"}
            aria-describedby={errors.password ? "password-error" : undefined}
          />
          <button
            type="button"
            className="auth-eye"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.password && <p id="password-error" className="auth-error">{errors.password}</p>}
      </div>

      <button type="submit" disabled={isLoading} className="sk-btn sk-btn-main">
        {isLoading ? "Signing in…" : "Sign in →"}
      </button>
    </form>
  )
}

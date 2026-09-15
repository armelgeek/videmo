"use client"

import { PhoneInput } from "@/components/ui/phone-input"
import { signUp, emailOtp } from "@/lib/auth-client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { z } from "zod"
import { isValidPhoneNumber, type Value } from "react-phone-number-input"
import { Eye, EyeOff } from "lucide-react"

const signupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().optional().refine((val) => {
    if (!val) return true
    try {
      return isValidPhoneNumber(val)
    } catch {
      return false
    }
  }, { message: "Please enter a valid phone number" }),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(8, "Password must be at least 8 characters"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
})

const STRENGTH_LABELS = ["Too weak", "Weak", "Fair", "Strong", "Very strong"]
const RESEND_COOLDOWN = 60000

function passwordScore(password: string) {
  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  return Math.max(1, Math.min(4, score))
}

export function SignupForm({ redirectTo }: { redirectTo?: string }) {
  const loginHref = redirectTo ? `/login?redirect=${encodeURIComponent(redirectTo)}` : "/login"
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [phone, setPhone] = useState<Value | undefined>()
  const [showOtpVerification, setShowOtpVerification] = useState(false)
  const [email, setEmail] = useState("")
  const [otp, setOtp] = useState("")
  const [lastResendTime, setLastResendTime] = useState(0)
  const [showPassword, setShowPassword] = useState(false)
  const [passwordValue, setPasswordValue] = useState("")

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrors({})

    const formData = new FormData(e.currentTarget)
    const name = formData.get("name") as string
    const emailValue = formData.get("email") as string
    const password = formData.get("password") as string
    const confirmPassword = formData.get("confirm-password") as string

    const validation = signupSchema.safeParse({ name, email: emailValue, phone: undefined, password, confirmPassword })
    if (!validation.success) {
      const fieldErrors: Record<string, string> = {}
      validation.error.issues.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message
      })
      setErrors(fieldErrors)
      return
    }

    setIsLoading(true)
    try {
      const { error } = await signUp.email({ email: emailValue, password, name, ...(phone ? { phone } : {}) } as any)
      if (error) {
        toast.error(error.message || "Failed to create account")
        setIsLoading(false)
        return
      }
      setEmail(emailValue)
      setShowOtpVerification(true)
      toast.success("Account created! Check your email for the verification code.")
      setLastResendTime(Date.now())
      setIsLoading(false)
    } catch (error: any) {
      toast.error(error.message || "Failed to create account")
      setIsLoading(false)
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
      toast.success("Email verified successfully!")
      router.push(loginHref)
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
    try {
      const { error } = await emailOtp.sendVerificationOtp({ email, type: "email-verification" })
      if (error) {
        toast.error(error.message || "Failed to resend code")
      } else {
        toast.success("Verification code resent!")
        setLastResendTime(Date.now())
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to resend code")
    } finally {
      setIsLoading(false)
    }
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
        </div>
      </form>
    )
  }

  const score = passwordValue ? passwordScore(passwordValue) : 0

  return (
    <form onSubmit={handleSubmit} className="auth-form" noValidate>
      <div className="auth-field">
        <label htmlFor="name" className="auth-label">Full name</label>
        <input
          id="name"
          name="name"
          type="text"
          placeholder="Jane Cooper"
          required
          disabled={isLoading}
          autoComplete="name"
          className="auth-input"
          aria-invalid={errors.name ? "true" : "false"}
          aria-describedby={errors.name ? "name-error" : undefined}
        />
        {errors.name && <p id="name-error" className="auth-error">{errors.name}</p>}
      </div>

      <div className="auth-field">
        <label htmlFor="email" className="auth-label">Work email</label>
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

      <div className="auth-row">
        <div className="auth-field">
          <label htmlFor="password" className="auth-label">Password</label>
          <div className="auth-pass">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              required
              disabled={isLoading}
              autoComplete="new-password"
              value={passwordValue}
              onChange={(e) => setPasswordValue(e.target.value)}
              className="auth-input"
              aria-invalid={errors.password ? "true" : "false"}
              aria-describedby={errors.password ? "password-error" : "password-hint"}
            />
            <button
              type="button"
              className="auth-eye"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide passwords" : "Show passwords"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
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
            aria-invalid={errors.confirmPassword ? "true" : "false"}
            aria-describedby={errors.confirmPassword ? "confirm-error" : undefined}
          />
        </div>
      </div>

      <div className="auth-field" id="password-hint">
        <div className="auth-strength" aria-hidden="true">
          {[1, 2, 3, 4].map((n) => <i key={n} className={n <= score ? "is-on" : undefined} />)}
        </div>
        <p className="auth-hint">{passwordValue ? STRENGTH_LABELS[score] : "At least 8 characters."}</p>
        {errors.password && <p id="password-error" className="auth-error">{errors.password}</p>}
        {errors.confirmPassword && <p id="confirm-error" className="auth-error">{errors.confirmPassword}</p>}
      </div>

      <button type="submit" disabled={isLoading} className="sk-btn sk-btn-main">
        {isLoading ? "Creating your account…" : "Create my account →"}
      </button>
    </form>
  )
}

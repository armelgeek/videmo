"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { signIn, emailOtp, authClient } from "@/lib/auth-client"
import { getRedirectUrl } from "@/actions/users/get-redirect-url"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { z } from "zod"
import { Eye, EyeOff, Mail, Lock, AlertCircle } from "lucide-react"

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
})

export function LoginForm({
  className,
  redirectTo,
  ...props
}: React.ComponentProps<"div"> & { redirectTo?: string }) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showOtpVerification, setShowOtpVerification] = useState(false)
  const [showTwoFactor, setShowTwoFactor] = useState(false)
  const [totpCode, setTotpCode] = useState("")
  const [email, setEmail] = useState("")
  const [otp, setOtp] = useState("")
  const [lastResendTime, setLastResendTime] = useState<number>(0)
  const [showPassword, setShowPassword] = useState(false)
  const RESEND_COOLDOWN = 60000 

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
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message
        }
      })
      setErrors(fieldErrors)
      setIsLoading(false)
      return
    }

    try {
      const { data, error } = await signIn.email({
        email: emailValue,
        password,
      })

      if (error) {
        
        if (error.message?.toLowerCase().includes("email not verified") || 
            error.message?.toLowerCase().includes("verify")) {
          
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
      const redirectUrl = await getRedirectUrl(redirectTo)
      router.push(redirectUrl)
    } catch (error: any) {
      toast.error(error.message || "Failed to login")
      setIsLoading(false)
    }
  }

  async function handleSendOtp(emailValue: string) {
    try {
      const { error } = await emailOtp.sendVerificationOtp({
        email: emailValue,
        type: 'email-verification',
      })

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
      const { data, error } = await emailOtp.verifyEmail({
        email,
        otp,
      })

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
    const now = Date.now()
    const timeSinceLastResend = now - lastResendTime
    
    if (timeSinceLastResend < RESEND_COOLDOWN) {
      const remainingSeconds = Math.ceil((RESEND_COOLDOWN - timeSinceLastResend) / 1000)
      toast.error(`Please wait ${remainingSeconds} seconds before resending`)
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
      const redirectUrl = await getRedirectUrl(redirectTo)
      router.push(redirectUrl)
    } catch (error: any) {
      toast.error(error.message || "Failed to verify code")
      setIsLoading(false)
    }
  }

  if (showTwoFactor) {
    return (
      <form onSubmit={handleTwoFactorVerification} className={cn("sk-field space-y-4", className)} {...props}>
        <div className="sk-field">
          <label htmlFor="totp-login" className="sk-label">
            Authentication Code
          </label>
          <input
            id="totp-login"
            type="text"
            inputMode="numeric"
            placeholder="000000"
            maxLength={6}
            value={totpCode}
            onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
              setTotpCode(e.target.value.replace(/\D/g, ""))
            }
            required
            disabled={isLoading}
            autoComplete="one-time-code"
            className="sk-input text-center text-3xl font-mono tracking-widest font-bold"
            autoFocus
          />
          <p className="sk-hint text-center">
            Open your authenticator app and enter the current 6-digit code
          </p>
        </div>

        <div className="sk-button-group">
          <button
            type="submit"
            disabled={isLoading || totpCode.length !== 6}
            className="sk-btn sk-btn-main flex-1"
          >
            {isLoading ? "Verifying..." : "Verify Code"}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowTwoFactor(false)
              setTotpCode("")
            }}
            disabled={isLoading}
            className="sk-btn flex-1"
          >
            Back
          </button>
        </div>
      </form>
    )
  }

  if (showOtpVerification) {
    return (
      <form onSubmit={handleOtpVerification} className={cn("sk-field space-y-4", className)} {...props}>
        <div className="sk-field">
          <label htmlFor="otp" className="sk-label">
            Verification Code
          </label>
          <input
            id="otp"
            type="text"
            placeholder="000000"
            maxLength={6}
            value={otp}
            onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
              setOtp(e.target.value.replace(/\D/g, ""))
            }
            required
            disabled={isLoading}
            className="sk-input text-center text-3xl font-mono tracking-widest font-bold"
            autoFocus
          />
          <p className="sk-hint">
            We sent a 6-digit code to <span className="font-medium text-foreground">{email}</span>
          </p>
        </div>

        <div className="sk-button-group">
          <button
            type="submit"
            disabled={isLoading || otp.length !== 6}
            className="sk-btn sk-btn-main flex-1"
          >
            {isLoading ? "Verifying..." : "Verify Email"}
          </button>
          <button
            type="button"
            onClick={handleResendOtp}
            disabled={isLoading}
            className="sk-btn flex-1"
          >
            Resend
          </button>
          <button
            type="button"
            onClick={() => {
              setShowOtpVerification(false)
              setOtp("")
            }}
            disabled={isLoading}
            className="sk-btn flex-1"
          >
            Back
          </button>
        </div>
      </form>
    )
  }

  return (
    <form onSubmit={handleSubmit} className={cn("sk-field space-y-4", className)} {...props}>
      {/* Email Field */}
      <div className="sk-field">
        <label htmlFor="email" className="sk-label">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          placeholder="you@example.com"
          required
          disabled={isLoading}
          autoComplete="email"
          className={cn(
            "sk-input",
            errors.email && "sk-input-error"
          )}
          aria-invalid={errors.email ? "true" : "false"}
          aria-describedby={errors.email ? "email-error" : undefined}
        />
        {errors.email && (
          <div id="email-error" className="sk-error">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {errors.email}
          </div>
        )}
      </div>

      {/* Password Field */}
      <div className="sk-field">
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="sk-label">
            Password
          </label>
          <a
            href="/forgot-password"
            className="text-xs font-medium text-highlight hover:text-highlight/80 transition-colors"
          >
            Forgot?
          </a>
        </div>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            required
            disabled={isLoading}
            autoComplete="current-password"
            placeholder="••••••••"
            className={cn(
              "sk-input pr-10",
              errors.password && "sk-input-error"
            )}
            aria-invalid={errors.password ? "true" : "false"}
            aria-describedby={errors.password ? "password-error" : undefined}
          />
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/60 hover:text-foreground transition-colors"
            onClick={() => setShowPassword(!showPassword)}
            tabIndex={-1}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
        {errors.password && (
          <div id="password-error" className="sk-error">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {errors.password}
          </div>
        )}
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading}
        className="sk-btn sk-btn-main w-full"
      >
        {isLoading ? "Signing in..." : "Sign In"}
      </button>
    </form>
  )
}

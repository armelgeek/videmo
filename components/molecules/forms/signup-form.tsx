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
import { PhoneInput } from "@/components/ui/phone-input"
import { signUp, emailOtp } from "@/lib/auth-client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { z } from "zod"
import { isValidPhoneNumber, type Value } from "react-phone-number-input"
import { Eye, EyeOff, Mail, Lock, User, Phone, AlertCircle, CheckCircle2 } from "lucide-react"

const signupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.union([z.string(), z.undefined()]).optional().refine((val) => {
    
    if (!val || val.length === 0) return true;
    try {
      return isValidPhoneNumber(val);
    } catch {
      return false;
    }
  }, {
    message: 'Please enter a valid phone number',
  }),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(8, "Password must be at least 8 characters"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
})

const getPasswordStrength = (password: string): { label: string; color: string; width: string } => {
  if (!password) return { label: "", color: "", width: "0%" }
  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++

  if (score <= 1) return { label: "Weak", color: "bg-destructive", width: "25%" }
  if (score === 2) return { label: "Fair", color: "bg-yellow-500", width: "50%" }
  if (score === 3) return { label: "Strong", color: "bg-blue-500", width: "75%" }
  return { label: "Very Strong", color: "bg-green-500", width: "100%" }
}

export function SignupForm({
  className,
  redirectTo,
  ...props
}: React.ComponentProps<"div"> & { redirectTo?: string }) {
  const loginHref = redirectTo ? `/login?redirect=${encodeURIComponent(redirectTo)}` : "/login"
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [phone, setPhone] = useState<Value | undefined>()
  const [showOtpVerification, setShowOtpVerification] = useState(false)
  const [email, setEmail] = useState("")
  const [otp, setOtp] = useState("")
  const [lastResendTime, setLastResendTime] = useState<number>(0)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [passwordValue, setPasswordValue] = useState("")
  const RESEND_COOLDOWN = 60000 

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrors({})

    const formData = new FormData(e.currentTarget)
    const name = formData.get("name") as string
    const emailValue = formData.get("email") as string
    const password = formData.get("password") as string
    const confirmPassword = formData.get("confirm-password") as string

    const validation = signupSchema.safeParse({ 
      name, 
      email: emailValue, 
      phone,
      password, 
      confirmPassword 
    })

    if (!validation.success) {
      const fieldErrors: Record<string, string> = {}
      if (validation.error?.issues) {
        validation.error.issues.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as string] = err.message
          }
        })
      }
      setErrors(fieldErrors)
      toast.error("Please fix the errors in the form")
      return
    }

    setIsLoading(true)

    try {
      const signupData: any = {
        email: emailValue,
        password,
        name,
      };

      if (phone) {
        signupData.phone = phone;
      }

      const { data, error } = await signUp.email(signupData);

      if (error) {
        toast.error(error.message || "Failed to create account")
        setIsLoading(false)
        return
      }

      setEmail(emailValue)
      setShowOtpVerification(true)
      toast.success("Account created! Please check your email for the verification code.")
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
      const { data, error } = await emailOtp.verifyEmail({
        email,
        otp,
      })

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
    const now = Date.now()
    const timeSinceLastResend = now - lastResendTime
    
    if (timeSinceLastResend < RESEND_COOLDOWN) {
      const remainingSeconds = Math.ceil((RESEND_COOLDOWN - timeSinceLastResend) / 1000)
      toast.error(`Please wait ${remainingSeconds} seconds before resending`)
      return
    }

    setIsLoading(true)
    try {
      const { error } = await emailOtp.sendVerificationOtp({
        email,
        type: 'email-verification',
      })

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
        </div>
      </form>
    )
  }

  const passwordStrength = getPasswordStrength(passwordValue)

  return (
    <form onSubmit={handleSubmit} className={cn("sk-field space-y-4", className)} {...props}>
      {/* Name Field */}
      <div className="sk-field">
        <label htmlFor="name" className="sk-label">Name</label>
        <input
          id="name"
          name="name"
          type="text"
          placeholder="John Doe"
          required
          disabled={isLoading}
          autoComplete="name"
          className={cn("sk-input", errors.name && "sk-input-error")}
          aria-invalid={errors.name ? "true" : "false"}
          aria-describedby={errors.name ? "name-error" : undefined}
        />
        {errors.name && (
          <div id="name-error" className="sk-error">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {errors.name}
          </div>
        )}
      </div>

      {/* Email Field */}
      <div className="sk-field">
        <label htmlFor="email" className="sk-label">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          placeholder="you@example.com"
          required
          disabled={isLoading}
          autoComplete="email"
          className={cn("sk-input", errors.email && "sk-input-error")}
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

      {/* Phone Field */}
      <div className="sk-field">
        <label htmlFor="phone" className="sk-label">
          Phone <span className="text-xs text-foreground/60">(optional)</span>
        </label>
        <PhoneInput
          id="phone"
          value={phone}
          onChange={(value) => setPhone(value || undefined)}
          placeholder="+1 (555) 000-0000"
          disabled={isLoading}
          error={!!errors.phone}
          aria-invalid={errors.phone ? "true" : "false"}
          aria-describedby={errors.phone ? "phone-error" : undefined}
        />
        {errors.phone && (
          <div id="phone-error" className="sk-error">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {errors.phone}
          </div>
        )}
      </div>

      {/* Password Fields */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sk-field">
          <label htmlFor="password" className="sk-label">Password</label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              required
              disabled={isLoading}
              autoComplete="new-password"
              placeholder="••••••••"
              value={passwordValue}
              onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
                setPasswordValue(e.target.value)
              }
              className={cn("sk-input pr-10", errors.password && "sk-input-error")}
              aria-invalid={errors.password ? "true" : "false"}
              aria-describedby={errors.password ? "password-error" : undefined}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/60 hover:text-foreground"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {passwordValue && (
            <div className="sk-password-strength">
              <div className="sk-strength-bar">
                <div
                  className={cn("sk-strength-fill", passwordStrength.label.toLowerCase().replace(" ", "-"))}
                  style={{ width: passwordStrength.width }}
                />
              </div>
              <span className="sk-strength-label">{passwordStrength.label}</span>
            </div>
          )}
          {errors.password && (
            <div id="password-error" className="sk-error">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {errors.password}
            </div>
          )}
        </div>

        <div className="sk-field">
          <label htmlFor="confirm-password" className="sk-label">Confirm</label>
          <div className="relative">
            <input
              id="confirm-password"
              name="confirm-password"
              type={showConfirmPassword ? "text" : "password"}
              required
              disabled={isLoading}
              autoComplete="new-password"
              placeholder="••••••••"
              className={cn("sk-input pr-10", errors.confirmPassword && "sk-input-error")}
              aria-invalid={errors.confirmPassword ? "true" : "false"}
              aria-describedby={errors.confirmPassword ? "confirmPassword-error" : undefined}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/60 hover:text-foreground"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              tabIndex={-1}
              aria-label={showConfirmPassword ? "Hide password" : "Show password"}
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.confirmPassword && (
            <div id="confirmPassword-error" className="sk-error">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {errors.confirmPassword}
            </div>
          )}
        </div>
      </div>

      {/* Submit Button */}
      <button type="submit" disabled={isLoading} className="sk-btn sk-btn-main w-full">
        {isLoading ? "Creating account..." : "Sign Up"}
      </button>
    </form>
  )
}

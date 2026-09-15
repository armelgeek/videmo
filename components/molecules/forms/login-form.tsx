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
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <Card className="border-0 shadow-lg">
          <CardContent className="p-6 sm:p-8">
            <form onSubmit={handleTwoFactorVerification} className="space-y-6">
              <div className="space-y-2">
                <CardTitle className="text-2xl">Enter Authentication Code</CardTitle>
                <CardDescription>
                  Open your authenticator app and enter the 6-digit code
                </CardDescription>
              </div>

              <Field>
                <FieldLabel htmlFor="totp-login">6-Digit Code</FieldLabel>
                <Input
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
                  className="text-center text-3xl font-semibold tracking-widest font-mono"
                  autoFocus
                />
              </Field>

              <div className="flex flex-col gap-3">
                <Button
                  type="submit"
                  disabled={isLoading || totpCode.length !== 6}
                  className="w-full h-10 font-medium"
                  size="lg"
                >
                  {isLoading ? "Verifying..." : "Verify Code"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowTwoFactor(false)
                    setTotpCode("")
                  }}
                  disabled={isLoading}
                  className="w-full"
                >
                  Back to Login
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (showOtpVerification) {
    return (
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <Card className="border-0 shadow-lg">
          <CardContent className="p-6 sm:p-8">
            <form onSubmit={handleOtpVerification} className="space-y-6">
              <div className="space-y-2">
                <CardTitle className="text-2xl">Verify Your Email</CardTitle>
                <CardDescription>
                  We sent a 6-digit code to{" "}
                  <span className="font-medium text-foreground">{email}</span>
                </CardDescription>
              </div>

              <Field>
                <FieldLabel htmlFor="otp">Verification Code</FieldLabel>
                <Input
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
                  className="text-center text-3xl font-semibold tracking-widest font-mono"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  Check your spam folder if you don't see the email
                </p>
              </Field>

              <div className="flex flex-col gap-3">
                <Button
                  type="submit"
                  disabled={isLoading || otp.length !== 6}
                  className="w-full h-10 font-medium"
                  size="lg"
                >
                  {isLoading ? "Verifying..." : "Verify Email"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleResendOtp}
                  disabled={isLoading}
                  className="w-full"
                >
                  Resend Code
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setShowOtpVerification(false)
                    setOtp("")
                  }}
                  disabled={isLoading}
                  className="w-full"
                >
                  Back to Login
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="border-0 shadow-lg">
        <CardContent className="p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Field */}
            <Field>
              <FieldLabel htmlFor="email">Email Address</FieldLabel>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  required
                  disabled={isLoading}
                  autoComplete="email"
                  className={cn(
                    "pl-10 transition-colors",
                    errors.email && "border-destructive focus-visible:ring-destructive"
                  )}
                  aria-invalid={errors.email ? "true" : "false"}
                  aria-describedby={errors.email ? "email-error" : undefined}
                />
              </div>
              {errors.email && (
                <div id="email-error" className="flex items-center gap-2 mt-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {errors.email}
                </div>
              )}
            </Field>

            {/* Password Field */}
            <Field>
              <div className="flex items-center justify-between">
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <a
                  href="/forgot-password"
                  className="text-xs font-medium text-primary hover:underline underline-offset-2"
                >
                  Forgot password?
                </a>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  disabled={isLoading}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className={cn(
                    "pl-10 pr-10 transition-colors",
                    errors.password && "border-destructive focus-visible:ring-destructive"
                  )}
                  aria-invalid={errors.password ? "true" : "false"}
                  aria-describedby={errors.password ? "password-error" : undefined}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
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
                <div id="password-error" className="flex items-center gap-2 mt-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {errors.password}
                </div>
              )}
            </Field>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-10 font-medium"
              size="lg"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-foreground" />
                  Signing in...
                </span>
              ) : (
                "Sign In"
              )}
            </Button>

            {/* Sign Up Link */}
            <div className="flex items-center justify-center gap-1 text-sm">
              <span className="text-muted-foreground">Don't have an account?</span>
              <a
                href={redirectTo ? `/signup?redirect=${encodeURIComponent(redirectTo)}` : "/signup"}
                className="font-medium text-primary hover:underline underline-offset-2"
              >
                Create one
              </a>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Terms */}
      <p className="text-xs text-center text-muted-foreground">
        By signing in, you agree to our{" "}
        <a href="/terms" className="underline hover:text-foreground underline-offset-2">
          Terms of Service
        </a>
        {" "}and{" "}
        <a href="/privacy" className="underline hover:text-foreground underline-offset-2">
          Privacy Policy
        </a>
      </p>
    </div>
  )
}

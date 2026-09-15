import { ReactNode } from "react"
import { Logo } from "@/components/atoms/icons/logo"
import Link from "next/link"
import "./auth.css"

interface AuthLayoutProps {
  children: ReactNode
  title: string
  description: string
  isSignup?: boolean
}

export function AuthLayout({ children, title, description, isSignup }: AuthLayoutProps) {
  return (
    <div className="sketch flex min-h-screen flex-col lg:grid lg:grid-cols-2">
      {/* Top bar - visible on all screens */}
      <div className="flex items-center justify-between gap-4 border-b-2 border-foreground/10 px-6 py-4 lg:col-span-2">
        <Link href="/" className="flex items-center gap-2">
          <Logo className="h-6 w-6" />
          <span className="sk-hand text-lg font-medium">sketch</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          {isSignup ? (
            <div className="flex items-center gap-2">
              <span className="text-foreground/60">Already have an account?</span>
              <Link href="/login" className="sk-btn sk-btn-main text-xs py-1.5">
                Sign In
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-foreground/60">New here?</span>
              <Link href="/signup" className="sk-btn sk-btn-main text-xs py-1.5">
                Sign Up
              </Link>
            </div>
          )}
        </nav>
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm space-y-8">
          {/* Header */}
          <div className="space-y-4 text-center">
            <h1 className="sk-display text-4xl">{title}</h1>
            <p className="sk-ink-2 text-base">{description}</p>
          </div>

          {/* Form box */}
          <div className="sk-box sk-box-lift space-y-6 p-8">
            {children}
          </div>

          {/* Terms */}
          <p className="text-center text-xs text-foreground/60">
            By continuing, you agree to our{" "}
            <Link href="/terms" className="underline hover:text-foreground/80">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline hover:text-foreground/80">
              Privacy
            </Link>
          </p>
        </div>
      </div>

      {/* Right side - Visual features (desktop only) */}
      <div className="hidden flex-col items-center justify-center border-l-2 border-foreground/10 px-12 py-12 lg:flex">
        <div className="max-w-sm space-y-8 text-center">
          {/* Headline */}
          <div className="space-y-2">
            <p className="sk-eyebrow">Why choose us?</p>
            <h2 className="sk-display text-2xl">Built for creators</h2>
          </div>

          {/* Features */}
          <div className="space-y-4">
            {[
              { num: "1", title: "Secure", desc: "Enterprise-grade encryption" },
              { num: "2", title: "Fast", desc: "Instant verification & sync" },
              { num: "3", title: "Simple", desc: "No complexity, just clarity" },
            ].map((item) => (
              <div key={item.num} className="flex gap-4 text-left">
                <div className="sk-box flex h-10 w-10 flex-shrink-0 items-center justify-center">
                  <span className="sk-display text-lg">{item.num}</span>
                </div>
                <div>
                  <h3 className="font-semibold">{item.title}</h3>
                  <p className="text-sm text-foreground/60">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Quote */}
          <div className="sk-box-lift sk-box border-0 bg-primary/10 py-4 text-center">
            <p className="sk-hand italic text-sm">
              "The simplest auth experience I've used."
            </p>
            <p className="mt-2 text-xs text-foreground/60">— A happy user</p>
          </div>
        </div>
      </div>
    </div>
  )
}

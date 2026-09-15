import { ReactNode } from "react"
import { Logo } from "@/components/atoms/icons/logo"

interface AuthLayoutProps {
  children: ReactNode
  title: string
  description: string
}

export function AuthLayout({ children, title, description }: AuthLayoutProps) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left side - Form */}
      <div className="flex flex-col items-center justify-center px-4 py-12 sm:px-6 lg:px-8 relative overflow-hidden">
        {/* Subtle background pattern */}
        <div className="absolute inset-0 -z-10 opacity-40">
          <div className="absolute top-0 right-0 w-72 h-72 bg-primary/5 rounded-full blur-3xl -mr-32 -mt-32" />
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-primary/5 rounded-full blur-3xl -ml-32 -mb-32" />
        </div>

        <div className="w-full max-w-md space-y-8">
          {/* Header */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5 rounded-lg blur-lg" />
              <div className="relative rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 p-3 border border-primary/10">
                <Logo className="h-8 w-8" />
              </div>
            </div>
            <div className="text-center space-y-2">
              <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                {title}
              </h1>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          </div>

          {/* Form */}
          <div className="space-y-6">{children}</div>
        </div>
      </div>

      {/* Right side - Visual */}
      <div className="hidden lg:flex lg:flex-col lg:items-center lg:justify-center lg:p-12 lg:bg-gradient-to-br lg:from-primary/5 lg:via-background lg:to-primary/10 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute inset-0 -z-10 opacity-30">
          <div className="absolute top-20 right-20 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/4 w-64 h-64 bg-primary/5 rounded-full blur-2xl" />
        </div>

        <div className="max-w-md text-center space-y-8 relative z-10">
          {/* Main message */}
          <div className="space-y-4">
            <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 mx-auto">
              <svg
                className="h-6 w-6 text-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <h2 className="text-3xl font-bold">Secure & Simple</h2>
            <p className="text-lg text-muted-foreground">
              Enterprise-grade authentication with a focus on user experience and security
            </p>
          </div>

          {/* Feature list */}
          <div className="space-y-4 pt-8">
            {[
              {
                icon: "🔒",
                title: "Enterprise Security",
                description: "Industry-leading encryption and 2FA protection",
              },
              {
                icon: "⚡",
                title: "Lightning Fast",
                description: "Optimized performance and instant verification",
              },
              {
                icon: "🎯",
                title: "User Friendly",
                description: "Intuitive interface designed for everyone",
              },
            ].map((feature, index) => (
              <div
                key={feature.title}
                className="flex gap-4 text-left p-4 rounded-lg bg-white/50 dark:bg-black/20 backdrop-blur-sm border border-primary/10 hover:border-primary/20 transition-colors"
              >
                <div className="text-2xl flex-shrink-0">{feature.icon}</div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Footer message */}
          <p className="text-xs text-muted-foreground pt-4">
            Trusted by thousands of developers worldwide
          </p>
        </div>
      </div>
    </div>
  )
}

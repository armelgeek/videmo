import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { LoginForm } from '@/components/molecules/forms/login-form'
import { AuthLayout } from "@/components/templates/auth-layout"
import { buildMetadata } from "@/lib/seo"
import { safeRedirectPath } from "@/lib/utils/safe-redirect"

export const metadata = buildMetadata({
  title: "Sign In",
  description: "Sign in to your account to access your dashboard, manage your subscription, and more.",
  path: "/login",
  keywords: ["sign in", "login", "account access"],
  noIndex: true,
});

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>
}) {
  const redirectTo = safeRedirectPath((await searchParams).redirect) ?? undefined
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (session) {
    redirect(redirectTo ?? "/dashboard")
  }

  return (
    <AuthLayout
      title="Welcome Back"
      description="Sign in to your account to continue"
    >
      <LoginForm redirectTo={redirectTo} />
    </AuthLayout>
  )
}

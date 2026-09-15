import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { SignupForm } from '@/components/molecules/forms/signup-form'
import { AuthLayout } from "@/components/templates/auth-layout"
import { buildMetadata } from "@/lib/seo"
import { safeRedirectPath } from "@/lib/utils/safe-redirect"

export const metadata = buildMetadata({
  title: "Create an Account",
  description: "Sign up for a free account. Get started with authentication, payments, and a full-featured SaaS dashboard in minutes.",
  path: "/signup",
  keywords: ["sign up", "register", "create account", "free trial"],
});

export default async function SignupPage({
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
    <AuthLayout mode="signup" redirectTo={redirectTo}>
      <SignupForm redirectTo={redirectTo} />
    </AuthLayout>
  )
}

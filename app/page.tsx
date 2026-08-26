import { Header } from "@/components/organisms/header/header";
import { Footer } from "@/components/organisms/footer/footer";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { appConfig } from "@/lib/config";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { isUserAdmin } from "@/lib/auth-utils";
import { PricingSection } from "@/components/organisms/sections/pricing-section";
import { FeaturesSection } from "@/components/organisms/sections/features-section";
import { TestimonialsSection } from "@/components/organisms/sections/testimonials-section";
import { FaqSection } from "@/components/organisms/sections/faq-section";
import { JsonLd } from "@/components/providers/json-ld";
import {
  buildMetadata,
  organizationSchema,
  webSiteSchema,
  softwareAppSchema,
  faqSchema,
} from "@/lib/seo";

export const metadata = buildMetadata({
  title: `${appConfig.name} — Launch Your SaaS Faster`,
  description:
    "Ship your SaaS in days, not months. Production-ready Next.js starter with authentication, Stripe payments, admin dashboard, blog CMS, RBAC, and 50+ components.",
  path: "/",
  keywords: [
    "SaaS boilerplate",
    "Next.js starter kit",
    "Stripe payments",
    "admin dashboard",
    "RBAC",
    "blog CMS",
    "authentication",
    "shadcn/ui",
    "Tailwind CSS",
    "Prisma ORM",
    "production ready",
    "open source",
  ],
});

const homeFaqs = [
  {
    question: "What's included in this boilerplate?",
    answer:
      "Authentication (email/password, OTP, social login), Stripe payments, role-based access control, admin dashboard, blog CMS, email templates, and much more.",
  },
  {
    question: "Can I use this for commercial projects?",
    answer:
      "Yes! This boilerplate is designed for commercial SaaS products. You own the code and can use it however you like.",
  },
  {
    question: "How do I customize the branding?",
    answer:
      "Update the .env file with your app name and URL. All branding references use the central config, so changing it in one place updates the entire app.",
  },
  {
    question: "Does it support multiple pricing plans?",
    answer:
      "Yes. The Stripe integration supports multiple plans with different features. You can configure your plans in the Stripe dashboard.",
  },
  {
    question: "Is there admin support?",
    answer:
      "Yes, there's a full admin panel with user management, role/permission editor, blog management, and application settings.",
  },
  {
    question: "What database is supported?",
    answer:
      "PostgreSQL via Prisma ORM. The Prisma adapter makes it easy to switch to other databases if needed.",
  },
];

export default async function Home() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const isAdmin = await isUserAdmin(session?.user?.id);

  // Show dashboard for logged-in users
  if (session?.user) {
    return (
      <div className="flex min-h-screen flex-col">
        <main className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-4xl space-y-12">
            {/* Header */}
            <div className="text-center space-y-3">
              <h1 className="text-4xl md:text-5xl font-bold text-white">
                Welcome to Studio
              </h1>
              <p className="text-gray-400 text-lg">
                Choose an action to get started
              </p>
            </div>

            {/* Menu Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
              {/* New Project */}
              <a
                href="/new-project"
                className="group relative p-6 rounded-xl transition-all bg-gradient-to-br from-rose-500/20 to-violet-500/20 border border-rose-500/30 hover:border-rose-500/60"
              >
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-rose-500/10 to-violet-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative space-y-4">
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-gradient-to-br from-rose-500 to-violet-500">
                    <svg
                      className="w-6 h-6 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                  </div>
                  <div className="space-y-2 text-left">
                    <h3 className="text-lg font-semibold text-white">
                      New Project
                    </h3>
                    <p className="text-sm text-gray-400">
                      Start a new video project
                    </p>
                  </div>
                  <div className="inline-flex items-center text-xs font-medium text-rose-400 pt-2">
                    Get Started →
                  </div>
                </div>
              </a>

              {/* Workspace */}
              <a
                href="/workspace"
                className="group relative p-6 rounded-xl transition-all bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20"
              >
                <div className="relative space-y-4">
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-white/10 group-hover:bg-white/20 transition-colors">
                    <svg
                      className="w-6 h-6 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6z"
                      />
                    </svg>
                  </div>
                  <div className="space-y-2 text-left">
                    <h3 className="text-lg font-semibold text-white">
                      Workspace
                    </h3>
                    <p className="text-sm text-gray-400">
                      Access your workspace
                    </p>
                  </div>
                </div>
              </a>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <JsonLd
        data={[
          organizationSchema(),
          webSiteSchema(),
          softwareAppSchema(),
          faqSchema(homeFaqs),
        ]}
      />
      <Header user={session?.user} isAdmin={isAdmin} />

      <main className="flex flex-col">
        {/* Hero Section */}
        <section className="flex flex-1 flex-col items-center justify-center px-4 py-24 sm:py-32 text-center">
          <div className="mx-auto max-w-2xl space-y-6 animate-fade-in-up">
            <p className="text-sm font-medium text-muted-foreground tracking-wide">
              {"\uD83D\uDE80"} Production-ready SaaS boilerplate
            </p>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Launch your SaaS faster than ever
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
              {appConfig.description}
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center pt-2 animate-fade-in-up delay-100">
              <Button size="lg" asChild>
                <Link href="/signup">Get Started Free</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="#features">Learn More</Link>
              </Button>
            </div>
          </div>
        </section>

        <FeaturesSection />
        <TestimonialsSection />

        {/* Pricing Section */}
        <PricingSection isLoggedIn={!!session} />

        <FaqSection />
      </main>

      <Footer />
    </div>
  );
}

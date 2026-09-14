import { appConfig } from "@/lib/config";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { isUserAdmin } from "@/lib/auth-utils";
import { JsonLd } from "@/components/providers/json-ld";
import { SketchLanding, sketchFaqs } from "@/components/organisms/landing/sketch/sketch-landing";
import {
  buildMetadata,
  organizationSchema,
  webSiteSchema,
  softwareAppSchema,
  faqSchema,
} from "@/lib/seo";

export const metadata = buildMetadata({
  title: `${appConfig.name} — Hand-drawn explainer videos`,
  description:
    "Paste a script: AI-generated storyboard, hand-drawn whiteboard animation, voiceover synced word by word, and export in 16:9, 9:16 and 1:1. Built for teams.",
  path: "/",
  keywords: [
    "whiteboard video",
    "whiteboard animation",
    "explainer video",
    "hand-drawn animation",
    "AI storyboard",
    "synced voiceover",
    "VideoScribe alternative",
    "SaaS marketing video",
  ],
});

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ landing?: string }>;
}) {
  const { landing } = await searchParams;
  const forceLanding = process.env.NODE_ENV !== "production" && landing === "1";
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // Show dashboard for logged-in users
  if (session?.user && !forceLanding) {
    return (
      <div className="flex min-h-screen flex-col">
        <main className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-4xl space-y-12">
            {/* Header */}
            <div className="text-center space-y-3">
              <h1 className="text-4xl md:text-5xl font-bold text-white">
                Welcome to {appConfig.name}
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
    <div>
      <JsonLd
        data={[
          organizationSchema(),
          webSiteSchema(),
          softwareAppSchema(),
          faqSchema(sketchFaqs),
        ]}
      />
      <SketchLanding user={session?.user} isAdmin={await isUserAdmin(session?.user?.id)} />
    </div>
  );
}

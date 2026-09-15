import { appConfig } from "@/lib/config";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
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

export default async function Home() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (session?.user) {
    redirect("/workspace");
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
      <SketchLanding user={null} isAdmin={false} />
    </div>
  );
}

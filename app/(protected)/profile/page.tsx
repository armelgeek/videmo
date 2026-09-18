import { AppShell } from '@/lib/app-shell';
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { ProfileSidebar } from '@/components/organisms/profile-sidebar';
import { prisma } from "@/lib/prisma";
import { SketchHint } from '@/components/molecules/sketch-hint';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const userData = await prisma.user.findUnique({
    where: { id: session?.user?.id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      image: true,
      emailVerified: true,
    },
  });

  return (
    <AppShell contentClassName="bg-background">
      <div className="px-4 py-6 sm:px-6 sm:py-8">
        <header className="mb-8">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-extrabold text-foreground sm:text-4xl">
              <span className="sk-marker">Profile Settings</span>
            </h1>
            <SketchHint direction="left" className="hidden text-lg sm:flex">
              your personal info &amp; account security
            </SketchHint>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage your account settings, credentials and security preferences
          </p>
        </header>

        <ProfileSidebar userData={userData} />
      </div>
    </AppShell>
  );
}

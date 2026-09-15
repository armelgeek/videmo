import { AppShell } from '@/lib/app-shell';
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { ProfileSidebar } from '@/components/organisms/profile-sidebar';
import { prisma } from "@/lib/prisma";

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
      <div className="px-4 py-6 sm:px-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">
            <span className="sk-marker">Profile Settings</span>
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Manage your account settings and preferences
          </p>
        </div>

        <ProfileSidebar userData={userData} />
      </div>
    </AppShell>
  );
}

'use client';

import { ProfileForm } from '@/components/molecules/forms/profile-form';
import { PasswordChangeForm } from '@/components/molecules/forms/password-change-form';
import { TwoFactorSettings } from '@/components/templates/two-factor-settings';

interface ProfileSidebarProps {
  userData: any;
}

const PANEL = "rounded-lg border-2 border-ink bg-card p-6 shadow-[5px_5px_0_hsl(var(--offset))]";

function PanelHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-lg font-bold text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export function ProfileSidebar({ userData }: ProfileSidebarProps) {
  return (
    <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-2">
      <section className={PANEL}>
        <PanelHeader title="Profile" description="Your name, photo and contact details" />
        <ProfileForm user={{ ...userData, phone: userData.phone || "" }} />
      </section>

      <div className="space-y-8">
        <section className={PANEL}>
          <PanelHeader title="Password" description="Update your password to keep your account secure" />
          <PasswordChangeForm />
        </section>
        {process.env.NEXT_PUBLIC_ENABLE_TWO_FACTOR !== "false" && (
          <div className="overflow-hidden rounded-lg border-2 border-ink shadow-[5px_5px_0_hsl(var(--offset))] [&>div]:rounded-none [&>div]:border-0 [&>div]:shadow-none">
            <TwoFactorSettings />
          </div>
        )}
      </div>
    </div>
  );
}

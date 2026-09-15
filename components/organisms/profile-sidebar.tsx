'use client';

import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ProfileForm } from '@/components/molecules/forms/profile-form';
import { PasswordChangeForm } from '@/components/molecules/forms/password-change-form';
import { TwoFactorSettings } from '@/components/templates/two-factor-settings';
import { DeleteAccountPanel } from '@/components/templates/delete-account-panel';

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
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);

  return (
    <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-2">
      <section className={PANEL}>
        <PanelHeader title="Profile" description="Your name, photo and contact details" />
        <ProfileForm user={{ ...userData, phone: userData.phone || "" }} />
      </section>

      <div className="space-y-8">
        <section className={PANEL}>
          <PanelHeader title="Password" description="Update your password to keep your account secure" />
          <button
            type="button"
            onClick={() => setIsPasswordOpen(true)}
            className="inline-flex h-9 items-center gap-2 rounded-lg border-2 border-ink bg-card px-4 text-sm font-semibold text-foreground shadow-[3px_3px_0_hsl(var(--offset))] outline-none transition-transform hover:-translate-x-px hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-highlight"
          >
            <KeyRound className="h-4 w-4" />
            Change password
          </button>
        </section>

        <Dialog open={isPasswordOpen} onOpenChange={setIsPasswordOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Change password</DialogTitle>
              <DialogDescription>Use at least 8 characters.</DialogDescription>
            </DialogHeader>
            <PasswordChangeForm onSuccess={() => setIsPasswordOpen(false)} />
          </DialogContent>
        </Dialog>
        {process.env.NEXT_PUBLIC_ENABLE_TWO_FACTOR !== "false" && (
          <div className="overflow-hidden rounded-lg border-2 border-ink shadow-[5px_5px_0_hsl(var(--offset))] [&>div]:rounded-none [&>div]:border-0 [&>div]:shadow-none">
            <TwoFactorSettings />
          </div>
        )}

        <section className={PANEL}>
          <DeleteAccountPanel />
        </section>
      </div>
    </div>
  );
}

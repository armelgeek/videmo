'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileForm } from '@/components/molecules/forms/profile-form';
import { PasswordChangeForm } from '@/components/molecules/forms/password-change-form';
import { TwoFactorSettings } from '@/components/templates/two-factor-settings';

interface ProfileSidebarProps {
  userData: any;
}

export function ProfileSidebar({ userData }: ProfileSidebarProps) {
  const [activeTab, setActiveTab] = useState('profile');

  return (
    <div className="space-y-6">
      {/* Tabs Navigation */}
      <div className="flex gap-2 border-b-2 border-border pb-0">
        <button
          onClick={() => setActiveTab('profile')}
          className={`px-4 py-3 font-medium text-sm border-b-2 transition-all ${
            activeTab === 'profile'
              ? 'border-ink text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Profile
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`px-4 py-3 font-medium text-sm border-b-2 transition-all ${
            activeTab === 'security'
              ? 'border-ink text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Security
        </button>
      </div>

      {/* Content */}
      <div className="space-y-6">
        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="rounded-lg border-2 border-ink bg-card shadow-[5px_5px_0_hsl(var(--offset))] p-6">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-foreground">Profile Information</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Update your profile details and personal information
              </p>
            </div>
            <ProfileForm user={{
              ...userData,
              phone: userData.phone || "",
            }} />
          </div>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <>
            <div className="rounded-lg border-2 border-ink bg-card shadow-[5px_5px_0_hsl(var(--offset))] p-6">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-foreground">Change Password</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Update your password to keep your account secure
                </p>
              </div>
              <PasswordChangeForm />
            </div>
            {process.env.NEXT_PUBLIC_ENABLE_TWO_FACTOR !== "false" && (
              <TwoFactorSettings />
            )}
          </>
        )}
      </div>
    </div>
  );
}

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
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
      {/* Sidebar Navigation */}
      <div className="lg:col-span-1">
        <nav className="space-y-2 sticky top-20">
          <button
            onClick={() => setActiveTab('profile')}
            className={`w-full text-left px-4 py-2.5 rounded-lg font-medium text-sm border-2 transition-all ${
              activeTab === 'profile'
                ? 'border-ink bg-highlight text-highlight-foreground shadow-[3px_3px_0_hsl(var(--offset))]'
                : 'border-border text-foreground hover:border-ink bg-card'
            }`}
          >
            Profile
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`w-full text-left px-4 py-2.5 rounded-lg font-medium text-sm border-2 transition-all ${
              activeTab === 'security'
                ? 'border-ink bg-highlight text-highlight-foreground shadow-[3px_3px_0_hsl(var(--offset))]'
                : 'border-border text-foreground hover:border-ink bg-card'
            }`}
          >
            Security
          </button>
        </nav>
      </div>

      {/* Content */}
      <div className="lg:col-span-3 space-y-6">
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

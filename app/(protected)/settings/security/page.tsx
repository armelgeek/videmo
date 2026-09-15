import { RecoveryCodesForm } from "@/components/molecules/forms/recovery-codes-form"
import { TrustedDevicesList } from "@/components/molecules/forms/trusted-devices-list"

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-sk-bg">
      <div className="max-w-2xl mx-auto py-12 px-4">
        <a href="/settings" className="text-sm sk-hi underline mb-8 inline-block">
          ← Back to Settings
        </a>

        <h1 className="sk-display mb-8">Security</h1>

        <div className="space-y-8">
          <div className="sk-sheet">
            <h2 className="sk-hand text-lg mb-6">Recovery Codes</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Generate backup codes for your two-factor authentication
            </p>
            <RecoveryCodesForm />
          </div>

          <div className="sk-sheet">
            <h2 className="sk-hand text-lg mb-6">Trusted Devices</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Manage devices that don't require 2FA for 30 days
            </p>
            <TrustedDevicesList />
          </div>
        </div>
      </div>
    </div>
  )
}

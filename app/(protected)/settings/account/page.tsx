import { ChangePasswordForm } from "@/components/molecules/forms/change-password-form"
import { ChangeEmailForm } from "@/components/molecules/forms/change-email-form"
import { DeleteAccountForm } from "@/components/molecules/forms/delete-account-form"

export default function AccountPage() {
  return (
    <div className="min-h-screen bg-sk-bg">
      <div className="max-w-2xl mx-auto py-12 px-4">
        <a href="/settings" className="text-sm sk-hi underline mb-8 inline-block">
          ← Back to Settings
        </a>

        <h1 className="sk-display mb-8">Account Management</h1>

        <div className="space-y-8">
          <div className="sk-sheet">
            <h2 className="sk-hand text-lg mb-6">Change Password</h2>
            <ChangePasswordForm />
          </div>

          <div className="sk-sheet">
            <h2 className="sk-hand text-lg mb-6">Change Email</h2>
            <ChangeEmailForm />
          </div>

          <div className="sk-sheet border-2 border-destructive bg-destructive/5">
            <h2 className="sk-hand text-lg mb-2 text-destructive">Delete Account</h2>
            <p className="text-xs text-destructive mb-6">This action is permanent and cannot be undone.</p>
            <DeleteAccountForm />
          </div>
        </div>
      </div>
    </div>
  )
}

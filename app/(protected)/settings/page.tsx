export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-sk-bg">
      <div className="max-w-2xl mx-auto py-12 px-4">
        <h1 className="sk-display mb-8">Account Settings</h1>
        
        <div className="space-y-6">
          <div className="sk-sheet">
            <h2 className="sk-hand text-lg mb-4">Password & Email</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Change your password or email address
            </p>
            <a href="/settings/account" className="sk-btn">
              Manage Account →
            </a>
          </div>

          <div className="sk-sheet">
            <h2 className="sk-hand text-lg mb-4">Security</h2>
            <p className="text-sm text-muted-foreground mb-4">
              2FA, recovery codes, trusted devices
            </p>
            <a href="/settings/security" className="sk-btn">
              Security Settings →
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

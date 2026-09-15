"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const CONFIRM_WORD = "DELETE"

export function DeleteAccountPanel() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const close = () => {
    setOpen(false)
    setPassword("")
    setConfirmation("")
  }

  const handleDelete = async () => {
    setIsLoading(true)
    try {
      const { error } = await authClient.deleteUser({
        ...(password ? { password } : {}),
        callbackURL: "/",
      })
      if (error) {
        toast.error(error.message || "Failed to delete account")
        return
      }
      toast.success("Your account has been deleted")
      router.push("/")
    } catch (error: any) {
      toast.error(error.message || "Failed to delete account")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <div>
        <h2 className="text-lg font-bold text-foreground">Delete account</h2>
        <p className="mb-5 text-sm text-muted-foreground">
          Permanently remove your account, projects and data. This cannot be undone.
        </p>
        <Button variant="destructive" onClick={() => setOpen(true)}>
          Delete my account
        </Button>
      </div>

      <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              Cancel any active subscription and transfer organizations you own first.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="delete-password">Password</Label>
              <Input
                id="delete-password"
                type="password"
                value={password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty if you only sign in with Google or a magic link.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="delete-confirm">Type {CONFIRM_WORD} to confirm</Label>
              <Input
                id="delete-confirm"
                value={confirmation}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmation(e.target.value)}
                autoComplete="off"
                disabled={isLoading}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isLoading || confirmation !== CONFIRM_WORD}
            >
              {isLoading ? "Deleting…" : "Delete permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

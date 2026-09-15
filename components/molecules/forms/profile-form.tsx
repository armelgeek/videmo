"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { z } from "zod";
import { isValidPhoneNumber, type Value } from "react-phone-number-input";
import { Mail } from "lucide-react";
import { api } from "@/lib/client";

const profileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().refine((val) => {
    if (!val || val.length === 0) return true;
    try {
      return isValidPhoneNumber(val);
    } catch {
      return false;
    }
  }, {
    message: 'Please enter a valid phone number',
  }),
});

const emailChangeSchema = z.object({
  newEmail: z.string().email("Please enter a valid email address"),
});

interface User {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  image?: string | null;
  emailVerified: boolean;
}

interface ProfileFormProps {
  user: User;
}

export function ProfileForm({ user }: ProfileFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    name: user.name || "",
    phone: (user.phone || undefined) as Value | undefined,
  });

  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [isEmailChangeLoading, setIsEmailChangeLoading] = useState(false);
  const [emailChangeError, setEmailChangeError] = useState("");

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const dataToValidate = {
      name: formData.name,
      phone: formData.phone || "",
    };

    const validation = profileSchema.safeParse(dataToValidate);

    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.issues.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      toast.error("Please fix the errors in the form");
      return;
    }

    setIsLoading(true);

    try {
      const response = await api.patch("/api/user/profile", {
        name: formData.name,
        phone: formData.phone || null,
      });

      if (!response.ok) {
        throw new Error(response.error || "Failed to update profile");
      }

      toast.success("Profile updated successfully");
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update profile. Please try again.");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailChange = async () => {
    setEmailChangeError("");

    const validation = emailChangeSchema.safeParse({ newEmail });
    if (!validation.success) {
      setEmailChangeError(validation.error.issues[0].message);
      return;
    }

    if (newEmail.trim().toLowerCase() === user.email.toLowerCase()) {
      setEmailChangeError("New email must be different from current email");
      return;
    }

    setIsEmailChangeLoading(true);

    try {
      const response = await api.post("/api/user/email-change", {
        newEmail: newEmail.trim(),
      });

      if (!response.ok) {
        setEmailChangeError(response.error || "Failed to request email change");
        return;
      }

      toast.success((response.data as { message?: string }).message || "Verification email sent");
      setIsEditingEmail(false);
      setNewEmail("");
    } catch (error) {
      setEmailChangeError("Failed to request email change. Please try again.");
      console.error(error);
    } finally {
      setIsEmailChangeLoading(false);
    }
  };

  const handleCancelEmailChange = () => {
    setIsEditingEmail(false);
    setNewEmail("");
    setEmailChangeError("");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex items-center gap-4">
        <Avatar className="h-14 w-14 border-2 border-ink">
          <AvatarImage src={user.image || undefined} alt={user.name} />
          <AvatarFallback className="bg-highlight font-semibold text-highlight-foreground">
            {getInitials(user.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate font-semibold text-foreground">{user.name}</p>
          <p className="truncate text-sm text-muted-foreground">{user.email}</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          type="text"
          value={formData.name}
          onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Your name"
          required
          className={errors.name ? "border-red-500" : ""}
        />
        {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">
          Phone <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <PhoneInput
          id="phone"
          value={formData.phone}
          onChange={(value) => setFormData({ ...formData, phone: value || undefined })}
          placeholder="+1 (555) 000-0000"
          error={!!errors.phone}
        />
        {errors.phone && <p className="text-sm text-red-500">{errors.phone}</p>}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="email">Email</Label>
          <span
            id="email-status"
            className={user.emailVerified ? "text-xs text-green-600 dark:text-green-500" : "text-xs text-amber-600 dark:text-amber-500"}
          >
            {user.emailVerified ? "Verified" : "Not verified"}
          </span>
        </div>
        <div className="flex gap-2">
          <Input
            id="email"
            type="email"
            value={user.email}
            disabled
            className="flex-1 bg-muted"
            aria-describedby="email-status"
          />
          <Button type="button" variant="outline" onClick={() => setIsEditingEmail(true)}>
            <Mail className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Change
          </Button>
        </div>

        <Dialog open={isEditingEmail} onOpenChange={(open) => (open ? setIsEditingEmail(true) : handleCancelEmailChange())}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Change email</DialogTitle>
              <DialogDescription>
                Your email stays {user.email} until you confirm the new address.
              </DialogDescription>
            </DialogHeader>
            <Input
              id="new-email"
              type="email"
              value={newEmail}
              onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
                setNewEmail(e.target.value);
                setEmailChangeError("");
              }}
              placeholder="New email address"
              aria-label="New email address"
              disabled={isEmailChangeLoading}
              className={emailChangeError ? "border-red-500" : ""}
              aria-invalid={emailChangeError ? "true" : "false"}
              aria-describedby="email-change-hint"
            />
            <p id="email-change-hint" className={emailChangeError ? "text-xs text-red-500" : "text-xs text-muted-foreground"}>
              {emailChangeError || "We'll send a link to confirm the new address."}
            </p>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={handleCancelEmailChange} disabled={isEmailChangeLoading}>
                Cancel
              </Button>
              <Button type="button" onClick={handleEmailChange} disabled={isEmailChangeLoading || !newEmail}>
                {isEmailChangeLoading ? "Sending…" : "Send link"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex justify-end pt-6 border-t border-border mt-4">
        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex h-9 items-center rounded-lg border-2 border-ink bg-highlight px-4 text-sm font-semibold text-highlight-foreground shadow-[3px_3px_0_hsl(var(--offset))] transition-transform hover:-translate-x-px hover:-translate-y-px disabled:opacity-50"
        >
          {isLoading ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

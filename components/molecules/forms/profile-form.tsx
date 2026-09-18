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
import { cn } from "@/lib/utils";

const profileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (!val || val.trim().length === 0) return true;
        const cleaned = val.replace(/[\s\-\(\)\.]/g, "");
        if (cleaned.length < 5 || cleaned.length > 20) return false;
        try {
          return isValidPhoneNumber(val);
        } catch {
          return /^\+?[0-9]{6,16}$/.test(cleaned);
        }
      },
      {
        message: "Please enter a valid phone number",
      }
    ),
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
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16 border-2 border-ink shadow-[3px_3px_0_hsl(var(--offset))]">
          <AvatarImage src={user.image || undefined} alt={user.name} />
          <AvatarFallback className="bg-highlight font-extrabold text-highlight-foreground text-lg">
            {getInitials(user.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-base font-extrabold text-foreground">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="name" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Full Name
        </Label>
        <Input
          id="name"
          type="text"
          value={formData.name}
          onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Your name"
          required
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? "name-error" : undefined}
          className="border-2 border-border focus:border-ink"
        />
        {errors.name && <p id="name-error" className="text-xs font-medium text-destructive">{errors.name}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Phone <span className="font-normal normal-case text-muted-foreground">(optional)</span>
        </Label>
        <PhoneInput
          id="phone"
          value={formData.phone}
          onChange={(value) => setFormData({ ...formData, phone: value || undefined })}
          placeholder="+1 (555) 000-0000"
          error={!!errors.phone}
        />
        {errors.phone && <p className="text-xs font-medium text-destructive">{errors.phone}</p>}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Email Address
          </Label>
          <span
            id="email-status"
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold capitalize",
              user.emailVerified
                ? "border border-border bg-muted/60 text-foreground"
                : "border-2 border-ink bg-highlight text-highlight-foreground shadow-[1px_1px_0_hsl(var(--offset))]"
            )}
          >
            {user.emailVerified ? "Verified" : "Unverified"}
          </span>
        </div>
        <div className="flex gap-2">
          <Input
            id="email"
            type="email"
            value={user.email}
            disabled
            className="flex-1 border-2 border-border/80 bg-muted/20"
            aria-describedby="email-status"
          />
          <button
            type="button"
            onClick={() => setIsEditingEmail(true)}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border-2 border-ink bg-card px-3.5 text-xs font-bold text-foreground shadow-[2px_2px_0_hsl(var(--offset))] transition-transform hover:-translate-x-px hover:-translate-y-px"
          >
            <Mail className="h-3.5 w-3.5" aria-hidden="true" />
            Change
          </button>
        </div>

        <Dialog open={isEditingEmail} onOpenChange={(open) => (open ? setIsEditingEmail(true) : handleCancelEmailChange())}>
          <DialogContent className="border-2 border-ink shadow-[5px_5px_0_hsl(var(--offset))]">
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
              aria-invalid={!!emailChangeError}
              aria-describedby="email-change-hint"
              className="border-2 border-border focus:border-ink"
            />
            <p id="email-change-hint" className={emailChangeError ? "text-xs font-medium text-destructive" : "text-xs text-muted-foreground"}>
              {emailChangeError || "We'll send a link to confirm the new address."}
            </p>
            <DialogFooter className="gap-2">
              <Button type="button" variant="ghost" onClick={handleCancelEmailChange} disabled={isEmailChangeLoading}>
                Cancel
              </Button>
              <button
                type="button"
                onClick={handleEmailChange}
                disabled={isEmailChangeLoading || !newEmail}
                className="inline-flex h-10 items-center rounded-lg border-2 border-ink bg-highlight px-4 text-xs font-bold text-highlight-foreground shadow-[2px_2px_0_hsl(var(--offset))] transition-transform hover:-translate-x-px hover:-translate-y-px disabled:opacity-50"
              >
                {isEmailChangeLoading ? "Sending…" : "Send link"}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex justify-end pt-5 border-t border-border/60 mt-6">
        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex h-10 items-center rounded-lg border-2 border-ink bg-highlight px-5 text-sm font-bold text-highlight-foreground shadow-[3px_3px_0_hsl(var(--offset))] transition-transform hover:-translate-x-px hover:-translate-y-px disabled:opacity-50"
        >
          {isLoading ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

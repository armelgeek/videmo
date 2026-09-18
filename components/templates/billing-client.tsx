"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { toast } from "sonner";
import { Calendar, CreditCard, ExternalLink, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  cancelSubscription,
  resumeSubscription,
  createBillingPortalSession,
} from "@/actions/payments";

interface Plan {
  id: string;
  name: string;
  description: string | null;
  amount: number;
  interval: string;
  features: string[];
  isPopular: boolean;
}

interface Subscription {
  id: string;
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  plan: Plan;
}

interface BillingClientProps {
  subscription: Subscription | null;
  canManage: boolean;
  onSelectPlansTab?: () => void;
}

export default function BillingClient({
  subscription,
  canManage,
  onSelectPlansTab,
}: BillingClientProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [resumeLoading, setResumeLoading] = useState(false);

  const handleManageBilling = async () => {
    setLoading(true);
    try {
      const result = await createBillingPortalSession();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (result.url) window.location.href = result.url;
    } catch {
      toast.error("Failed to open billing portal");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!subscription) return;
    setCancelLoading(true);
    try {
      const result = await cancelSubscription(subscription.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Subscription will be canceled at the end of the billing period");
      router.refresh();
    } catch {
      toast.error("Failed to cancel subscription");
    } finally {
      setCancelLoading(false);
    }
  };

  const handleResumeSubscription = async () => {
    if (!subscription) return;
    setResumeLoading(true);
    try {
      const result = await resumeSubscription(subscription.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Subscription resumed successfully");
      router.refresh();
    } catch {
      toast.error("Failed to resume subscription");
    } finally {
      setResumeLoading(false);
    }
  };

  const handlePlansClick = (e: React.MouseEvent) => {
    if (onSelectPlansTab) {
      e.preventDefault();
      onSelectPlansTab();
    }
  };

  return (
    <div className="space-y-6">
      {!subscription ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-border/70 bg-muted/30 p-4">
            <p className="text-sm font-medium text-foreground">Free Tier</p>
            <p className="mt-1 text-xs text-muted-foreground">
              You are currently on the Free plan with no payment method on file.
            </p>
          </div>
          {canManage && (
            <Link
              href="/billing#plans"
              onClick={handlePlansClick}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border-2 border-ink bg-highlight px-4 text-sm font-semibold text-highlight-foreground shadow-[3px_3px_0_hsl(var(--offset))] outline-none transition-transform hover:-translate-x-px hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-highlight"
            >
              <Sparkles className="h-4 w-4" />
              Upgrade to Pro
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <p className="text-3xl font-bold tabular-nums tracking-tight text-foreground">
                ${(subscription.plan.amount / 100).toFixed(2)}
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                  / {subscription.plan.interval}
                </span>
              </p>
            </div>
            <Badge
              variant={subscription.status === "active" ? "default" : "secondary"}
              className="flex items-center gap-1.5 px-2.5 py-1 capitalize"
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  subscription.status === "active" && !subscription.cancelAtPeriodEnd
                    ? "bg-emerald-400"
                    : "bg-amber-400"
                }`}
              />
              {subscription.cancelAtPeriodEnd ? "Canceling" : subscription.status}
            </Badge>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            {subscription.cancelAtPeriodEnd ? (
              <span className="font-medium text-destructive">
                Cancels on {format(new Date(subscription.currentPeriodEnd), "MMMM d, yyyy")}
              </span>
            ) : (
              <span>
                Renews on{" "}
                <span className="font-medium text-foreground">
                  {format(new Date(subscription.currentPeriodEnd), "MMMM d, yyyy")}
                </span>
              </span>
            )}
          </div>

          {canManage ? (
            <div className="space-y-2.5 border-t border-border/70 pt-5">
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={handleManageBilling}
                  disabled={loading}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border-2 border-ink bg-card px-3 text-xs font-semibold text-foreground shadow-[2px_2px_0_hsl(var(--offset))] transition-transform hover:-translate-x-px hover:-translate-y-px hover:bg-accent disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CreditCard className="h-3.5 w-3.5" />
                  )}
                  {loading ? "Opening…" : "Invoices & Cards"}
                  <ExternalLink className="h-3 w-3 opacity-60" />
                </button>

                <Link
                  href="/billing#plans"
                  onClick={handlePlansClick}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border-2 border-ink bg-card px-3 text-xs font-semibold text-foreground shadow-[2px_2px_0_hsl(var(--offset))] transition-transform hover:-translate-x-px hover:-translate-y-px hover:bg-accent"
                >
                  Change plan
                </Link>
              </div>

              {subscription.cancelAtPeriodEnd ? (
                <button
                  type="button"
                  onClick={handleResumeSubscription}
                  disabled={resumeLoading}
                  className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border-2 border-ink bg-highlight px-3 text-xs font-semibold text-highlight-foreground shadow-[3px_3px_0_hsl(var(--offset))] transition-transform hover:-translate-x-px hover:-translate-y-px"
                >
                  {resumeLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Resume subscription
                </button>
              ) : (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      Cancel subscription
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancel your subscription?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Your plan remains active until{" "}
                        {format(new Date(subscription.currentPeriodEnd), "MMMM d, yyyy")}. After
                        that date, your organization will return to the Free plan.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep subscription</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleCancelSubscription}
                        disabled={cancelLoading}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {cancelLoading ? "Canceling…" : "Confirm cancellation"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          ) : (
            <p className="border-t border-border/70 pt-4 text-xs text-muted-foreground">
              Only owners and administrators can modify billing settings or payment methods.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

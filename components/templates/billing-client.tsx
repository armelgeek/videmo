"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { toast } from "sonner";
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
}

export default function BillingClient({ subscription, canManage }: BillingClientProps) {
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

  return (
    <section aria-labelledby="subscription-heading" className="space-y-4 rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 id="subscription-heading" className="text-sm font-semibold text-foreground">
          Subscription
        </h2>
        {subscription && (
          <Badge variant={subscription.status === "active" ? "default" : "secondary"} className="capitalize">
            {subscription.status}
          </Badge>
        )}
      </div>

      {!subscription ? (
        <p className="text-sm text-muted-foreground">Free plan · no payment method on file.</p>
      ) : (
        <>
          <div>
            <p className="text-sm font-medium text-foreground">{subscription.plan.name}</p>
            <p className="text-sm tabular-nums text-muted-foreground">
              ${(subscription.plan.amount / 100).toFixed(2)} / {subscription.plan.interval}
            </p>
          </div>

          <p className="text-xs text-muted-foreground">
            {subscription.cancelAtPeriodEnd ? (
              <span className="text-destructive">
                Ends on {format(new Date(subscription.currentPeriodEnd), "MMM d, yyyy")}
              </span>
            ) : (
              <>Renews on {format(new Date(subscription.currentPeriodEnd), "MMM d, yyyy")}</>
            )}
          </p>

          {canManage ? (
            <div className="grid gap-2 border-t border-border pt-4">
              <Button variant="outline" size="sm" onClick={handleManageBilling} disabled={loading}>
                {loading ? "Opening…" : "Payment method & invoices"}
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/#pricing">Change plan</Link>
              </Button>

              {subscription.cancelAtPeriodEnd ? (
                <Button size="sm" onClick={handleResumeSubscription} disabled={resumeLoading}>
                  {resumeLoading ? "Resuming…" : "Resume subscription"}
                </Button>
              ) : (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
                      Cancel subscription
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancel your subscription?</AlertDialogTitle>
                      <AlertDialogDescription>
                        It stays active until{" "}
                        {format(new Date(subscription.currentPeriodEnd), "MMMM d, yyyy")}, then your
                        organization returns to the Free plan.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep subscription</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleCancelSubscription}
                        disabled={cancelLoading}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {cancelLoading ? "Canceling…" : "Cancel subscription"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          ) : (
            <p className="border-t border-border pt-4 text-xs text-muted-foreground">
              Only owners and admins can change the plan or payment method.
            </p>
          )}
        </>
      )}
    </section>
  );
}

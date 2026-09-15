import { toast } from "sonner";
import { billingNoticeFor } from "./billing-notice";

// Returns true when the response was a billing refusal and a toast was shown.
export function showBillingNotice(status: number, body: unknown): boolean {
  const notice = billingNoticeFor(status, body);
  if (!notice) return false;
  toast.error(notice.message, {
    action: {
      label: notice.actionLabel,
      onClick: () => {
        window.location.href = notice.href;
      },
    },
  });
  return true;
}

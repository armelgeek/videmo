import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { buildMetadata } from "@/lib/seo";
import { InvitationCard } from "@/components/organisms/workspace/invitation-card";

export const metadata = buildMetadata({
  title: "Organization invitation",
  description: "Review an invitation to join an organization.",
  path: "/invite",
  noIndex: true,
});

export default async function InvitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  const returnTo = encodeURIComponent(`/invite/${id}`);

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-4 py-12">
      <div className="w-full max-w-md">
        {session ? (
          <InvitationCard invitationId={id} signedInEmail={session.user.email} />
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-rose-300/80">Invitation</p>
            <h1 className="mt-2 text-2xl font-bold text-white">You&apos;ve been invited to an organization</h1>
            <p className="mt-2 text-sm text-gray-400">
              Sign in with the email address the invitation was sent to. No account yet? Create one with that
              address.
            </p>
            <div className="mt-8 flex flex-col gap-3">
              <Link
                href={`/login?redirect=${returnTo}`}
                className="rounded-lg bg-gradient-to-r from-rose-500 to-violet-500 px-5 py-2.5 text-sm font-semibold text-white outline-none transition hover:shadow-lg hover:shadow-rose-500/20 focus-visible:ring-2 focus-visible:ring-rose-300"
              >
                Sign in to accept
              </Link>
              <Link
                href={`/signup?redirect=${returnTo}`}
                className="rounded-lg border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/10"
              >
                Create an account
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

import { notFound, redirect } from 'next/navigation';
import { AppShell } from '@/lib/app-shell';
import { FormatEditor } from '@/components/organisms/workspace/formats/format-editor';
import { listManagedFormatsFor } from '@/lib/storyboard/formats/repository';
import { ProjectUnauthorizedError, requireSessionViewer } from '@/lib/video-project/session';

/**
 * Editing a format, or customizing a shipped one — the same screen.
 *
 * Which of the two it is comes from the row itself, not from the URL: a format
 * the organization owns is edited in place, a shipped one is copied under the
 * same key.
 */
export default async function EditFormatPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;

  let organizationId: string | null;
  try {
    ({ organizationId } = await requireSessionViewer());
  } catch (error) {
    if (error instanceof ProjectUnauthorizedError) redirect('/login');
    throw error;
  }

  const managed = (await listManagedFormatsFor(organizationId)).find(
    (m) => m.format.id === key,
  );
  if (!managed) notFound();

  return (
    <AppShell contentClassName="bg-background">
      <FormatEditor initial={managed.format} isOverride={!managed.isOwn} />
    </AppShell>
  );
}

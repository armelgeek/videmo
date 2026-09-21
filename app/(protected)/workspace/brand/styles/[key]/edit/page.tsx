import { notFound, redirect } from 'next/navigation';
import { AppShell } from '@/lib/app-shell';
import { StyleEditor } from '@/components/organisms/workspace/styles/style-editor';
import { listManagedVisualStylesFor } from '@/lib/storyboard/visual-styles/repository';
import { ProjectUnauthorizedError, requireSessionViewer } from '@/lib/video-project/session';

/**
 * Editing a style, or customizing a shipped one — the same screen. Which of the
 * two it is comes from the row itself, not from the URL: a style the
 * organization owns is edited in place, a shipped one is copied under the same
 * key.
 */
export default async function EditStylePage({
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

  const managed = (await listManagedVisualStylesFor(organizationId)).find(
    (m) => m.style.id === key,
  );
  if (!managed) notFound();

  return (
    <AppShell contentClassName="bg-background">
      <StyleEditor initial={managed.style} isOverride={!managed.isOwn} />
    </AppShell>
  );
}
